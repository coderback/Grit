import { TestDb } from '../test-utils/db';
import { FoodDbService } from './food-db.service';
import { FoodService } from './food.service';
import { QuickFoodsService } from './quick-foods.service';
import { searchTextOf } from './food-text';
import type { FoodRecord } from './food-record';

// Foods here use a made-up word ("blorvak") so real imported data in the
// same database can't change the rankings. All of them have ids starting
// "test_" and are removed afterwards.

const db = new TestDb();
const foodDb = new FoodDbService(db.prisma);
const food = new FoodService(db.prisma, foodDb);
const quick = new QuickFoodsService(db.prisma);

async function seed(
  id: string,
  name: string,
  over: {
    brand?: string;
    kind?: string;
    source?: string;
    countries?: string[];
    quality?: number;
    popularity?: number;
    verified?: boolean;
    barcode?: string;
    kcal?: number;
    servings?: { label: string; grams: number; typical?: boolean }[];
    extra?: Record<string, number>;
    basis?: string;
  } = {},
) {
  const nutrients = {
    kcal: over.kcal ?? 52,
    protein_g: 0.3,
    carbs_g: 14,
    fat_g: 0.2,
    ...over.extra,
  };
  await db.prisma.food.create({
    data: {
      id,
      name,
      brand: over.brand ?? null,
      kind: over.kind ?? 'generic',
      source: over.source ?? 'fdc',
      countries: over.countries ?? ['us'],
      quality: over.quality ?? 1,
      popularity: over.popularity ?? 0,
      verified: over.verified ?? true,
      searchText: searchTextOf(name, over.brand),
      barcodes: over.barcode ? { create: { code: over.barcode } } : undefined,
      servings: over.servings ? { create: over.servings } : undefined,
      nutrients: {
        create: Object.entries(nutrients).map(([nutrient, amount]) => ({
          nutrient,
          amount,
          basis: over.basis ?? 'measured',
        })),
      },
      sources: {
        create: {
          id: `test:${id}`,
          source: over.source ?? 'fdc',
          externalId: id,
          fetchedAt: new Date('2026-01-01'),
        },
      },
    },
  });
}

async function removeTestFoods() {
  await db.prisma.food.deleteMany({ where: { id: { startsWith: 'test_' } } });
  await db.prisma.food.deleteMany({
    where: { sources: { some: { externalId: { startsWith: '9999' } } } },
  });
}

beforeAll(async () => {
  await removeTestFoods();
  await seed('test_raw_us', 'Blorvaks, raw, with skin', {
    countries: ['us'],
    servings: [
      { label: '1 medium', grams: 182, typical: true },
      { label: '1 cup, sliced', grams: 109 },
    ],
    extra: { iron_mg: 0.12, vit_c_mg: 4.6, sodium_mg: 1 },
  });
  await seed('test_raw_gb', 'Blorvak, raw', {
    source: 'cofid',
    countries: ['gb'],
    extra: { iron_mg: 0.1 },
  });
  await seed('test_pie', 'Blorvak pie', { kcal: 237 });
  await seed('test_juice', 'Blorvak juice', {
    kind: 'branded',
    source: 'off',
    brand: 'Juicy Co',
    countries: ['gb'],
    quality: 0.5,
    verified: false,
    barcode: '0049000028911',
    basis: 'label',
    kcal: 46,
  });
  await seed('test_dup_ca', 'Blorvak, raw', {
    source: 'cnf',
    countries: ['ca'],
  });
  await seed('test_estimate', 'Blorvak cake', {
    extra: { zinc_mg: 9 },
  });
  await db.prisma.foodNutrient.update({
    where: {
      foodId_nutrient: { foodId: 'test_estimate', nutrient: 'zinc_mg' },
    },
    data: { basis: 'estimated' },
  });
});

afterAll(async () => {
  await removeTestFoods();
  await db.cleanup();
});

