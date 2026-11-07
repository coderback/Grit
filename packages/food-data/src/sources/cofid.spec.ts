import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { cofidFile, cofidJob } from '../jobs';
import { cleanRecord, type FoodRecord } from '../record';
import { writeCofidWorkbook } from '../test-fixtures';
import {
  cofidNumber,
  cofidRecords,
  readCofidWorkbook,
  type CofidSheets,
} from './cofid';

// Real rows of CoFID 2021. Contains public sector information licensed
// under the Open Government Licence v3.0.

let dir: string;
let path: string;
let sheets: CofidSheets;
let records: FoodRecord[];
const byName = (name: string) => records.find((r) => r.name === name)!;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'cofid-'));
  path = await writeCofidWorkbook(dir);
  sheets = await readCofidWorkbook(path);
  records = cofidRecords(sheets);
});

afterAll(async () => {
  await rm(dir, { recursive: true });
});

describe('CoFID values', () => {
  it('reads numbers, traces and missing values', () => {
    expect(cofidNumber('76.7')).toBe(76.7);
    expect(cofidNumber(1.1)).toBe(1.1);
    expect(cofidNumber('0.0')).toBe(0);
    expect(cofidNumber('2,5')).toBe(2.5);
    expect(cofidNumber('Tr')).toBe(0); // a trace
    expect(cofidNumber('N')).toBeUndefined(); // present, amount unknown
    expect(cofidNumber('')).toBeUndefined();
    expect(cofidNumber(null)).toBeUndefined();
    expect(cofidNumber('(0.07)')).toBeUndefined(); // an estimate
  });
});

describe('CoFID foods', () => {
  it('reads every food, joined across sheets', () => {
    expect(records).toHaveLength(39);
    const ackee = byName('Ackee, canned, drained');
    expect(ackee).toMatchObject({
      source: 'cofid',
      externalId: '13-145',
      kind: 'generic',
      category: 'Vegetables, general',
      countries: ['gb'],
      basis: 'measured',
      verified: true,
      quality: 1,
      fetchedAt: new Date('2021-03-19T00:00:00Z'),
    });
    expect(ackee.servings).toBeUndefined();
    expect(ackee.nutrients).toEqual({
      kcal: 151,
      protein_g: 2.9,
      carbs_g: 0.8,
      sugars_g: 0.8,
      fat_g: 15.2,
      // fibre: AOAC blank, NSP "N"; sat fat "N"; selenium "N"
      sodium_mg: 240,
      potassium_mg: 270,
      calcium_mg: 35,
      magnesium_mg: 40,
      phosphorus_mg: 47,
      iron_mg: 0.7,
      zinc_mg: 0.6,
      vit_c_mg: 30,
      vit_d_ug: 0,
      b1_mg: 0.03,
      b2_mg: 0.07,
      b3_mg: 0.6, // preformed niacin, not niacin equivalents (1.1)
      b6_mg: 0.06,
      b12_ug: 0,
      folate_ug: 41,
      // vitamin A: β-carotene is "N", so no RAE; vitamin E "N"; K blank
    });
  });

  it('takes AOAC fibre, else NSP, and traces as 0', () => {
    expect(byName('Agar, dried').nutrients).toMatchObject({
      carbs_g: 0, // "Tr"
      fibre_g: 81.1, // NSP: no AOAC value
    });
    // Both: AOAC wins
    expect(
      byName('Aubergine, flesh and skin, roasted in rapeseed oil').nutrients
        .fibre_g,
    ).toBe(5.1);
  });

  it('computes vitamin A as retinol + β-carotene / 12', () => {
    expect(byName('Cabbage, Chinese, raw').nutrients.vit_a_ug).toBeCloseTo(
      70 / 12,
      6,
    );
    expect(byName('Watercress, raw').nutrients.vit_a_ug).toBeCloseTo(
      1589 / 12,
      6,
    );
  });

  it('gives the two foods sharing code 13-669 their own ids', () => {
    const ids = records
      .filter((r) => r.externalId.startsWith('13-669'))
      .map((r) => r.externalId);
    expect(ids).toEqual([
      '13-669~aubergine-flesh-and-skin-roasted-in-rapeseed-oil',
      '13-669~watercress-raw',
    ]);
    expect(new Set(records.map((r) => r.externalId)).size).toBe(39);
  });

  it('takes drinks per 100 ml as per 100 g', () => {
    expect(byName('Wine, red').nutrients).toMatchObject({
      kcal: 76,
      alcohol_g: 10.7,
    });
    expect(byName('Spirits, 40% volume').nutrients.alcohol_g).toBe(31.7);
  });

  it("leaves out foods whose energy isn't known", () => {
    // kcal "N" (spices) or blank: dropped when cleaned
    expect(byName('Pepper, black').nutrients.kcal).toBeUndefined();
    expect(cleanRecord(byName('Pepper, black'))).toBeNull();
    // A trace of energy is 0, and kept
    expect(byName('Tea, black, infusion, average').nutrients.kcal).toBe(0);
    const dropped = records.filter((r) => !cleanRecord(r)).map((r) => r.name);
    expect(dropped).toEqual([
      'Allspice, ground',
      'Anise seeds',
      'Pepper, black',
      'Pork, spare ribs, Chinese barbecue, takeaway',
    ]);
  });

  it("stops when the sheets aren't in the same food order", () => {
    const vitamins = [...sheets.vitamins];
    [vitamins[3], vitamins[4]] = [vitamins[4], vitamins[3]];
    expect(() => cofidRecords({ ...sheets, vitamins })).toThrow(
      /same food order/,
    );
  });

  it('finds the workbook in a folder and runs as a job', async () => {
    expect(await cofidFile({ dir })).toBe(path);
    const job = cofidJob(path);
    const out: FoodRecord[] = [];
    for await (const r of job.records()) out.push(r);
    expect(out).toHaveLength(39);
    expect(job).toMatchObject({ source: 'cofid', prefix: '', complete: true });
  });
});
