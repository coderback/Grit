import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type { PoolClient } from 'pg';
import { cofidJob, fdcJobs, offFileInput, offJob } from './jobs';
import { runJob, type Job } from './run';
import { testSchema } from './test-db';
import { FIXTURES, writeCofidWorkbook } from './test-fixtures';
import { changedAnything, emptyStats, type WriteStats } from './writer';

// Imports every fixture the way the CLI does, into copies of the food
// tables in a schema of their own (see test-db.ts): real imported rows are
// never touched.

let db: Awaited<ReturnType<typeof testSchema>>;
let client: PoolClient;
let tmp: string;
let cofidPath: string;

const FDC = join(FIXTURES, 'fdc');
const DELTA = join(
  FIXTURES,
  'off/openfoodfacts_products_1793860191_1793946243.json',
);
const CSV = join(FIXTURES, 'off/en.openfoodfacts.org.products.sample.csv');

function jobs(): Job[] {
  return [
    ...fdcJobs({
      foundation: join(
        FDC,
        'FoodData_Central_foundation_food_json_2026-10-29.json',
      ),
      sr: join(FDC, 'FoodData_Central_sr_legacy_food_csv_2018-04.zip'),
      fndds: join(FDC, 'FoodData_Central_survey_food_json_2024-10-31.json'),
      branded: join(FDC, 'FoodData_Central_branded_food_csv_2026-10-29'),
    }),
    cofidJob(cofidPath),
    offJob('off-delta', [offFileInput(DELTA)], { complete: false }),
    offJob('off-csv', [offFileInput(CSV)], { complete: true }),
  ];
}

async function runAll(list: Job[], options = {}) {
  const total = emptyStats();
  for (const job of list) {
    const s = await runJob(client, job, { batchSize: 7, ...options });
    for (const k of Object.keys(total) as (keyof WriteStats)[]) {
      total[k] += s[k];
    }
  }
  return total;
}

async function count(sql: string, params: unknown[] = []) {
  const { rows } = await client.query<{ n: number }>(sql, params);
  return rows[0].n;
}

beforeAll(async () => {
  db = await testSchema('import');
  client = await db.pool.connect();
  tmp = await mkdtemp(join(tmpdir(), 'import-'));
  cofidPath = await writeCofidWorkbook(tmp);
});

afterAll(async () => {
  client?.release();
  await db?.drop();
  await rm(tmp, { recursive: true, force: true });
});