describe('food database search', () => {
  it('needs three characters', async () => {
    await expect(foodDb.search('bl')).resolves.toEqual([]);
  });

  it("puts the user's country first, and shows one of two foods that read the same", async () => {
    const results = await foodDb.search('blorvak', { country: 'GB' });
    const names = results.map((r) => `${r.name}|${r.source}`);
    expect(names[0]).toBe('Blorvak, raw|cofid');
    // The Canadian "Blorvak, raw" reads the same as the British one
    expect(names.filter((n) => n.startsWith('Blorvak, raw|'))).toHaveLength(1);
    expect(names).toEqual(
      expect.arrayContaining([
        'Blorvaks, raw, with skin|fdc',
        'Blorvak pie|fdc',
        'Blorvak juice|off',
      ]),
    );
  });

  it('finds plurals, brands and near misses', async () => {
    const plural = await foodDb.search('blorvaks raw', { country: 'US' });
    expect(plural[0].name).toBe('Blorvaks, raw, with skin');

    const brand = await foodDb.search('juicy co blorvak');
    expect(brand[0].name).toBe('Blorvak juice');

    // A typo: not every word matches, so the similarity search finds it
    const typo = await foodDb.search('blorvac pie');
    expect(typo.map((r) => r.name)).toContain('Blorvak pie');
  });

  it('returns what the app needs: id, servings, verified, per-100 g macros', async () => {
    const [raw] = await foodDb.search('blorvaks raw', { country: 'US' });
    expect(raw).toMatchObject({
      offId: 'test_raw_us',
      foodId: 'test_raw_us',
      kind: 'generic',
      source: 'fdc',
      verified: true,
      basis: 'measured',
      calories: 52,
      carbsG: 14,
      // The typical serving is the default portion
      servingQty: 182,
      servingUnit: 'g',
      servings: [
        { label: '1 medium', grams: 182, typical: true },
        { label: '1 cup, sliced', grams: 109, typical: false },
      ],
    });
    // Micronutrients only come with single foods
    expect(raw.nutrients).toBeUndefined();
  });

  it("puts the user's own foods first, including what Smart log remembers", async () => {
    const user = await db.user();
    await db.prisma.foodLog.create({
      data: {
        userId: user.id,
        name: 'Blorvak pie',
        mealType: 'snack',
        calories: 237,
        foodId: 'test_pie',
        grams: 100,
      },
    });
    await db.prisma.foodMemory.create({
      data: {
        userId: user.id,
        key: 'grandma blorvak crumble',
        name: 'Grandma blorvak crumble',
        kcalPer100g: 250,
        proteinPer100g: 3,
        carbsPer100g: 35,
        fatPer100g: 11,
        usualGrams: 140,
      },
    });

    const results = await foodDb.search('blorvak', {
      userId: user.id,
      country: 'GB',
    });
    expect(results[0]).toMatchObject({
      offId: expect.stringMatching(/^memory:/) as string,
      name: 'Grandma blorvak crumble',
      kind: 'user',
      servingQty: 140,
      mine: true,
    });
    expect(results[1]).toMatchObject({ foodId: 'test_pie', mine: true });
  });
});

describe('barcodes and single foods', () => {
  it('finds a barcode however it was written', async () => {
    for (const code of ['049000028911', '0049000028911', '00049000028911']) {
      await expect(foodDb.byBarcode(code)).resolves.toMatchObject({
        foodId: 'test_juice',
        barcode: '0049000028911',
        verified: false,
        basis: 'label',
      });
    }
    await expect(foodDb.byBarcode('12345670')).resolves.toBeNull();
  });

  it('gives a single food with its measured and label nutrients, not estimates', async () => {
    const one = await foodDb.byId('test_estimate');
    expect(one?.nutrients).toEqual({
      kcal: 52,
      protein_g: 0.3,
      carbs_g: 14,
      fat_g: 0.2,
    });
  });

  it('saves a product found live once, even when asked twice', async () => {
    const record: FoodRecord = {
      source: 'off',
      externalId: '9999000000017',
      fetchedAt: new Date('2026-02-01'),
      name: 'Blorvak bar',
      brand: 'Testbar',
      kind: 'branded',
      countries: ['gb'],
      barcodes: ['9999000000017'],
      servings: [{ label: '1 bar (40 g)', grams: 40, typical: true }],
      nutrients: {
        kcal: 410,
        protein_g: 6,
        carbs_g: 60,
        fat_g: 15,
        iron_mg: 2,
      },
      basis: 'label',
      quality: 0.6,
      verified: false,
    };
    const saved = await foodDb.saveRecord(record);
    expect(saved).toMatchObject({
      foodId: 'off_9999000000017',
      name: 'Blorvak bar',
      servings: [{ label: '1 bar', grams: 40, typical: true }],
      nutrients: { kcal: 410, iron_mg: 2 },
    });
    const again = await foodDb.saveRecord({ ...record, name: 'Changed' });
    expect(again?.name).toBe('Blorvak bar');
    // Nothing worth keeping without calories
    await expect(
      foodDb.saveRecord({ ...record, externalId: '99990', nutrients: {} }),
    ).resolves.toBeNull();
  });
});

