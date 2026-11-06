import { basename } from 'path';
import type { Readable } from 'stream';
import {
  checkDigitOk,
  expandUpcE,
  normaliseBarcode,
} from '../../../backend/src/food/food-text';
import type {
  NutrientCode,
  NutrientValues,
} from '../../../backend/src/food/nutrients';
import { readText, type Archive } from '../archive';
import { csvObjects, csvTable } from '../csv';
import type { FoodRecord } from '../record';

/**
 * USDA FoodData Central (public domain): Foundation, SR Legacy, FNDDS
 * (survey foods) and Branded. Keys are stable across USDA's releases,
 * whose fdc_ids change when a food is revised:
 *
 * - Foundation and SR Legacy describe the same foods by NDB number, so
 *   they become one record per NDB, `ndb:<NDB>`: Foundation's values (newer,
 *   analytical) where it has them, SR's for the rest, Foundation's name;
 * - FNDDS: `fndds:<food code>`;
 * - Branded: `branded:<GTIN-13>`, keeping a product's latest publication.
 *
 * Values are per 100 g (Branded drinks per 100 ml, taken as per 100 g).
 */

export const FDC_DATASETS = ['foundation', 'sr', 'fndds', 'branded'] as const;
export type FdcDataset = (typeof FDC_DATASETS)[number];

/** Where USDA lists its downloads, and the files it serves. */
export const FDC_INDEX_URL = 'https://fdc.nal.usda.gov/download-datasets';
export const FDC_FILES_URL = 'https://fdc.nal.usda.gov/fdc-datasets/';

const FILE_PATTERNS: Record<FdcDataset, RegExp> = {
  // The JSON: the 2026-10-29 Foundation CSV zip is missing its food files
  foundation: /FoodData_Central_foundation_food_json_(\d{4}-\d{2}-\d{2})\.zip/g,
  sr: /FoodData_Central_sr_legacy_food_csv_(\d{4}-\d{2}(?:-\d{2})?)\.zip/g,
  // The JSON: the CSV's food_nutrient.nutrient_id holds nutrient numbers
  fndds: /FoodData_Central_survey_food_json_(\d{4}-\d{2}-\d{2})\.zip/g,
  branded: /FoodData_Central_branded_food_csv_(\d{4}-\d{2}-\d{2})\.zip/g,
};

/** The releases current on 2026-11-06, for when the index can't be read. */
export const FDC_DEFAULT_FILES: Record<FdcDataset, string> = {
  foundation: 'FoodData_Central_foundation_food_json_2026-10-29.zip',
  sr: 'FoodData_Central_sr_legacy_food_csv_2018-04.zip',
  fndds: 'FoodData_Central_survey_food_json_2024-10-31.zip',
  branded: 'FoodData_Central_branded_food_csv_2026-10-29.zip',
};

/** The newest file of each dataset linked from USDA's download page. */
export function latestFdcFiles(html: string): Partial<Record<FdcDataset, string>> {
  const out: Partial<Record<FdcDataset, string>> = {};
  for (const dataset of FDC_DATASETS) {
    let best: [string, string] | null = null;
    for (const m of html.matchAll(FILE_PATTERNS[dataset])) {
      if (!best || m[1] > best[1]) best = [m[0], m[1]];
    }
    if (best) out[dataset] = best[0];
  }
  return out;
}

/** Which dataset a local file or folder is, from USDA's file name. */
export function fdcDatasetOf(path: string): FdcDataset | null {
  const name = basename(path);
  if (/foundation/i.test(name)) return 'foundation';
  if (/sr_legacy/i.test(name)) return 'sr';
  if (/survey|fndds/i.test(name)) return 'fndds';
  if (/branded/i.test(name)) return 'branded';
  return null;
}

/** A release date from a file name: "…_2026-10-29.zip", "…_2018-04.zip". */
export function releaseDateOf(path: string): Date | null {
  const matches = [
    ...basename(path).matchAll(/(\d{4})-(\d{2})(?:-(\d{2}))?(?!\d)/g),
  ];
  const m = matches.at(-1);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, m[3] ? +m[3] : 1));
}

