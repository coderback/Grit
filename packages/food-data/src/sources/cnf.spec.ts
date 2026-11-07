import { join } from 'path';
import { openArchive } from '../archive';
import { cnfFile, cnfJob } from '../jobs';
import { cleanRecord, type FoodRecord } from '../record';
import { FIXTURES } from '../test-fixtures';
import {
  cnfMeasureLabel,
  cnfNutrients,
  cnfRecords,
  cnfServings,
  CNF_SHA256,
} from './cnf';

// Real rows of the Canadian Nutrient File 2015 (Health Canada), as the
// release writes them: Latin-1, quoted where needed.

let records: FoodRecord[];
const byId = (id: string) => records.find((r) => r.externalId === id)!;

beforeAll(async () => {
  const archive = await openArchive(join(FIXTURES, 'cnf'));
  try {
    records = await cnfRecords(archive);
  } finally {
    archive.close();
  }
});

describe('CNF measures', () => {
  it('names measures without their weight', () => {
    expect(cnfMeasureLabel('250ml')).toBe('250 ml');
    expect(cnfMeasureLabel('100ml chopped or diced')).toBe(
      '100 ml, chopped or diced',
    );
    expect(cnfMeasureLabel('1 waffle (17.8cm dia)')).toBe(
      '1 waffle (17.8cm dia)',
    );
    // A weight alone isn't a portion's name
    expect(cnfMeasureLabel('85g')).toBeNull();
    expect(cnfMeasureLabel(' ')).toBeNull();
  });

  it('picks a typical serving', () => {
    const typical = (measures: [string, number][]) =>
      cnfServings(
        measures.map(([description, grams]) => ({ description, grams })),
      )
        .filter((s) => s.typical)
        .map((s) => s.label);
    // A countable unit over a weight
    expect(
      typical([
        ['1 shoot', 144],
        ['85g', 85],
        ['250ml', 127],
      ]),
    ).toEqual(['1 shoot']);
    // A weight is Canada's serving when there's nothing countable
    expect(
      typical([
        ['100g', 100],
        ['85g', 85],
        ['250ml', 250],
      ]),
    ).toEqual(['1 serving']);
    // CNF's own serving wins, and the weight isn't added beside it
    expect(
      cnfServings([
        { description: '1 serving', grams: 195 },
        { description: '30g', grams: 30 },
      ]),
    ).toEqual([{ label: '1 serving', grams: 195, typical: true }]);
    // Volumes only: the first that isn't 100 ml
    expect(
      typical([
        ['100ml', 103],
        ['15ml', 15.5],
        ['250ml', 259],
      ]),
    ).toEqual(['15 ml']);
    expect(cnfServings([])).toEqual([]);
  });
});

describe('CNF values', () => {
  it("converts CNF's nutrients to GRIT's", () => {
    expect(
      cnfNutrients(
        new Map([
          [268, 418.4], // kJ only
          [205, -0.2], // carbs by difference, below zero
          [324, 40], // vitamin D in IU only
          [417, 30], // total folacin without DFE
        ]),
      ),
    ).toEqual({
      kcal: expect.closeTo(100, 6) as number,
      carbs_g: 0,
      vit_d_ug: 1,
      folate_ug: 30,
    });
    // kcal, µg vitamin D and DFE win when present
    expect(
      cnfNutrients(
        new Map([
          [208, 50],
          [268, 209],
          [339, 1.2],
          [324, 48],
          [815, 40],
          [417, 30],
        ]),
      ),
    ).toEqual({ kcal: 50, vit_d_ug: 1.2, folate_ug: 40 });
  });
});

describe('CNF foods', () => {
  it('reads every food with its French name, group and servings', () => {
    expect(records).toHaveLength(7);
    expect(byId('61')).toMatchObject({
      source: 'cnf',
      name: 'Milk, fluid, partly skimmed, 2% M.F.',
      kind: 'generic',
      category: 'Dairy and Egg Products',
      countries: ['ca'],
      basis: 'measured',
      verified: true,
      quality: 1,
      fetchedAt: new Date('2015-10-30T00:00:00Z'),
      names: [
        { name: 'Lait, partiellement écrémé, liquide, 2% M.G.', lang: 'fr' },
      ],
      servings: [
        {
          label: '100 ml',
          grams: expect.closeTo(103.128, 3) as number,
          typical: false,
        },
        {
          label: '250 ml',
          grams: expect.closeTo(257.819, 3) as number,
          typical: true,
        },
      ],
    });
    expect(cleanRecord(byId('61'))!.nutrients).toMatchObject({
      kcal: 50,
      protein_g: 3.3,
      carbs_g: 4.8,
      fat_g: 1.98,
      calcium_mg: 120,
      vit_a_ug: 63,
      vit_d_ug: 1,
      b12_ug: 0.53,
      caffeine_mg: 0,
    });
  });

  it('marks mixed dishes, and decodes Latin-1', () => {
    expect(byId('2')).toMatchObject({
      name: 'Cheese souffle',
      kind: 'dish',
      category: 'Mixed Dishes',
      names: [{ name: 'Soufflé au fromage', lang: 'fr' }],
    });
    expect(byId('501999')).toMatchObject({
      name: 'Poutine',
      kind: 'dish',
      servings: expect.arrayContaining([
        { label: '1 serving', grams: 195, typical: true },
      ]) as unknown,
    });
  });

  it('skips measures the release has no name for', () => {
    // Eggnog's factors include a measure missing from MEASURE NAME
    expect(byId('55').servings!.map((s) => s.label)).toEqual([
      '100 ml',
      '125 ml',
      '250 ml',
    ]);
  });

  it('reads vitamin D in IU when there are no micrograms', () => {
    expect(byId('534').nutrients.vit_d_ug).toBeCloseTo(0.075);
  });
});

describe('the CNF release kept in data/', () => {
  it('is the file it was added as', async () => {
    // Throws if the zip changed (or is a Git LFS pointer, or truncated)
    const path = await cnfFile();
    expect(path).toMatch(/data[/\\]cnf-fcen-csv\.zip$/);
    expect(CNF_SHA256).toHaveLength(64);
  }, 60_000);

  it('imports from the zip as it is', async () => {
    const job = cnfJob(await cnfFile());
    let n = 0;
    let poutine: FoodRecord | undefined;
    for await (const r of job.records()) {
      n++;
      if (r.externalId === '501999') poutine = r;
    }
    expect(n).toBe(5690);
    expect(poutine).toMatchObject({ name: 'Poutine', kind: 'dish' });
  }, 60_000);
});