describe('logging a database food', () => {
  it("keeps a snapshot of the eaten amount's nutrients and counts the food's popularity", async () => {
    const user = await db.user();
    const before = await db.prisma.food.findUniqueOrThrow({
      where: { id: 'test_raw_us' },
    });
    const log = await food.logFood(user.supabaseId, {
      name: 'Blorvaks, raw, with skin',
      mealType: 'snack',
      calories: 78,
      servingQty: 150,
      servingUnit: 'g',
      foodId: 'test_raw_us',
      grams: 150,
    });
    expect(log).toMatchObject({ foodId: 'test_raw_us', grams: 150 });
    expect(log.nutrients).toEqual({
      kcal: { amount: 78, basis: 'measured' },
      protein_g: { amount: 0.45, basis: 'measured' },
      carbs_g: { amount: 21, basis: 'measured' },
      fat_g: { amount: 0.3, basis: 'measured' },
      iron_mg: { amount: 0.18, basis: 'measured' },
      vit_c_mg: { amount: 6.9, basis: 'measured' },
      sodium_mg: { amount: 1.5, basis: 'measured' },
    });
    const after = await db.prisma.food.findUniqueOrThrow({
      where: { id: 'test_raw_us' },
    });
    expect(after.popularity).toBe(before.popularity + 1);

    // Editing the calories scales the snapshot with them
    const edited = await food.updateFoodLog(user.supabaseId, log.id, {
      calories: 156,
    });
    expect(edited.nutrients).toMatchObject({
      iron_mg: { amount: 0.36, basis: 'measured' },
    });

    // The Food tab doesn't carry snapshots
    const day = await food.getFoodLogsForDate(
      user.supabaseId,
      new Date().toISOString().slice(0, 10),
      0,
    );
    expect(day.logs[0]).not.toHaveProperty('nutrients');
    expect(day.logs[0]).toMatchObject({ foodId: 'test_raw_us', grams: 150 });
  });

  it('links a scanned barcode logged in grams, and ignores a food that no longer exists', async () => {
    const user = await db.user();
    const scanned = await food.logFood(user.supabaseId, {
      name: 'Blorvak juice',
      mealType: 'snack',
      calories: 115,
      barcode: '049000028911',
      servingQty: 250,
      servingUnit: 'ml',
    });
    expect(scanned).toMatchObject({ foodId: 'test_juice', grams: 250 });
    expect(scanned.nutrients).toMatchObject({
      kcal: { amount: 115, basis: 'label' },
    });

    const gone = await food.logFood(user.supabaseId, {
      name: 'Old food',
      mealType: 'snack',
      calories: 100,
      foodId: 'fdc_removed',
      grams: 100,
    });
    expect(gone).toMatchObject({ foodId: null, grams: 100, nutrients: null });

    const manual = await food.logFood(user.supabaseId, {
      name: 'Home-made soup',
      mealType: 'lunch',
      calories: 300,
    });
    expect(manual).toMatchObject({
      foodId: null,
      grams: null,
      nutrients: null,
    });
  });

  it('carries the food and grams through recent and favourite foods', async () => {
    const user = await db.user();
    await food.logFood(user.supabaseId, {
      name: 'Blorvak pie',
      mealType: 'dinner',
      calories: 284,
      servingQty: 120,
      servingUnit: 'g',
      foodId: 'test_pie',
      grams: 120,
    });
    const [recent] = await quick.recent(user.supabaseId);
    expect(recent).toMatchObject({ foodId: 'test_pie', grams: 120 });

    const fav = await quick.save(user.supabaseId, {
      name: 'Blorvak pie',
      calories: 284,
      servingQty: 120,
      servingUnit: 'g',
      foodId: 'test_pie',
      grams: 120,
    });
    expect(fav).toMatchObject({ foodId: 'test_pie', grams: 120 });
    const missing = await quick.save(user.supabaseId, {
      name: 'Gone pie',
      calories: 284,
      foodId: 'fdc_removed',
    });
    expect(missing.foodId).toBeNull();
  });

  it('records barcode scans, hit or miss, for the hit rate by country', async () => {
    const user = await db.user();
    await food.lookupBarcode('049000028911', {
      supabaseId: user.supabaseId,
      country: 'GB',
    });
    // lookupBarcode records in the background
    await new Promise((r) => setTimeout(r, 200));
    const events = await db.prisma.searchEvent.findMany({
      where: { userId: user.id },
    });
    expect(events).toEqual([
      expect.objectContaining({
        kind: 'barcode',
        query: '0049000028911',
        resultCount: 1,
        country: 'GB',
      }),
    ]);
  });
});