// ── Nutrients ────────────────────────────────────────────────────────────────

/** FDC nutrient ids for each GRIT code, first present wins. */
const NUTRIENT_IDS: readonly [NutrientCode, readonly number[]][] = [
  // Energy: 1008, else Atwater specific (matches 1008's method), else general
  ['kcal', [1008, 2048, 2047]],
  ['protein_g', [1003]],
  ['carbs_g', [1005, 1050]],
  ['sugars_g', [2000, 1063]],
  ['fat_g', [1004, 1085]],
  ['sat_fat_g', [1258]],
  ['fibre_g', [1079, 2033]],
  ['sodium_mg', [1093]],
  // RAE only: IU (1104) can't be converted without the carotenoid split
  ['vit_a_ug', [1106]],
  ['vit_c_mg', [1162]],
  ['vit_d_ug', [1114]],
  ['vit_e_mg', [1109]],
  ['vit_k_ug', [1185]],
  ['b1_mg', [1165]],
  ['b2_mg', [1166]],
  ['b3_mg', [1167]],
  ['b6_mg', [1175]],
  ['b12_ug', [1178]],
  // DFE only: total folate (1177) understates fortified foods
  ['folate_ug', [1190]],
  ['calcium_mg', [1087]],
  ['iron_mg', [1089]],
  ['magnesium_mg', [1090]],
  ['potassium_mg', [1092]],
  ['zinc_mg', [1095]],
  ['phosphorus_mg', [1091]],
  ['selenium_ug', [1103]],
  ['caffeine_mg', [1057]],
  ['alcohol_g', [1018]],
];

/** The FDC nutrient ids the importer reads; other rows are skipped early. */
export const FDC_NUTRIENT_IDS = new Set([
  ...NUTRIENT_IDS.flatMap(([, ids]) => ids),
  1110,
]);

/** FDC values (nutrient id → amount per 100 g) in GRIT's codes and units. */
export function fdcNutrients(values: ReadonlyMap<number, number>): NutrientValues {
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
  // Vitamin D in IU when there's no µg value (Branded labels): 40 IU = 1 µg
  if (out.vit_d_ug === undefined && values.has(1110)) {
    out.vit_d_ug = values.get(1110)! * 0.025;
  }
  // Carbs by difference go slightly negative on some fatty meats
  if (out.carbs_g !== undefined && out.carbs_g < 0) out.carbs_g = 0;
  return out;
}

function amountOf(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v as string));
  return Number.isFinite(n) ? n : undefined;
}

// ── Portions ─────────────────────────────────────────────────────────────────

interface Portion {
  label: string;
  grams: number;
  typical: boolean;
  seq: number;
}

const FRACTIONS: [number, string][] = [
  [1 / 2, '1/2'],
  [1 / 3, '1/3'],
  [2 / 3, '2/3'],
  [1 / 4, '1/4'],
  [3 / 4, '3/4'],
  [1 / 5, '1/5'],
  [1 / 6, '1/6'],
  [1 / 8, '1/8'],
  [1 / 12, '1/12'],
];

/** 0.5 → "1/2", 1.5 → "1 1/2", 2 → "2", 5.3 → "5.3". */
export function amountText(n: number): string {
  const whole = Math.floor(n + 1e-9);
  const frac = n - whole;
  if (frac < 0.005) return String(whole);
  const f = FRACTIONS.find(([v]) => Math.abs(frac - v) < 0.01);
  if (f) return whole ? `${whole} ${f[1]}` : f[1];
  return String(Number(n.toFixed(3)));
}

const UNIT_NAMES: Record<string, string> = {
  tablespoon: 'tbsp',
  teaspoon: 'tsp',
  milliliter: 'ml',
  liter: 'l',
};

const tidy = (s: string | null | undefined) =>
  (s ?? '')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s+/g, ' ')
    .trim();