describe('importing the fixtures', () => {
  it('imports every source, and a second run changes nothing', async () => {
    const first = await runAll(jobs());
    // Read (with energy): Foundation+SR 13 (12), FNDDS 4 (3), Branded 17
    // products from 19 rows (17), CoFID 39 (35), OFF delta 11 (9), OFF CSV 11
    expect(first).toMatchObject({ read: 95, skipped: 8, foodsInserted: 87 });
    expect(await count('SELECT count(*)::int AS n FROM foods')).toBe(87);
    expect(
      await count(
        `SELECT count(*)::int AS n FROM food_sources WHERE source = 'fdc' AND "externalId" LIKE 'branded:%'`,
      ),
    ).toBe(17);

    const second = await runAll(jobs());
    expect(second.read).toBe(95);
    expect(changedAnything(second)).toBe(false);
  });

  it('makes a Foundation food and its SR Legacy twin one food', async () => {
    const { rows } = await client.query(
      `SELECT f.id, f.name, f.source, f.verified, f.countries,
              (SELECT count(*)::int FROM food_nutrients n WHERE n."foodId" = f.id) AS nutrients,
              (SELECT amount FROM food_nutrients n WHERE n."foodId" = f.id AND nutrient = 'kcal') AS kcal,
              (SELECT array_agg(source || ':' || "externalId") FROM food_sources s WHERE s."foodId" = f.id) AS sources,
              (SELECT array_agg(label ORDER BY typical DESC, label) FROM food_servings v WHERE v."foodId" = f.id) AS servings
       FROM foods f WHERE f."searchText" LIKE 'kale%'`,
    );
    expect(rows).toEqual([
      {
        id: 'fdc_ndb-11233',
        name: 'Kale, raw',
        source: 'fdc',
        verified: true,
        countries: ['us'],
        nutrients: 28,
        kcal: 35,
        sources: ['fdc:ndb:11233'],
        servings: ['1 serving', '1 cup', '1 cup, pieces of ~1"'],
      },
    ]);
  });

  it('stores label values for products, with their barcodes', async () => {
    const { rows } = await client.query(
      `SELECT f.id, n.amount, n.basis
       FROM food_barcodes b JOIN foods f ON f.id = b."foodId"
       JOIN food_nutrients n ON n."foodId" = f.id AND n.nutrient = 'caffeine_mg'
       WHERE b.code = '0049000028911'`,
    );
    expect(rows).toEqual([
      { id: 'off_0049000028911', amount: 12.96, basis: 'label' },
    ]);
    // UPC-E 03106424 as its GTIN-13
    expect(
      await count(
        `SELECT count(*)::int AS n FROM food_barcodes WHERE code = '0031200000644'`,
      ),
    ).toBe(1);
  });

  it("removes only the dataset's missing rows on a full import", async () => {
    const [, fndds] = jobs();
    const without: Job = {
      ...fndds,
      async *records() {
        for await (const r of fndds.records()) {
          if (r.externalId !== 'fndds:58106230') yield r;
        }
      },
    };
    const stats = await runJob(client, without, { full: true });
    expect(stats.removed).toBe(2); // the source row and its food
    expect(
      await count(
        `SELECT count(*)::int AS n FROM foods WHERE id = 'fdc_fndds-58106230'`,
      ),
    ).toBe(0);
    // Other fdc datasets are untouched
    expect(
      await count(
        `SELECT count(*)::int AS n FROM food_sources WHERE source = 'fdc' AND "externalId" LIKE 'ndb:%'`,
      ),
    ).toBe(12);
    // And a dry run removes nothing
    await runJob(client, fndds, {});
    const dry = await runJob(client, without, { full: true, dryRun: true });
    expect(dry.removed).toBe(2);
    expect(
      await count(
        `SELECT count(*)::int AS n FROM foods WHERE id = 'fdc_fndds-58106230'`,
      ),
    ).toBe(1);
  });

  it('refuses to remove more than the limit', async () => {
    const [ndb] = jobs();
    const few: Job = {
      ...ndb,
      async *records() {
        for await (const r of ndb.records()) {
          if (r.externalId === 'ndb:11233') yield r;
        }
      },
    };
    await expect(
      runJob(client, few, { full: true, maxRemove: 3 }),
    ).rejects.toThrow(/Refusing to remove 11/);
    expect(
      await count(
        `SELECT count(*)::int AS n FROM food_sources WHERE "externalId" LIKE 'ndb:%'`,
      ),
    ).toBe(12);
  });

  it('removes an Open Food Facts product that has become obsolete', async () => {
    const lines = (await readFile(DELTA, 'utf8')).trim().split('\n');
    const tuna = JSON.parse(lines[0]) as Record<string, unknown>;
    expect(tuna.code).toBe('3596710437771');
    const file = join(tmp, 'openfoodfacts_products_1793946243_1794000000.json');
    await writeFile(file, JSON.stringify({ ...tuna, obsolete: 'on' }) + '\n');

    const stats = await runJob(
      client,
      offJob('off-delta', [offFileInput(file)], { complete: false }),
    );
    expect(stats).toMatchObject({ read: 0, removed: 2 });
    expect(
      await count(
        `SELECT count(*)::int AS n FROM foods WHERE id = 'off_3596710437771'`,
      ),
    ).toBe(0);
  });

  it('only updates products already in the database when asked', async () => {
    await client.query(`DELETE FROM foods WHERE id = 'off_3017620422003'`);
    const stats = await runJob(
      client,
      offJob('off-csv', [offFileInput(CSV)], {
        complete: true,
        existingIn: db.pool,
      }),
    );
    // 10 of the 11 products are in the database; Nutella isn't any more
    expect(stats).toMatchObject({ read: 10, foodsInserted: 0 });
    expect(changedAnything(stats)).toBe(false);
  });
});
