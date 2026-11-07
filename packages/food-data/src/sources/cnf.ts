import type {
  NutrientCode,
  NutrientValues,
} from '../../../backend/src/food/nutrients';
import type { Archive } from '../archive';
import { csvObjects } from '../csv';
import type { FoodRecord } from '../record';

/**
 * Canada's CNF: the Canadian Nutrient File 2015 (Health Canada; Open
 * Government Licence – Canada). Health Canada's site refuses servers, so
 * the release zip, as downloaded in a browser, is kept in this package
 * (data/) and checked by its SHA-256.
 *
 * Relational CSV files (Latin-1, quoted where needed): FOOD NAME (English
 * and French names, food group), NUTRIENT AMOUNT (one row per food and
 * nutrient, per 100 g), CONVERSION FACTOR (each measure's weight as a
 * multiple of 100 g) and MEASURE NAME. NutrientID is the key, not
 * NutrientCode: they differ for newer nutrients (RAE is ID 814, code 320).
 */

export const CNF_FILE = 'cnf-fcen-csv.zip';
export const CNF_SHA256 =
  'fb77503d88186844cc2c27b39432d755505f97a789c97fc5973a30d0cd4b0367';
/** The newest values in the 2015 release (NUTRIENT AMOUNT, 30 Oct 2015) */
export const CNF_RELEASE = new Date('2015-10-30T00:00:00Z');

const FILES = {
  foods: 'FOOD NAME.csv',
  groups: 'FOOD GROUP.csv',
  amounts: 'NUTRIENT AMOUNT.csv',
  factors: 'CONVERSION FACTOR.csv',
  measures: 'MEASURE NAME.csv',
};

/** CNF NutrientIDs for each GRIT code, first present wins. */
const NUTRIENT_IDS: readonly [NutrientCode, readonly number[]][] = [
  ['kcal', [208]],
  ['protein_g', [203]],
  // Total carbohydrate by difference: includes fibre, as USDA's does
  ['carbs_g', [205]],
  ['sugars_g', [269]],
  ['fat_g', [204]],
  ['sat_fat_g', [606]],
  ['fibre_g', [291]],
  ['alcohol_g', [221]],
  ['sodium_mg', [307]],
  ['potassium_mg', [306]],
  ['calcium_mg', [301]],
  ['magnesium_mg', [304]],
  ['phosphorus_mg', [305]],
  ['iron_mg', [303]],
  ['zinc_mg', [309]],
  ['selenium_ug', [317]],
  ['vit_a_ug', [814]], // RAE
  ['vit_c_mg', [401]],
  ['vit_d_ug', [339]], // D2 + D3
  ['vit_e_mg', [323]], // α-tocopherol
  ['vit_k_ug', [430]],
  ['b1_mg', [404]],
  ['b2_mg', [405]],
  ['b3_mg', [406]], // preformed niacin
  ['b6_mg', [415]],
  ['b12_ug', [418]],
  // DFE, else total folacin
  ['folate_ug', [815, 417]],
  ['caffeine_mg', [262]],
];

/** Fast Foods and Mixed Dishes */
const DISH_GROUPS = new Set(['21', '22']);

const KJ = 268;
const VIT_D_IU = 324;

export const CNF_NUTRIENT_IDS = new Set([
  ...NUTRIENT_IDS.flatMap(([, ids]) => ids),
  KJ,
  VIT_D_IU,
]);

/** CNF values (NutrientID → amount per 100 g) in GRIT's codes and units. */
export function cnfNutrients(
  values: ReadonlyMap<number, number>,
): NutrientValues {
  const out: NutrientValues = {};
  for (const [code, ids] of NUTRIENT_IDS) {
    for (const id of ids) {
      const v = values.get(id);
      if (v !== undefined) {
        out[code] = v;
        break;
      }
    }
  }
  if (out.kcal === undefined && values.has(KJ)) {
    out.kcal = values.get(KJ)! / 4.184;
  }
  // 40 IU = 1 µg
  if (out.vit_d_ug === undefined && values.has(VIT_D_IU)) {
    out.vit_d_ug = values.get(VIT_D_IU)! * 0.025;
  }
  // Carbs by difference go slightly negative on some fatty meats
  if (out.carbs_g !== undefined && out.carbs_g < 0) out.carbs_g = 0;
  return out;
}

function number(s: string | undefined): number | undefined {
  const t = (s ?? '').trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(t)) return undefined;
  return Number(t);
}