interface FoundationPortion {
  amount?: number | null;
  gramWeight?: number | null;
  sequenceNumber?: number | null;
  modifier?: string | null;
  portionDescription?: string | null;
  measureUnit?: { id?: number; name?: string } | null;
}

/**
 * Foundation: "<amount> <unit>[, <modifier>]" ("1 cup, chopped"); the RACC
 * (the reference amount customarily consumed) is "1 serving", the typical
 * portion.
 */
function foundationPortion(p: FoundationPortion): Portion | null {
  const grams = amountOf(p.gramWeight);
  if (!grams || grams <= 0) return null;
  const seq = p.sequenceNumber ?? 99;
  const unitName = tidy(p.measureUnit?.name);
  if (p.measureUnit?.id === 1121 || unitName === 'RACC') {
    return { label: '1 serving', grams, typical: true, seq: -1 };
  }
  const unit = UNIT_NAMES[unitName.toLowerCase()] ?? unitName.toLowerCase();
  let modifier = tidy(p.modifier || p.portionDescription).toLowerCase();
  if (/^nlea$|^[\d.]+$/.test(modifier)) modifier = '';
  const amount = amountOf(p.amount) ?? 1;
  const label = [
    `${amountText(amount)} ${unit === 'undetermined' ? '' : unit}`.trim(),
    modifier,
  ]
    .filter(Boolean)
    .join(', ');
  return label ? { label, grams, typical: false, seq } : null;
}

/** SR Legacy: the unit is in `modifier` ("1 slice", "1/2 cup, chopped"). */
function srPortion(row: Record<string, string>): Portion | null {
  const grams = amountOf(row.gram_weight);
  if (!grams || grams <= 0) return null;
  const amount = amountOf(row.amount);
  const unit = tidy(row.modifier || row.portion_description);
  if (!unit) return null;
  const label = amount && amount > 0 ? `${amountText(amount)} ${unit}` : unit;
  return { label, grams, typical: false, seq: amountOf(row.seq_num) ?? 99 };
}

/**
 * FNDDS: the whole phrase is in `portionDescription` ("1 cup"). Its
 * "Quantity not specified" is the survey's default amount: "1 serving",
 * typical. Amounts of one food per unit of another ("Guideline amount per
 * cup of hot cereal") and parts ("Topping from…") aren't portions of it.
 */
function fnddsPortion(p: FoundationPortion): Portion | null {
  const grams = amountOf(p.gramWeight);
  if (!grams || grams <= 0) return null;
  const text = tidy(p.portionDescription);
  if (!text || /^(guideline amount|topping from|skin from)/i.test(text)) {
    return null;
  }
  const seq = p.sequenceNumber ?? 99;
  if (/^quantity not specified$/i.test(text)) {
    return { label: '1 serving', grams, typical: true, seq: -1 };
  }
  return { label: text, grams, typical: false, seq };
}

/**
 * Servings in their source order with one typical: the source's own
 * (RACC, "Quantity not specified"), else the first by sequence number.
 */
function servingsOf(portions: (Portion | null)[]) {
  const list = portions
    .filter((p): p is Portion => !!p)
    .sort((a, b) => a.seq - b.seq);
  if (list.length && !list.some((p) => p.typical)) list[0].typical = true;
  return list.map(({ label, grams, typical }) => ({ label, grams, typical }));
}

// ── Foundation, SR Legacy and FNDDS ──────────────────────────────────────────

/** One food of a generic dataset, before it becomes a record. */
export interface FdcFood {
  dataset: 'foundation' | 'sr' | 'fndds';
  fdcId: number;
  /** NDB number (Foundation and SR) or FNDDS food code */
  key: string;
  name: string;
  category: string | null;
  /** FNDDS's WWEIA category number */
  wweia?: number;
  nutrients: NutrientValues;
  servings: { label: string; grams: number; typical: boolean }[];
}

