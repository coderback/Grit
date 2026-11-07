import { join } from 'path';
import { openArchive } from '../archive';
import { fineliFile, fineliJob } from '../jobs';
import { cleanRecord, type FoodRecord } from '../record';
import { FIXTURES } from '../test-fixtures';
import {
  fineliNumber,
  fineliNutrients,
  fineliRecords,
  fineliServings,
  sentenceCase,
} from './fineli';

// Real rows of Fineli release 20, basic package 2 (Finnish Institute for
// Health and Welfare, THL; CC BY 4.0), as the release writes them:
// semicolons, Latin-1, CRLF, decimal commas.

let records: FoodRecord[];
const byId = (id: string) => records.find((r) => r.externalId === id)!;

beforeAll(async () => {
  const archive = await openArchive(join(FIXTURES, 'fineli'));
  try {
    records = await fineliRecords(archive);
  } finally {
    archive.close();
  }
});

describe('Fineli values', () => {
  it('reads decimal commas, and blanks as missing', () => {
    expect(fineliNumber('1698,30')).toBe(1698.3);
    expect(fineliNumber('0')).toBe(0);
    expect(fineliNumber('')).toBeUndefined();
    expect(fineliNumber(undefined)).toBeUndefined();
  });

  it('writes names in sentence case', () => {
    expect(sentenceCase('RYE BREAD, 51% RYE')).toBe('Rye bread, 51% rye');
    expect(sentenceCase('RUISLEIPÄ,  RUISTA 51%')).toBe(
      'Ruisleipä, ruista 51%',
    );
    expect(sentenceCase('SMOOTHIE, FRUIT +VITAMINS  D&C')).toBe(
      'Smoothie, fruit +vitamins D&C',
    );
  });

  it("converts Fineli's components to GRIT's nutrients", () => {
    expect(
      fineliNutrients(
        new Map([
          ['ENERC', 418.4], // kJ only
          ['CHOAVL', 18.3],
          ['FIBC', 1.8],
          ['NACL', 1000], // salt in mg, no sodium
          ['VITPYRID', 0.5],
          ['WATER', 74.6], // not one of GRIT's
        ]),
      ),
    ).toEqual({
      kcal: expect.closeTo(100, 6) as number,
      carbs_g: 18.3,
      fibre_g: 1.8,
      sodium_mg: 400,
      b6_mg: 0.5,
    });
    // Sodium wins over salt
    expect(
      fineliNutrients(
        new Map([
          ['NA', 5],
          ['NACL', 12.74],
        ]),
      ).sodium_mg,
    ).toBe(5);
  });

  it('turns units into servings, one typical', () => {
    expect(
      fineliServings(
        new Map([
          ['PORTM', 125],
          ['KPL_M', 125],
          ['KG', 1000],
          ['PORT1000KJ', 285],
          ['RKL', 15],
        ]),
      ),
    ).toEqual([
      { label: '1 piece', grams: 125, typical: true },
      { label: '1 medium portion', grams: 125, typical: false },
      { label: '1 tbsp', grams: 15, typical: false },
    ]);
    // A product's own piece first
    expect(
      fineliServings(
        new Map([
          ['KPL_VALM', 40],
          ['KPL_M', 30],
        ]),
      ).find((s) => s.typical)?.label,
    ).toBe('1 piece, as sold');
    expect(fineliServings(new Map())).toEqual([]);
  });
});

describe('Fineli foods', () => {
  it('reads every food with its Finnish and Swedish names', () => {
    // Seven foods; the dietary supplement isn't one
    expect(records.map((r) => r.externalId).sort()).toEqual(
      ['1', '1013', '1036', '11049', '11184', '3327', '35629'].sort(),
    );
    expect(byId('11049')).toMatchObject({
      source: 'fineli',
      name: 'Banana, without skin',
      kind: 'generic',
      category: 'Fruits',
      countries: ['fi'],
      basis: 'measured',
      verified: true,
      fetchedAt: new Date('2019-08-08T00:00:00Z'),
      names: [
        { name: 'Banaani, kuorittu', lang: 'fi' },
        { name: 'Banan, skalad', lang: 'sv' },
      ],
    });
    expect(cleanRecord(byId('11049'))!.nutrients).toMatchObject({
      kcal: 87.58,
      protein_g: 1.2,
      carbs_g: 18.3,
      sugars_g: 13.5,
      fibre_g: 1.8,
      potassium_mg: 358.4,
      vit_c_mg: 10,
      folate_ug: 12.54,
    });
  });

  it('calls mixed dishes dishes, and recipes like bread foods', () => {
    expect(byId('3327')).toMatchObject({
      name: 'Moussaka, pork beef mince',
      kind: 'dish',
      category: 'Meat dishes',
    });
    // Fineli calls rye bread a dish: it's made from a recipe
    expect(byId('1036')).toMatchObject({
      name: 'Rye bread, 51% rye',
      kind: 'generic',
      category: 'Rye bread',
    });
  });

  it("leaves out foods without energy when they're cleaned", () => {
    expect(byId('11184').name).toBe('Cinnamon');
    expect(cleanRecord(byId('11184'))).toBeNull();
  });
});

describe('the Fineli release kept in data/', () => {
  it('is the file it was added as, and imports as it is', async () => {
    const path = await fineliFile();
    expect(path).toMatch(/data[/\\]Fineli_Rel20_74_ravintotekijaa\.zip$/);
    let n = 0;
    for await (const r of fineliJob(path).records()) {
      n++;
      expect(r.countries).toEqual(['fi']);
    }
    expect(n).toBe(4237);
  }, 60_000);
});
