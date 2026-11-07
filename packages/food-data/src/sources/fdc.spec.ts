import { copyFile, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { openArchive } from '../archive';
import { fdcJobs, fdcFilesIn, parseFdcDatasets } from '../jobs';
import { cleanRecord, type FoodRecord } from '../record';
import {
  amountText,
  brandedGtin,
  brandedRecords,
  brandedServingLabel,
  fdcNutrients,
  latestFdcFiles,
  releaseDateOf,
} from './fdc';

// Real rows from USDA's releases (public domain), cut down: see the README
const DIR = join(__dirname, '../../fixtures/fdc');
const FOUNDATION = join(
  DIR,
  'FoodData_Central_foundation_food_json_2026-10-29.json',
);
const SR = join(DIR, 'FoodData_Central_sr_legacy_food_csv_2018-04.zip');
const FNDDS = join(DIR, 'FoodData_Central_survey_food_json_2024-10-31.json');
const BRANDED = join(DIR, 'FoodData_Central_branded_food_csv_2026-10-29');

async function all(records: AsyncIterable<FoodRecord>) {
  const out: FoodRecord[] = [];
  for await (const r of records) out.push(r);
  return out;
}

const byId = (records: FoodRecord[]) =>
  new Map(records.map((r) => [r.externalId, r]));

describe('Foundation + SR Legacy', () => {
  let records: Map<string, FoodRecord>;

  beforeAll(async () => {
    const [job] = fdcJobs({ foundation: FOUNDATION, sr: SR });
    records = byId(await all(job.records()));
  });

  it('makes one record per NDB number, Foundation and SR together', () => {
    // 7 Foundation foods + 10 SR foods, 4 of them the same NDB
    expect(records.size).toBe(13);
    const kale = records.get('ndb:11233')!;
    expect(kale).toMatchObject({
      source: 'fdc',
      name: 'Kale, raw', // Foundation's name
      kind: 'generic',
      category: 'Vegetables and Vegetable Products',
      countries: ['us'],
      basis: 'measured',
      verified: true,
      quality: 1,
      fetchedAt: new Date('2026-10-29T00:00:00Z'), // Foundation's release
    });
    // Foundation's values win (its kcal is 35; SR's was 49)…
    expect(kale.nutrients.kcal).toBe(35);
    expect(kale.nutrients.iron_mg).toBe(1.6);
    // …and SR fills what Foundation doesn't measure
    expect(kale.nutrients.folate_ug).toBe(62); // DFE: Foundation has none
    expect(kale.nutrients.caffeine_mg).toBe(0);
    expect(Object.keys(kale.nutrients)).toHaveLength(28);
  });

  it("keeps SR's name as another name when the wording differs", () => {
    const bokChoy = records.get('ndb:11116')!;
    expect(bokChoy.name).toBe('Cabbage, bok choy, raw');
    expect(bokChoy.names).toEqual([
      { name: 'Cabbage, chinese (pak-choi), raw', lang: 'en' },
    ]);
    // Foundation gives energy only as Atwater factors: the specific one
    expect(bokChoy.nutrients.kcal).toBe(17);
  });

  it('fills energy from SR when Foundation has none (oils)', () => {
    const canola = records.get('ndb:4582')!;
    expect(canola.name).toBe('Oil, canola');
    expect(canola.nutrients.kcal).toBe(884);
    expect(canola.nutrients.fat_g).toBe(94.5); // Foundation's, via 1085
  });

  it('reads an SR-only food: values, portions and its release date', () => {
    const bread = records.get('ndb:18967')!;
    expect(bread).toMatchObject({
      name: 'Bread, white wheat',
      category: 'Baked Products',
      fetchedAt: new Date('2018-04-01T00:00:00Z'),
      servings: [{ label: '1 slice', grams: 28, typical: true }],
    });
    expect(bread.nutrients).toMatchObject({
      kcal: 238,
      protein_g: 10.66,
      iron_mg: 4.89,
      sodium_mg: 478,
    });
    // Fractions, as people write them
    expect(records.get('ndb:6019')!.servings![0]).toEqual({
      label: '1/2 cup',
      grams: 124,
      typical: true,
    });
    expect(records.get('ndb:22903')!.servings![0].label).toBe(
      '1/4 pizza 12" diameter',
    );
    // Caffeine and alcohol come from SR only
    expect(records.get('ndb:14209')!.nutrients.caffeine_mg).toBe(40);
    expect(records.get('ndb:14003')!.nutrients.alcohol_g).toBe(3.9);
  });

  it('uses the RACC as the typical serving, labelled without grams', () => {
    const tomatoes = records.get('ndb:100147')!; // Foundation only
    expect(tomatoes.servings).toEqual([
      { label: '1 serving', grams: 85, typical: true },
      { label: '5 tomatoes', grams: 49.7, typical: false },
      { label: '1 cup', grams: 152, typical: false },
    ]);
    // Foundation's portions first; SR's after, deduplicated when cleaned
    const hummus = cleanRecord(records.get('ndb:16158')!)!;
    expect(hummus.servings.map((s) => s.label)).toEqual([
      '1 serving',
      '2 tbsp',
      '1 tbsp',
      '1 cup',
    ]);
  });

  it('clamps slightly negative carbs to 0 and drops foods without energy', () => {
    const drumstick = records.get('ndb:100372')!;
    expect(drumstick.nutrients.carbs_g).toBe(0); // -0.475 in the source
    expect(cleanRecord(drumstick)!.nutrients.carbs_g).toBe(0);
    // Butter: Foundation has no energy and the SR row isn't in the fixture
    expect(records.get('ndb:1001')!.nutrients.kcal).toBeUndefined();
    expect(cleanRecord(records.get('ndb:1001')!)).toBeNull();
  });
});

describe('FNDDS', () => {
  let records: Map<string, FoodRecord>;

  beforeAll(async () => {
    const [job] = fdcJobs({ fndds: FNDDS });
    records = byId(await all(job.records()));
  });

  it('keys foods by food code, with WWEIA mixed dishes as dishes', () => {
    expect([...records.keys()].sort()).toEqual([
      'fndds:11000000',
      'fndds:11100000',
      'fndds:58106230',
      'fndds:71501000',
    ]);
    expect(records.get('fndds:58106230')).toMatchObject({
      kind: 'dish',
      category: 'Pizza',
    });
    expect(records.get('fndds:11100000')).toMatchObject({
      name: 'Milk, NFS',
      kind: 'generic',
      category: 'Milk, reduced fat',
      fetchedAt: new Date('2024-10-31T00:00:00Z'),
    });
  });

  it('makes "Quantity not specified" the typical serving and drops guideline amounts', () => {
    const milk = records.get('fndds:11100000')!;
    expect(milk.servings).toEqual([
      { label: '1 serving', grams: 244, typical: true },
      { label: '1 cup', grams: 244, typical: false },
      { label: '1 fl oz', grams: 30.5, typical: false },
      { label: '1 individual school container', grams: 244, typical: false },
    ]);
    expect(milk.nutrients).toMatchObject({ kcal: 52, protein_g: 3.33 });
    expect(Object.keys(milk.nutrients)).toHaveLength(28);
  });

  it('drops human milk, which FNDDS gives no values for', () => {
    expect(cleanRecord(records.get('fndds:11000000')!)).toBeNull();
  });
});

describe('Branded', () => {
  let records: Map<string, FoodRecord>;

  beforeAll(async () => {
    const archive = await openArchive(BRANDED);
    try {
      records = byId(
        await all(
          brandedRecords(archive, {
            release: new Date('2026-10-29T00:00:00Z'),
          }),
        ),
      );
    } finally {
      archive.close();
    }
  });

  it("keys products by GTIN-13 and keeps each one's latest publication", () => {
    // 19 rows, two products listed twice
    expect(records.size).toBe(17);
    // 2020-11-13 "MANGO CHIA POD" over 2019-04-01 "SUN-RIPENED CHIA SEED…"
    expect(records.get('branded:9340224006671')!.name).toBe(
      'MANGO CHIA POD, MANGO',
    );
    expect(records.get('branded:9340224006671')!.barcodes).toEqual([
      '9340224006671',
    ]);
  });

  it('expands 8-digit UPC-E codes before normalising', () => {
    expect(brandedGtin('03106424')).toBe('0031200000644');
    const masala = records.get('branded:0031200000644')!;
    expect(masala).toMatchObject({
      name: 'INDIAN SPICES GARAM MASALA',
      brand: 'Ocean Spray Cranberries, Inc.', // brand_owner, no brand_name
      barcodes: ['0031200000644'],
    });
  });

  it('keeps a product whose code fails its check digit, but not as a barcode', () => {
    const sauce = records.get('branded:0813090000000')!;
    expect(sauce.name).toMatch(/^PINEAPPLE & ORANGE HABANERO HOT SAUCE/);
    expect(sauce.barcodes).toEqual([]);
  });

  it('reads label values per 100 g (or 100 ml), serving labels and vitamin D in IU', () => {
    const oil = records.get('branded:0027000612323')!;
    expect(oil).toMatchObject({
      kind: 'branded',
      basis: 'label',
      quality: 0.8,
      verified: true,
      countries: ['us'],
      category: 'Oils Edible',
      ingredients: 'Vegetable Oil',
      servings: [{ label: '1 tbsp', grams: 15, typical: true }],
      fetchedAt: new Date('2026-10-29T00:00:00Z'),
    });
    expect(oil.nutrients.kcal).toBe(867); // per 100 ml, taken as 100 g
    expect(records.get('branded:0051000198808')!.servings).toEqual([
      { label: '1 serving', grams: 240, typical: true },
    ]);
    // 164 IU per 100 g at 40 IU per µg
    expect(
      records.get('branded:0020735136393')!.nutrients.vit_d_ug,
    ).toBeCloseTo(4.1, 6);
  });

  it("stops when the files aren't in the same food order", async () => {
    const dir = await mkdtemp(join(tmpdir(), 'branded-'));
    try {
      for (const f of ['branded_food.csv', 'food_nutrient.csv']) {
        await copyFile(join(BRANDED, f), join(dir, f));
      }
      const lines = (await readFile(join(BRANDED, 'food.csv'), 'utf8'))
        .trimEnd()
        .split('\n');
      [lines[1], lines[2]] = [lines[2], lines[1]];
      await writeFile(join(dir, 'food.csv'), lines.join('\n') + '\n');
      const archive = await openArchive(dir);
      try {
        await expect(
          all(brandedRecords(archive, { release: new Date() })),
        ).rejects.toThrow(/food order/);
      } finally {
        archive.close();
      }
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});

describe('helpers', () => {
  it('maps nutrient ids with fallbacks', () => {
    const values = new Map([
      [2047, 120],
      [2048, 110],
      [1005, -0.3],
      [1110, 40],
      [1104, 500], // vitamin A in IU: not convertible
      [1177, 90], // total folate: not DFE
    ]);
    expect(fdcNutrients(values)).toEqual({
      kcal: 110,
      carbs_g: 0,
      vit_d_ug: 1,
    });
  });

  it('formats amounts and household servings', () => {
    expect(amountText(0.5)).toBe('1/2');
    expect(amountText(1.5)).toBe('1 1/2');
    expect(amountText(0.33)).toBe('1/3');
    expect(amountText(2)).toBe('2');
    expect(amountText(5.3)).toBe('5.3');
    expect(brandedServingLabel('1 ONZ')).toBe('1 oz');
    expect(brandedServingLabel('2 SLICES')).toBe('2 slices');
    expect(brandedServingLabel('0.5 cup')).toBe('1/2 cup');
    expect(brandedServingLabel('4.00 Ounces')).toBe('4 oz');
    expect(brandedServingLabel('1 Bottle (295ml)')).toBe('1 Bottle');
    expect(brandedServingLabel('PER CONTAINER')).toBe('1 serving');
    expect(brandedServingLabel('None')).toBe('1 serving');
    expect(brandedServingLabel('')).toBe('1 serving');
  });

  it('finds the newest release of each dataset on the download page', () => {
    const html = [
      'FoodData_Central_foundation_food_json_2026-04-30.zip',
      'FoodData_Central_foundation_food_json_2026-10-29.zip',
      'FoodData_Central_foundation_food_csv_2026-10-29.zip',
      'FoodData_Central_sr_legacy_food_csv_2018-04.zip',
      'FoodData_Central_survey_food_json_2022-10-28.zip',
      'FoodData_Central_survey_food_json_2024-10-31.zip',
      'FoodData_Central_branded_food_csv_2026-10-29.zip',
    ]
      .map((f) => `<a href="/fdc-datasets/${f}" download>`)
      .join('\n');
    expect(latestFdcFiles(html)).toEqual({
      foundation: 'FoodData_Central_foundation_food_json_2026-10-29.zip',
      sr: 'FoodData_Central_sr_legacy_food_csv_2018-04.zip',
      fndds: 'FoodData_Central_survey_food_json_2024-10-31.zip',
      branded: 'FoodData_Central_branded_food_csv_2026-10-29.zip',
    });
    expect(
      releaseDateOf('x/FoodData_Central_sr_legacy_food_csv_2018-04.zip'),
    ).toEqual(new Date('2018-04-01T00:00:00Z'));
    expect(releaseDateOf('foods.json')).toBeNull();
  });

  it('imports Foundation and SR Legacy together', async () => {
    expect(parseFdcDatasets(undefined)).toEqual(['foundation', 'sr', 'fndds']);
    expect(parseFdcDatasets('sr')).toEqual(['foundation', 'sr']);
    expect(parseFdcDatasets('branded,fndds')).toEqual(['fndds', 'branded']);
    expect(() => parseFdcDatasets('legacy')).toThrow(/Unknown dataset/);
    expect(() => fdcJobs({ sr: SR })).toThrow(/together/);
    expect(await fdcFilesIn(DIR)).toEqual({
      foundation: FOUNDATION,
      sr: SR,
      fndds: FNDDS,
      branded: BRANDED,
    });
  });
});