interface JsonFood {
  fdcId: number;
  description: string;
  ndbNumber?: number | string;
  foodCode?: string;
  publicationDate?: string;
  foodCategory?: { description?: string };
  wweiaFoodCategory?: { wweiaFoodCategoryDescription?: string };
  foodNutrients?: { nutrient?: { id?: number }; amount?: number | null }[];
  foodPortions?: FoundationPortion[];
  foodAttributes?: { name?: string; value?: string }[];
}

async function readJsonFoods(archive: Archive, key: string) {
  const file = archive.find(/\.json$/i);
  if (!file) throw new Error(`${archive.path} has no .json file`);
  const doc = JSON.parse(await readText(archive, file)) as Record<
    string,
    JsonFood[] | undefined
  >;
  const foods = doc[key];
  if (!Array.isArray(foods)) {
    throw new Error(`${archive.path} has no "${key}" list`);
  }
  return foods;
}

function jsonNutrients(food: JsonFood) {
  const values = new Map<number, number>();
  for (const n of food.foodNutrients ?? []) {
    const id = n.nutrient?.id;
    const amount = amountOf(n.amount);
    if (id !== undefined && amount !== undefined) values.set(id, amount);
  }
  return fdcNutrients(values);
}

/** Foundation foods from the JSON release (`FoundationFoods`). */
export async function readFoundation(archive: Archive): Promise<FdcFood[]> {
  const foods = await readJsonFoods(archive, 'FoundationFoods');
  return foods
    .filter((f) => f.ndbNumber !== undefined && f.ndbNumber !== '')
    .map((f) => ({
      dataset: 'foundation' as const,
      fdcId: f.fdcId,
      key: String(f.ndbNumber),
      name: f.description,
      category: f.foodCategory?.description ?? null,
      nutrients: jsonNutrients(f),
      servings: servingsOf((f.foodPortions ?? []).map(foundationPortion)),
    }));
}

/** FNDDS survey foods from the JSON release (`SurveyFoods`). */
export async function readFndds(archive: Archive): Promise<FdcFood[]> {
  const foods = await readJsonFoods(archive, 'SurveyFoods');
  return foods
    .filter((f) => !!f.foodCode)
    .map((f) => {
      const wweia = f.foodAttributes?.find(
        (a) => a.name === 'WWEIA Category number',
      )?.value;
      return {
        dataset: 'fndds' as const,
        fdcId: f.fdcId,
        key: String(f.foodCode),
        name: f.description,
        category: f.wweiaFoodCategory?.wweiaFoodCategoryDescription ?? null,
        wweia: wweia ? Number(wweia) : undefined,
        nutrients: jsonNutrients(f),
        servings: servingsOf((f.foodPortions ?? []).map(fnddsPortion)),
      };
    });
}

async function* objects(archive: Archive, name: string) {
  yield* csvObjects(await archive.open(name));
}

/** SR Legacy foods from the CSV release. */
export async function readSrLegacy(archive: Archive): Promise<FdcFood[]> {
  const categories = new Map<string, string>();
  for await (const r of objects(archive, 'food_category.csv')) {
    categories.set(r.id, r.description);
  }
  const ndb = new Map<string, string>();
  for await (const r of objects(archive, 'sr_legacy_food.csv')) {
    ndb.set(r.fdc_id, r.NDB_number);
  }
  const foods = new Map<
    string,
    { food: FdcFood; values: Map<number, number>; portions: Portion[] }
  >();
  for await (const r of objects(archive, 'food.csv')) {
    const key = ndb.get(r.fdc_id);
    if (r.data_type !== 'sr_legacy_food' || !key) continue;
    foods.set(r.fdc_id, {
      food: {
        dataset: 'sr',
        fdcId: Number(r.fdc_id),
        key,
        name: r.description,
        category: categories.get(r.food_category_id) ?? null,
        nutrients: {},
        servings: [],
      },
      values: new Map(),
      portions: [],
    });
  }
  for await (const { row, col } of csvTable(
    await archive.open('food_nutrient.csv'),
    ['fdc_id', 'nutrient_id', 'amount'],
  )) {
    const f = foods.get(row[col.fdc_id]);
    const id = Number(row[col.nutrient_id]);
    const amount = amountOf(row[col.amount]);
    if (f && amount !== undefined && FDC_NUTRIENT_IDS.has(id)) {
      f.values.set(id, amount);
    }
  }
  for await (const r of objects(archive, 'food_portion.csv')) {
    const p = srPortion(r);
    if (p) foods.get(r.fdc_id)?.portions.push(p);
  }
  return [...foods.values()].map(({ food, values, portions }) => ({
    ...food,
    nutrients: fdcNutrients(values),
    servings: servingsOf(portions),
  }));
}