const tidy = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/**
 * A CNF measure as a serving label: "250ml chopped or diced" → "250 ml,
 * chopped or diced", "1 waffle (17.8cm dia)" as it is. A weight alone
 * ("85g") returns null: it isn't a portion's name.
 */
export function cnfMeasureLabel(description: string): string | null {
  const s = tidy(description);
  if (!s) return null;
  const m = /^(\d+(?:\.\d+)?)\s*(ml|g)\b\s*(.*)$/i.exec(s);
  if (!m) return s;
  const [, amount, unit, rest] = m;
  if (unit.toLowerCase() === 'g' && !rest) return null;
  return `${amount} ${unit.toLowerCase()}${rest ? `, ${rest}` : ''}`;
}

interface Measure {
  label: string;
  grams: number;
}

/**
 * Servings from a food's measures, in CNF's order. Weights alone are
 * dropped, except that the first one other than 100 g becomes "1 serving"
 * when CNF has none (its "85g" for meat is Canada's serving). Typical:
 * CNF's own "1 serving", else the first "1 <unit>" (a slice, a waffle),
 * else that weight, else the first measure other than 100 ml (15 ml of a
 * dressing, 250 ml of milk), else the first.
 */
export function cnfServings(
  measures: readonly { description: string; grams: number }[],
): NonNullable<FoodRecord['servings']> {
  const out: Measure[] = [];
  let weight: Measure | undefined;
  for (const m of measures) {
    if (!(m.grams > 0)) continue;
    const label = cnfMeasureLabel(m.description);
    if (label) {
      out.push({ label, grams: m.grams });
    } else if (!weight && Math.abs(m.grams - 100) > 0.01) {
      weight = { label: '1 serving', grams: m.grams };
    }
  }
  const own = out.find((s) => /^1 serving$/i.test(s.label));
  if (own) weight = undefined;
  const typical =
    own ??
    out.find((s) => /^1 \D/.test(s.label)) ??
    weight ??
    out.find((s) => !/^100 ml$/.test(s.label)) ??
    out[0];
  // The serving from a weight goes first when it's the typical one
  const list = weight
    ? weight === typical
      ? [weight, ...out]
      : [...out, weight]
    : out;
  return list.map((s) => ({ ...s, typical: s === typical }));
}

/** The CNF release as records: reads the files it needs from the zip. */
export async function cnfRecords(archive: Archive): Promise<FoodRecord[]> {
  const read = async (name: string) =>
    csvObjects(await archive.open(name), { encoding: 'latin1' });

  const groups = new Map<string, string>();
  for await (const r of await read(FILES.groups)) {
    groups.set(r.FoodGroupID, tidy(r.FoodGroupName));
  }
  const measureNames = new Map<string, string>();
  for await (const r of await read(FILES.measures)) {
    measureNames.set(r.MeasureID, r.MeasureDescription);
  }

  const values = new Map<string, Map<number, number>>();
  for await (const r of await read(FILES.amounts)) {
    const id = Number(r.NutrientID);
    if (!CNF_NUTRIENT_IDS.has(id)) continue;
    const v = number(r.NutrientValue);
    if (v === undefined) continue;
    let food = values.get(r.FoodID);
    if (!food) values.set(r.FoodID, (food = new Map<number, number>()));
    food.set(id, v);
  }

  const measures = new Map<string, { description: string; grams: number }[]>();
  for await (const r of await read(FILES.factors)) {
    const description = measureNames.get(r.MeasureID);
    const factor = number(r.ConversionFactorValue);
    // A few factors name measures the release doesn't list
    if (!description || factor === undefined) continue;
    let list = measures.get(r.FoodID);
    if (!list) measures.set(r.FoodID, (list = []));
    list.push({ description, grams: factor * 100 });
  }

  const records: FoodRecord[] = [];
  for await (const r of await read(FILES.foods)) {
    const id = tidy(r.FoodID);
    if (!id) continue;
    const french = tidy(r.FoodDescriptionF);
    records.push({
      source: 'cnf',
      externalId: id,
      fetchedAt: CNF_RELEASE,
      name: tidy(r.FoodDescription),
      kind: DISH_GROUPS.has(tidy(r.FoodGroupID)) ? 'dish' : 'generic',
      category: groups.get(r.FoodGroupID) ?? null,
      countries: ['ca'],
      servings: cnfServings(measures.get(r.FoodID) ?? []),
      nutrients: cnfNutrients(
        values.get(r.FoodID) ?? new Map<number, number>(),
      ),
      basis: 'measured',
      names: french ? [{ name: french, lang: 'fr' }] : [],
      quality: 1,
      verified: true,
    });
  }
  return records;
}
