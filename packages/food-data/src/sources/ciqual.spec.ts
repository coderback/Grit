import { join } from 'path';
import { Readable } from 'stream';
import { openArchive, openFiles } from '../archive';
import { ciqualJob } from '../jobs';
import { cleanRecord, type FoodRecord } from '../record';
import { FIXTURES } from '../test-fixtures';
import {
  ciqualNumber,
  ciqualNutrients,
  ciqualRecords,
  xmlRecords,
} from './ciqual';

// Real records of the ANSES-CIQUAL table 2025 (ANSES; Licence Ouverte /
// Etalab 2.0), as Recherche Data Gouv serves them.

const DIR = join(FIXTURES, 'ciqual');
let records: FoodRecord[];
const byId = (id: string) => records.find((r) => r.externalId === id)!;

beforeAll(async () => {
  const archive = await openArchive(DIR);
  try {
    records = await ciqualRecords(archive);
  } finally {
    archive.close();
  }
});

async function all<T>(items: AsyncIterable<T>) {
  const out: T[] = [];
  for await (const item of items) out.push(item);
  return out;
}

describe('CIQUAL values', () => {
  it('reads decimal commas and traces; unknowns are missing', () => {
    expect(ciqualNumber(' 59,7 ')).toBe(59.7);
    expect(ciqualNumber('274')).toBe(274);
    expect(ciqualNumber('traces')).toBe(0);
    // Below what the lab could measure: unknown, not zero
    expect(ciqualNumber('< 0,5')).toBeUndefined();
    expect(ciqualNumber('-')).toBeUndefined();
    expect(ciqualNumber(null)).toBeUndefined();
  });

  it("converts CIQUAL's constituents to GRIT's nutrients", () => {
    expect(
      ciqualNutrients(
        new Map([
          [327, 418.4], // kJ only
          [10004, 0.028], // salt in g, no sodium
          [51200, 10], // retinol and β-carotene, no RAE
          [51330, 120],
          [53100, 1.2], // vitamin E, no α-tocopherol
          [56700, 27.1], // total folate, no DFE
        ]),
      ),
    ).toEqual({
      kcal: expect.closeTo(100, 6) as number,
      sodium_mg: expect.closeTo(11.2, 6) as number,
      vit_a_ug: 20,
      vit_e_mg: 1.2,
      folate_ug: 27.1,
    });
    // The preferred constituent wins
    expect(
      ciqualNutrients(
        new Map([
          [328, 274],
          [327, 1140],
          [10110, 15],
          [10004, 1],
          [51104, 31.3],
          [51200, 10],
          [51330, 120],
          [71010, 0.5],
          [53100, 1.2],
          [56702, 40],
          [56700, 27.1],
        ]),
      ),
    ).toEqual({
      kcal: 274,
      sodium_mg: 15,
      vit_a_ug: 31.3,
      vit_e_mg: 0.5,
      folate_ug: 40,
    });
  });
});

describe('CIQUAL XML', () => {
  it('reads records split across chunks, with entities and missing values', async () => {
    const xml =
      '﻿<?xml version="1.0" encoding="utf-8" ?>\n<TABLE>\n' +
      '   <ALIM>\n      <alim_code> 5002 </alim_code>\n' +
      '      <alim_nom_eng> Beer, strong (&gt;8° alcohol) </alim_nom_eng>\n' +
      '      <alim_nom_sci missing=" " />\n   </ALIM>\n' +
      '   <ALIM>\n      <alim_code> 7603 </alim_code>\n' +
      '      <alim_nom_eng> Croissant (average) </alim_nom_eng>\n   </ALIM>\n' +
      '</TABLE>\n';
    // Three bytes at a time: tags, entities and "°" are all split
    const bytes = Buffer.from(xml);
    const chunks: Buffer[] = [];
    for (let i = 0; i < bytes.length; i += 3)
      chunks.push(bytes.subarray(i, i + 3));
    expect(await all(xmlRecords(Readable.from(chunks), 'ALIM'))).toEqual([
      {
        alim_code: '5002',
        alim_nom_eng: 'Beer, strong (>8° alcohol)',
        alim_nom_sci: null,
      },
      { alim_code: '7603', alim_nom_eng: 'Croissant (average)' },
    ]);
  });
});

describe('CIQUAL foods', () => {
  it('reads every food with its French name and subgroup', () => {
    expect(records).toHaveLength(9);
    expect(byId('7603')).toMatchObject({
      source: 'ciqual',
      name: 'Croissant (average)',
      kind: 'generic',
      category: 'Viennese pastries',
      countries: ['fr'],
      basis: 'measured',
      verified: true,
      fetchedAt: new Date('2025-11-19T00:00:00Z'),
      names: [
        { name: 'Croissant, sans précision (aliment moyen)', lang: 'fr' },
      ],
    });
    expect(cleanRecord(byId('7603'))!.nutrients).toMatchObject({
      kcal: 417,
      protein_g: 6.56,
      carbs_g: 46.2,
      fat_g: 22.1,
      sat_fat_g: 14,
      sodium_mg: 478,
      vit_a_ug: 149,
    });
    expect(byId('5002').name).toBe('Beer, strong (>8° alcohol)');
  });

  it('marks starters and dishes', () => {
    expect(byId('25601')).toMatchObject({
      name: 'Tuna salad, with vegetables, canned',
      kind: 'dish',
      category: 'Mixed salads',
    });
  });

  it('keeps traces as zero and unknown amounts out', () => {
    // Kir's selenium is "< 20" µg: not zero, not 20
    expect(byId('1018').nutrients.selenium_ug).toBeUndefined();
    expect(byId('1000').nutrients.alcohol_g).toBe(37.5);
    // Fresh mango juice gives salt, not sodium
    expect(byId('2023').nutrients.sodium_mg).toBeCloseTo(11.2);
  });

  it("leaves out foods without energy when they're cleaned", () => {
    expect(cleanRecord(byId('1010'))).toBeNull();
    expect(records.map(cleanRecord).filter(Boolean)).toHaveLength(8);
  });

  it('reads downloaded files as well as a folder', async () => {
    const files = ['alim', 'alim_grp', 'compo'].map((n) =>
      join(DIR, `${n}_2025_11_03.xml`),
    );
    const archive = openFiles('CIQUAL', files);
    expect(archive.find(/^compo_/)).toBe('compo_2025_11_03.xml');
    archive.close();
    expect(await all(ciqualJob(files).records())).toHaveLength(9);
  });
});