const FDC_COMMON = {
  source: 'fdc',
  countries: ['us'],
  verified: true,
} as const;

/**
 * One record per NDB number from Foundation and SR Legacy: Foundation's
 * name, category and values where it has them, SR's values for the rest,
 * and both lists of servings (Foundation's first, so its typical one
 * wins). SR's name is kept as another name when it differs, so older
 * wordings still find the food.
 */
export function mergeNdbFoods(
  foundation: FdcFood[],
  sr: FdcFood[],
  releases: { foundation?: Date; sr?: Date },
): FoodRecord[] {
  const byKey = new Map<string, { f?: FdcFood; s?: FdcFood }>();
  // When a release lists an NDB twice, the newest fdc_id is the current one
  const put = (food: FdcFood, side: 'f' | 's') => {
    const entry = byKey.get(food.key) ?? {};
    const old = entry[side];
    if (!old || food.fdcId > old.fdcId) entry[side] = food;
    byKey.set(food.key, entry);
  };
  for (const food of foundation) put(food, 'f');
  for (const food of sr) put(food, 's');

  const records: FoodRecord[] = [];
  const keys = [...byKey.keys()].sort((a, b) => Number(a) - Number(b));
  for (const key of keys) {
    const { f, s } = byKey.get(key)!;
    const main = (f ?? s)!;
    const servings = [...(f?.servings ?? []), ...(s?.servings ?? [])];
    // Foundation's typical portion when it has one
    let typicalSeen = false;
    const tidied = servings.map((v) => {
      const typical = v.typical && !typicalSeen;
      typicalSeen ||= typical;
      return { ...v, typical };
    });
    const dates = [f && releases.foundation, s && releases.sr].filter(
      (d): d is Date => !!d,
    );
    records.push({
      ...FDC_COMMON,
      countries: [...FDC_COMMON.countries],
      externalId: `ndb:${key}`,
      fetchedAt: new Date(Math.max(...dates.map((d) => d.getTime()), 0)),
      name: main.name,
      kind: 'generic',
      category: f?.category ?? s?.category ?? null,
      servings: tidied,
      nutrients: { ...(s?.nutrients ?? {}), ...(f?.nutrients ?? {}) },
      basis: 'measured',
      names:
        f && s && f.name.toLowerCase() !== s.name.toLowerCase()
          ? [{ name: s.name, lang: 'en' }]
          : [],
      quality: 1,
    });
  }
  return records;
}

/** WWEIA categories 3002–3808: mixed dishes, sandwiches, pizza, soups. */
export const isMixedDish = (wweia: number | undefined) =>
  wweia !== undefined && wweia >= 3002 && wweia <= 3808;

export function fnddsRecords(foods: FdcFood[], release: Date): FoodRecord[] {
  return foods.map((f) => ({
    ...FDC_COMMON,
    countries: [...FDC_COMMON.countries],
    externalId: `fndds:${f.key}`,
    fetchedAt: release,
    name: f.name,
    kind: isMixedDish(f.wweia) ? 'dish' : 'generic',
    category: f.category,
    servings: f.servings,
    nutrients: f.nutrients,
    basis: 'measured',
    quality: 1,
  }));
}

// ── Branded ──────────────────────────────────────────────────────────────────

