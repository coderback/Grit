import type { PoolClient } from 'pg';
import type { FoodRecord } from './record';
import { testSchema } from './test-db';
import { changedAnything, removeMissing, writeFoods } from './writer';

// Runs against DATABASE_URL (a database with the backend's migrations
// applied), in copies of the food tables in a schema of their own (see
// test-db.ts), so real imported foods with the same barcodes are never
// merged with, or removed by, these tests.

let db: Awaited<ReturnType<typeof testSchema>>;
let client: PoolClient;

const at = new Date('2026-01-01T00:00:00Z');

function rec(
  over: Partial<FoodRecord> & Pick<FoodRecord, 'externalId'>,
): FoodRecord {
  return {
    source: 'off',
    fetchedAt: at,
    name: 'Test oat drink',
    brand: 'Testbrand',
    kind: 'branded',
    countries: ['gb'],
    barcodes: [],
    servings: [{ label: '1 glass (250 ml)', grams: 250, typical: true }],
    nutrients: {
      kcal: 45,
      protein_g: 1,
      carbs_g: 6.6,
      fat_g: 1.5,
      calcium_mg: 120,
    },
    basis: 'label',
    names: [{ name: 'Boisson à l’avoine', lang: 'fr' }],
    quality: 0.5,
    verified: false,
    ...over,
  };
}

/** Row versions of everything a food owns: unchanged means nothing was rewritten. */
async function versions(foodId: string) {
  const { rows } = await client.query<{ v: string }>(
    `SELECT string_agg(t.xmin::text, ',' ORDER BY t.k) AS v FROM (
       SELECT xmin, 'f' || id AS k FROM foods WHERE id = $1
       UNION ALL SELECT xmin, 'n' || nutrient FROM food_nutrients WHERE "foodId" = $1
       UNION ALL SELECT xmin, 's' || label FROM food_servings WHERE "foodId" = $1
       UNION ALL SELECT xmin, 'b' || code FROM food_barcodes WHERE "foodId" = $1
       UNION ALL SELECT xmin, 'm' || lang || name FROM food_names WHERE "foodId" = $1
       UNION ALL SELECT xmin, 'o' || source || "externalId" FROM food_sources WHERE "foodId" = $1
     ) t`,
    [foodId],
  );
  return rows[0].v;
}

beforeAll(async () => {
  db = await testSchema('writer');
  client = await db.pool.connect();
});

afterAll(async () => {
  client?.release();
  await db?.drop();
});

