import { createReadStream, createWriteStream } from 'fs';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';
import { offFileInput, offJob } from '../jobs';
import { cleanRecord, type FoodRecord } from '../record';
import {
  deltasSince,
  offCsvPlan,
  offCsvDocs,
  offJsonlDocs,
  offRecords,
  openFile,
  parseDeltaIndex,
  type OffCounts,
} from './off';

// Real products (ODbL, © Open Food Facts contributors), cut down to the
// fields the importer reads: see the README
const DIR = join(__dirname, '../../fixtures/off');
const DELTA = join(DIR, 'openfoodfacts_products_1793860191_1793946243.json');
const CSV = join(DIR, 'en.openfoodfacts.org.products.sample.csv');

async function all<T>(items: AsyncIterable<T>) {
  const out: T[] = [];
  for await (const r of items) out.push(r);
  return out;
}

const newCounts = (): OffCounts => ({
  docs: 0,
  obsolete: 0,
  notFood: 0,
  filtered: 0,
});

describe('JSONL (export and daily deltas, schema 1004)', () => {
  let records: Map<string, FoodRecord>;
  const counts = newCounts();

  beforeAll(async () => {
    const list = await all(
      offRecords(offJsonlDocs(openFile(DELTA)), {}, counts),
    );
    records = new Map(list.map((r) => [r.externalId, r]));
  });

  it('reads every product, leaving out supplements and codes over 14 digits', () => {
    expect(counts).toEqual({ docs: 13, obsolete: 0, notFood: 2, filtered: 0 });
    expect(records.has('0681131928403')).toBe(false); // multivitamin
    expect(records.has('554335619328792')).toBe(false);
  });

  it("keeps label values only, in GRIT's units", () => {
    // Manufacturer + packaging sets, plus OFF's estimate from ingredients
    const tuna = records.get('3596710437771')!;
    expect(tuna).toMatchObject({
      source: 'off',
      name: 'Miettes de thon à la tomate',
      brand: 'Auchan',
      kind: 'branded',
      basis: 'label',
      verified: false,
      countries: ['fr'],
      fetchedAt: new Date(1793946175 * 1000), // last_modified_t
    });
    expect(tuna.nutrients).toEqual({
      kcal: 147,
      protein_g: 14,
      carbs_g: 4.2,
      sugars_g: 3.1,
      fat_g: 8,
      sat_fat_g: 1,
      fibre_g: 1.2,
      sodium_mg: 400,
      alcohol_g: 0,
    });
    // Estimated micronutrients aren't label values
    expect(tuna.nutrients.iron_mg).toBeUndefined();
    // Only an estimate set: no label energy, so not imported
    expect(cleanRecord(records.get('4311501130582')!)).toBeNull();
  });

  it('prefers printed salt when sodium disagrees, and converts % vol', () => {
    // Sodium 0.0012 g but salt 1.2 g: salt / 2.5
    expect(records.get('4070308098005')!.nutrients.sodium_mg).toBeCloseTo(
      480,
      6,
    );
    // 4.3 % vol × 0.789
    expect(records.get('5056025475861')!.nutrients.alcohol_g).toBeCloseTo(
      4.3 * 0.789,
      6,
    );
  });

  it('normalises barcodes, leaving out ones that fail their check digit', () => {
    const eistee = cleanRecord(records.get('42430742')!)!;
    expect(eistee.barcodes).toEqual(['0000042430742']); // EAN-8 as GTIN-13
    expect(eistee.imageUrl).toBe(
      'https://images.openfoodfacts.org/images/products/000/004/243/0742/front_de.10.200.jpg',
    );
    expect(cleanRecord(records.get('0474029601099')!)!.barcodes).toEqual([]);
    expect(records.get('00759984')!.countries).toEqual(['gb']);
  });

  it('reads gzipped files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'off-'));
    try {
      const gz = join(dir, 'delta.json.gz');
      await pipeline(
        createReadStream(DELTA),
        createGzip(),
        createWriteStream(gz),
      );
      expect(await all(offJsonlDocs(openFile(gz)))).toHaveLength(13);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it('skips bad lines and obsolete products, reporting the obsolete codes', async () => {
    const lines = [
      JSON.stringify({
        code: '3017620422003',
        obsolete: 'on',
        product_name: 'Old',
      }),
      '{"code": "12345670", truncated',
      '',
    ];
    const stats = { bad: 0 };
    const counts = newCounts();
    const obsolete: string[] = [];
    const out = await all(
      offRecords(
        offJsonlDocs(Readable.from(lines.join('\n')), stats),
        { onObsolete: (c) => obsolete.push(c) },
        counts,
      ),
    );
    expect(out).toEqual([]);
    expect(stats.bad).toBe(1);
    expect(counts.obsolete).toBe(1);
    expect(obsolete).toEqual(['3017620422003']);
  });
});

describe('CSV export', () => {
  it('maps "<key>_100g" columns to nutriments', async () => {
    const tsv = [
      ['\uFEFFcode', 'url', 'product_name', 'energy-kcal_100g', 'iron_100g'],
      [
        '3017620422003',
        'https://world.openfoodfacts.org/',
        'Nutella "500 g"',
        '539',
        '',
      ],
      ['12345670', '', '', '', '', 'extra column'],
    ]
      .map((r) => r.join('\t'))
      .join('\r\n');
    expect(await all(offCsvDocs(Readable.from(tsv)))).toEqual([
      {
        code: '3017620422003',
        product_name: 'Nutella "500 g"', // quotes are text
        nutriments: { 'energy-kcal_100g': '539' },
      },
      { code: '12345670', nutriments: {} },
    ]);
    expect(() => offCsvPlan(['name', 'brand'])).toThrow(/no code column/);
  });

  it('reads the tab-separated export, main label nutrients only', async () => {
    const list = await all(
      offRecords(offCsvDocs(openFile(CSV)), { mainNutrientsOnly: true }),
    );
    expect(list).toHaveLength(11);
    const nutella = list.find((r) => r.externalId === '3017620422003')!;
    expect(nutella).toMatchObject({
      name: 'Nutella',
      brand: 'Nutella',
      countries: ['be', 'de', 'fr', 'lu'],
    });
    expect(nutella.nutrients).toMatchObject({
      kcal: 539,
      sugars_g: 56.3,
      fat_g: 30.9,
      sat_fat_g: 10.6,
    });
    expect(nutella.nutrients.sodium_mg).toBeCloseTo(42.8, 6); // 0.0428 g
    // The CSV has iron (0.0000612 g), but can't say whether it's OFF's estimate
    expect(nutella.nutrients.iron_mg).toBeUndefined();
    // Caffeine is a main nutrient: 0.01296 g per 100 ml
    const coke = list.find((r) => r.externalId === '0049000028911')!;
    expect(coke.nutrients.caffeine_mg).toBeCloseTo(12.96, 2);
    expect(coke.servings).toEqual([
      { label: '1 can', grams: 354.9, typical: true },
    ]);
  });

  it('filters by scans and country', async () => {
    const counts = newCounts();
    const popular = await all(
      offRecords(offCsvDocs(openFile(CSV)), { minScans: 20 }, counts),
    );
    expect(popular.map((r) => r.externalId).sort()).toEqual([
      '00001977',
      '00019101',
      '0009800895007',
      '0009800895250',
      '0011210000018',
      '3017620422003',
      '5000159484695',
    ]);
    expect(counts.filtered).toBe(4);
    const british = await all(
      offRecords(offCsvDocs(openFile(CSV)), { countries: ['gb'] }),
    );
    expect(british.map((r) => r.name)).toEqual([
      'SHORTBREAD all butter fingers',
    ]);
  });
});

describe('daily deltas', () => {
  const index = [
    'openfoodfacts_products_1793860191_1793946243.json.gz',
    'openfoodfacts_products_1793773764_1793860191.json.gz',
    'openfoodfacts_products_1793687333_1793773764.json.gz',
    'index.txt',
    '',
  ].join('\n');

  it('lists delta files oldest first and picks those after a time', () => {
    const files = parseDeltaIndex(index);
    expect(files.map((f) => f.from)).toEqual([
      1793687333, 1793773764, 1793860191,
    ]);
    expect(deltasSince(files, 1793800000).map((f) => f.name)).toEqual([
      'openfoodfacts_products_1793773764_1793860191.json.gz',
      'openfoodfacts_products_1793860191_1793946243.json.gz',
    ]);
    expect(deltasSince(files, 1793946243)).toEqual([]);
  });

  it("is a job that can't be used for a full import with filters", () => {
    const job = offJob('off', [offFileInput(DELTA)], {
      complete: true,
      minScans: 5,
    });
    expect(job.complete).toBe(false);
    expect(
      offJob('off', [offFileInput(DELTA)], { complete: true }).complete,
    ).toBe(true);
  });
});