/**
 * A Branded `gtin_upc` as GTIN-13: 8-digit codes in FDC are UPC-E (US),
 * expanded to UPC-A first; when one isn't a valid UPC-E it's read as EAN-8.
 */
export function brandedGtin(raw: string): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (digits.length === 8) {
    const upcA = expandUpcE(digits);
    if (upcA) return normaliseBarcode(upcA);
  }
  return normaliseBarcode(digits);
}

/**
 * A label's household serving without its weight, which the app adds:
 * "1 ONZ" → "1 oz", "0.5 cup" → "1/2 cup", "2 SLICES" → "2 slices";
 * "Amount per serving", "PER CONTAINER" and "None" → "1 serving".
 */
export function brandedServingLabel(household: string | undefined): string {
  let text = tidy(household)
    .replace(/\(\s*[\d.,]+\s*(g|ml|grams?|gr)\s*\)/gi, '')
    .trim();
  if (!text || /^(amount )?per\b|^none$|^amount per serving$/i.test(text)) {
    return '1 serving';
  }
  if (!/[a-z]/.test(text)) text = text.toLowerCase();
  text = text
    .replace(/\bonz\b/gi, 'oz')
    .replace(/\bounces?\b/gi, 'oz')
    .replace(/\btbsp\b/gi, 'tbsp')
    .replace(/\btsp\b/gi, 'tsp')
    .replace(/^(\d+(?:\.\d+)?)(?=\s|$)/, (n) => amountText(parseFloat(n)));
  return text.length > 60 ? '1 serving' : text;
}

/** Days since 1970 of a "YYYY-MM-DD" date, or 0. */
function dayOf(date: string | undefined) {
  const t = Date.parse(`${date ?? ''}T00:00:00Z`);
  return Number.isFinite(t) ? Math.floor(t / 86_400_000) : 0;
}

/**
 * Reads several CSV files of one release in step. USDA writes Branded's
 * branded_food.csv, food.csv and food_nutrient.csv in the same food order
 * (not sorted by fdc_id), food_nutrient.csv grouped by food, so they're
 * joined as streams without holding them in memory. A food out of step
 * is an error, never a silent mismatch.
 */
class Follower<C extends string> {
  private iter: AsyncGenerator<{ row: string[]; col: Record<C, number> }>;
  private pending: string[] | null = null;
  private idCol = -1;
  private done = false;
  private passed = new Set<string>();

  constructor(
    private name: string,
    input: Readable,
    columns: readonly C[],
  ) {
    this.iter = csvTable(input, [...columns, 'fdc_id' as C]);
  }

  /** The rows for this food id, if the next rows are its. */
  async take(fdcId: string, col?: (c: Record<C, number>) => void) {
    const rows: string[][] = [];
    for (;;) {
      if (!this.pending) {
        if (this.done) break;
        const next = await this.iter.next();
        if (next.done) {
          this.done = true;
          break;
        }
        if (this.idCol < 0) {
          this.idCol = next.value.col['fdc_id' as C];
          col?.(next.value.col);
        }
        this.pending = next.value.row;
      }
      const id = this.pending[this.idCol];
      if (id !== fdcId) {
        if (this.passed.has(id)) {
          throw new Error(
            `${this.name} isn't in the same food order as branded_food.csv (fdc_id ${id})`,
          );
        }
        break;
      }
      rows.push(this.pending);
      this.pending = null;
    }
    this.passed.add(fdcId);
    return rows;
  }

  async close() {
    await this.iter.return(undefined);
  }
}

export interface BrandedOptions {
  release: Date;
  log?: (line: string) => void;
}

const BRANDED_COLUMNS = [
  'fdc_id',
  'brand_owner',
  'brand_name',
  'gtin_upc',
  'ingredients',
  'serving_size',
  'serving_size_unit',
  'household_serving_fulltext',
  'branded_food_category',
  'market_country',
] as const;