describe('writing foods', () => {
  it('stores a food with its nutrients, servings, barcodes and names, and a re-run changes nothing', async () => {
    const records = [
      rec({ externalId: 'test-0001', barcodes: ['049000028911'] }),
      rec({
        externalId: 'test-0002',
        name: 'Test rye bread',
        barcodes: ['12345670'],
      }),
    ];
    const first = await writeFoods(client, records);
    expect(first).toMatchObject({ read: 2, skipped: 0, foodsInserted: 2 });

    const { rows: foods } = await client.query(
      `SELECT f.id, f.name, f.source, f."searchText", f.countries,
              (SELECT count(*)::int FROM food_nutrients n WHERE n."foodId" = f.id) AS nutrients,
              (SELECT array_agg(code) FROM food_barcodes b WHERE b."foodId" = f.id) AS barcodes
       FROM foods f WHERE f.id IN ('off_test-0001', 'off_test-0002') ORDER BY f.id`,
    );
    expect(foods).toEqual([
      {
        id: 'off_test-0001',
        name: 'Test oat drink',
        source: 'off',
        searchText: 'test oat drink testbrand boisson a l avoine',
        countries: ['gb'],
        nutrients: 5,
        // UPC-A as GTIN-13
        barcodes: ['0049000028911'],
      },
      expect.objectContaining({
        id: 'off_test-0002',
        barcodes: ['0000012345670'],
      }),
    ]);

    const before = await versions('off_test-0001');
    const again = await writeFoods(client, records);
    expect(changedAnything(again)).toBe(false);
    expect(await versions('off_test-0001')).toBe(before);
  });

  it('changes only what changed', async () => {
    const changed = rec({
      externalId: 'test-0001',
      barcodes: ['049000028911'],
      nutrients: { kcal: 46, protein_g: 1, carbs_g: 6.6, fat_g: 1.5 },
      servings: [{ label: '1 glass (250 ml)', grams: 250, typical: true }],
    });
    const stats = await writeFoods(client, [changed]);
    expect(stats).toMatchObject({
      foodsInserted: 0,
      foodsUpdated: 0,
      // kcal updated, calcium dropped
      nutrientsChanged: 2,
      servingsChanged: 0,
    });
    const { rows } = await client.query<{ nutrient: string; amount: number }>(
      `SELECT nutrient, amount FROM food_nutrients WHERE "foodId" = 'off_test-0001' ORDER BY nutrient`,
    );
    expect(rows.map((r) => [r.nutrient, r.amount])).toEqual([
      ['carbs_g', 6.6],
      ['fat_g', 1.5],
      ['kcal', 46],
      ['protein_g', 1],
    ]);
  });

  it('merges the same product from two sources by barcode, showing the better source', async () => {
    // USDA's branded record for the Open Food Facts product above
    const usda = rec({
      source: 'fdc',
      externalId: 'test-9001',
      name: 'TEST OAT DRINK, ORIGINAL',
      brand: 'TESTBRAND',
      countries: ['us'],
      barcodes: ['0049000028911'],
      nutrients: { kcal: 48, protein_g: 1.2, carbs_g: 7, fat_g: 1.6 },
      basis: 'label',
      verified: true,
      names: [],
    });
    await writeFoods(client, [usda]);

    const { rows } = await client.query(
      `SELECT f.id, f.name, f.source, f.verified,
              (SELECT amount FROM food_nutrients WHERE "foodId" = f.id AND nutrient = 'kcal') AS kcal,
              (SELECT array_agg(source || ':' || "externalId" ORDER BY source)
                 FROM food_sources WHERE "foodId" = f.id) AS sources
       FROM foods f JOIN food_barcodes b ON b."foodId" = f.id
       WHERE b.code = '0049000028911'`,
    );
    expect(rows).toEqual([
      {
        id: 'off_test-0001', // one food, kept under its first id
        name: 'TEST OAT DRINK, ORIGINAL',
        source: 'fdc',
        verified: true,
        kcal: 48,
        sources: ['fdc:test-9001', 'off:test-0001'],
      },
    ]);

    // Re-importing Open Food Facts afterwards doesn't take the food back
    const before = await versions('off_test-0001');
    const offAgain = await writeFoods(client, [
      rec({
        externalId: 'test-0001',
        barcodes: ['049000028911'],
        nutrients: { kcal: 46, protein_g: 1, carbs_g: 6.6, fat_g: 1.5 },
      }),
    ]);
    expect(changedAnything(offAgain)).toBe(false);
    expect(await versions('off_test-0001')).toBe(before);
  });

  it('treats two records with the same barcode in one batch as one food', async () => {
    const stats = await writeFoods(client, [
      rec({
        externalId: 'test-0101',
        name: 'Test crisps',
        barcodes: ['5000000000017'],
      }),
      rec({
        externalId: 'test-0102',
        name: 'Test crisps (dup)',
        barcodes: ['05000000000017'],
      }),
    ]);
    expect(stats.foodsInserted).toBe(1);
    const { rows } = await client.query<{ foodId: string }>(
      `SELECT "foodId", "externalId" FROM food_sources WHERE "externalId" IN ('test-0101', 'test-0102') ORDER BY "externalId"`,
    );
    expect(rows.map((r) => r.foodId)).toEqual([
      'off_test-0101',
      'off_test-0101',
    ]);
  });

  it("skips records without a name or calories, and drops values that can't be right", async () => {
    const stats = await writeFoods(client, [
      rec({ externalId: 'test-0201', name: '  ' }),
      rec({ externalId: 'test-0202', nutrients: { protein_g: 3 } }),
      rec({
        externalId: 'test-0203',
        name: 'Test salt',
        nutrients: { kcal: 0, sodium_mg: 38_700, iron_mg: 9_999 },
      }),
    ]);
    expect(stats).toMatchObject({ read: 3, skipped: 2, foodsInserted: 1 });
    const { rows } = await client.query<{ nutrient: string }>(
      `SELECT nutrient FROM food_nutrients WHERE "foodId" = 'off_test-0203' ORDER BY nutrient`,
    );
    expect(rows.map((r) => r.nutrient)).toEqual(['kcal', 'sodium_mg']);
  });

  it("removes a source's rows that a full import no longer has", async () => {
    await writeFoods(client, [
      rec({
        source: 'cofid',
        kind: 'generic',
        externalId: 'test-c1',
        name: 'Test apple',
        basis: 'measured',
      }),
      rec({
        source: 'cofid',
        kind: 'generic',
        externalId: 'test-c2',
        name: 'Test pear',
        basis: 'measured',
      }),
    ]);
    const removed = await removeMissing(client, 'cofid', new Set(['test-c1']));
    expect(removed).toBe(2); // the source row and its food
    const { rows } = await client.query(
      `SELECT id FROM foods WHERE id IN ('cofid_test-c1', 'cofid_test-c2')`,
    );
    expect(rows).toEqual([{ id: 'cofid_test-c1' }]);
  });
});