/**
 * Pass 1: which fdc_id is each GTIN's current version. USDA lists a
 * product again when it's updated; the latest publication date wins,
 * then the highest fdc_id. Kept as GTIN → day × 1e8 + fdc_id.
 */
async function latestVersions(archive: Archive) {
  const published = new Follower('food.csv', await archive.open('food.csv'), [
    'publication_date',
  ] as const);
  let pubCol = -1;
  const best = new Map<string, number>();
  try {
    for await (const { row, col } of csvTable(
      await archive.open('branded_food.csv'),
      ['fdc_id', 'gtin_upc'] as const,
    )) {
      const fdcId = row[col.fdc_id];
      const food = await published.take(fdcId, (c) => {
        pubCol = c.publication_date;
      });
      const gtin = brandedGtin(row[col.gtin_upc]);
      if (!gtin) continue;
      const rank = dayOf(food[0]?.[pubCol]) * 1e8 + Number(fdcId);
      if ((best.get(gtin) ?? -1) < rank) best.set(gtin, rank);
    }
  } finally {
    await published.close();
  }
  return best;
}

/**
 * Branded foods, streamed: two passes over the release (about 1 GB of
 * branded_food.csv and 1.5 GB of food_nutrient.csv, uncompressed), with
 * only a GTIN → version map in memory.
 */
export async function* brandedRecords(
  archive: Archive,
  options: BrandedOptions,
): AsyncGenerator<FoodRecord> {
  options.log?.('Branded: finding each product’s latest version…');
  const latest = await latestVersions(archive);
  options.log?.(`Branded: ${latest.size} products with a GTIN`);

  const foods = new Follower('food.csv', await archive.open('food.csv'), [
    'description',
  ] as const);
  const nutrients = new Follower(
    'food_nutrient.csv',
    await archive.open('food_nutrient.csv'),
    ['nutrient_id', 'amount'] as const,
  );
  let descCol = -1;
  let nIdCol = -1;
  let nAmountCol = -1;
  try {
    for await (const { row, col } of csvTable(
      await archive.open('branded_food.csv'),
      BRANDED_COLUMNS,
    )) {
      const fdcId = row[col.fdc_id];
      const food = await foods.take(fdcId, (c) => {
        descCol = c.description;
      });
      const rows = await nutrients.take(fdcId, (c) => {
        nIdCol = c.nutrient_id;
        nAmountCol = c.amount;
      });

      const gtin = brandedGtin(row[col.gtin_upc]);
      if (gtin && (latest.get(gtin) ?? 0) % 1e8 !== Number(fdcId)) continue;

      const values = new Map<number, number>();
      for (const n of rows) {
        const id = Number(n[nIdCol]);
        const amount = amountOf(n[nAmountCol]);
        if (amount !== undefined && FDC_NUTRIENT_IDS.has(id)) {
          values.set(id, amount);
        }
      }
      const grams = amountOf(row[col.serving_size]);
      const unit = row[col.serving_size_unit].toLowerCase();
      yield {
        ...FDC_COMMON,
        countries: [...FDC_COMMON.countries],
        externalId: gtin ? `branded:${gtin}` : `branded:fdc${fdcId}`,
        fetchedAt: options.release,
        name: food[0]?.[descCol] ?? '',
        brand: row[col.brand_name] || row[col.brand_owner] || null,
        kind: 'branded',
        category: row[col.branded_food_category] || null,
        ingredients: row[col.ingredients] || null,
        barcodes: gtin && checkDigitOk(gtin) ? [gtin] : [],
        servings:
          grams && (unit === 'g' || unit === 'ml' || unit === 'grm')
            ? [
                {
                  label: brandedServingLabel(
                    row[col.household_serving_fulltext],
                  ),
                  grams,
                  typical: true,
                },
              ]
            : [],
        // Per 100 g, or per 100 ml for drinks, taken as 100 g
        nutrients: fdcNutrients(values),
        basis: 'label',
        quality: 0.8,
      };
    }
  } finally {
    await foods.close();
    await nutrients.close();
  }
}
