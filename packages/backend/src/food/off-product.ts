import type { FoodRecord } from './food-record';
import { checkDigitOk, normaliseBarcode } from './food-text';
import type { NutrientCode, NutrientValues } from './nutrients';

/**
 * Open Food Facts products as GRIT food records. Used by the barcode lookup
 * (which saves products it finds live) and by the importers in
 * packages/food-data, so both read OFF's data the same way.
 *
 * OFF stores every mass nutrient per 100 g in grams (iron 0.0027 = 2.7 mg),
 * energy in kcal and kJ, and alcohol as % vol. Drinks are per 100 ml, taken
 * as per 100 g (a density of about 1, as OFF itself does).
 *
 * Only label values are kept (from the packaging or the manufacturer):
 * OFF also estimates nutrients from ingredients, and Phase 7 shows measured
 * and label values only.
 */

type OffValue = number | string | null | undefined;

/** One nutrient in schema 1004's `nutrition.aggregated_set` */
interface OffAggregated {
  value?: OffValue;
  unit?: string;
  /** packaging | manufacturer | estimate (worked out by OFF from ingredients) */
  source?: string;
  /** "~" computed from other label values, "<" / "≤" less than */
  modifier?: string;
}

/**
 * A product document in either of OFF's shapes:
 * - legacy (API v0/v2, and CSV rows read into the same keys): nutrients in
 *   `nutriments["<id>_100g"]`;
 * - schema 1004 (the JSONL export, daily deltas, API v3.6): nutrients in
 *   `nutrition.aggregated_set`, each with the source it came from.
 */
export interface OffProductDoc {
  code?: string;
  product_name?: string;
  generic_name?: string;
  brands?: string | string[];
  categories_tags?: string[] | string;
  compared_to_category?: string;
  countries_tags?: string[] | string;
  ingredients_text?: string;
  serving_size?: string;
  serving_quantity?: OffValue;
  serving_quantity_unit?: string;
  nutriments?: Record<string, OffValue>;
  nutrition?: {
    aggregated_set?: {
      per?: string;
      preparation?: string;
      nutrients?: Record<string, OffAggregated>;
    };
  };
  unique_scans_n?: OffValue;
  completeness?: OffValue;
  states_tags?: string[] | string;
  data_quality_errors_tags?: string[] | string;
  last_modified_t?: OffValue;
  image_small_url?: string;
  image_front_small_url?: string;
  images?: {
    selected?: { front?: Record<string, { rev?: OffValue } | undefined> };
  };
  lang?: string;
  lc?: string;
  obsolete?: boolean | string;
  [key: string]: unknown;
}

function num(v: OffValue): number | undefined {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}

function list(v: string[] | string | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : v.split(',');
}

// [GRIT code, OFF key, multiplier from OFF's unit to GRIT's]
const NUTRIENT_KEYS: readonly [NutrientCode, string, number][] = [
  ['protein_g', 'proteins_100g', 1],
  ['carbs_g', 'carbohydrates_100g', 1],
  ['sugars_g', 'sugars_100g', 1],
  ['fat_g', 'fat_100g', 1],
  ['sat_fat_g', 'saturated-fat_100g', 1],
  ['fibre_g', 'fiber_100g', 1],
  ['sodium_mg', 'sodium_100g', 1000],
  ['vit_a_ug', 'vitamin-a_100g', 1e6],
  ['vit_c_mg', 'vitamin-c_100g', 1000],
  ['vit_d_ug', 'vitamin-d_100g', 1e6],
  ['vit_e_mg', 'vitamin-e_100g', 1000],
  ['vit_k_ug', 'vitamin-k_100g', 1e6],
  ['b1_mg', 'vitamin-b1_100g', 1000],
  ['b2_mg', 'vitamin-b2_100g', 1000],
  ['b3_mg', 'vitamin-pp_100g', 1000],
  ['b6_mg', 'vitamin-b6_100g', 1000],
  ['b12_ug', 'vitamin-b12_100g', 1e6],
  ['calcium_mg', 'calcium_100g', 1000],
  ['iron_mg', 'iron_100g', 1000],
  ['magnesium_mg', 'magnesium_100g', 1000],
  ['potassium_mg', 'potassium_100g', 1000],
  ['zinc_mg', 'zinc_100g', 1000],
  ['phosphorus_mg', 'phosphorus_100g', 1000],
  ['selenium_ug', 'selenium_100g', 1e6],
  ['caffeine_mg', 'caffeine_100g', 1000],
];

/** Per-100 g nutrients in GRIT's codes and units. */
/** The nutrients a label always has; enough when the rest may be estimates. */
const MAIN_NUTRIENTS = new Set<NutrientCode>([
  'kcal',
  'protein_g',
  'carbs_g',
  'sugars_g',
  'fat_g',
  'sat_fat_g',
  'fibre_g',
  'sodium_mg',
  'caffeine_mg',
  'alcohol_g',
]);

/** Per-100 g nutrients in GRIT's codes and units, from legacy `<id>_100g` keys. */
export function offNutrients(
  n: Record<string, OffValue> = {},
  options: { mainOnly?: boolean } = {},
): NutrientValues {
  const out: NutrientValues = {};
  // kcal as labelled, else from kJ (energy_100g is kJ too)
  const kcal =
    num(n['energy-kcal_100g']) ??
    kjToKcal(num(n['energy-kj_100g']) ?? num(n['energy_100g']));
  if (kcal !== undefined) out.kcal = kcal;
  for (const [code, key, factor] of NUTRIENT_KEYS) {
    const v = num(n[key]);
    if (v !== undefined) out[code] = v * factor;
  }
  // EU labels print salt, US labels sodium (salt = sodium × 2.5). When both
  // are there and disagree, the printed salt is the more reliable
  const salt = num(n['salt_100g']);
  if (salt !== undefined) {
    const fromSalt = (salt / 2.5) * 1000;
    if (
      out.sodium_mg === undefined ||
      (salt > 0 && Math.abs(out.sodium_mg - fromSalt) / fromSalt > 0.1)
    ) {
      out.sodium_mg = fromSalt;
    }
  }
  // Folate is labelled as either key
  const folate = num(n['folates_100g']) ?? num(n['vitamin-b9_100g']);
  if (folate !== undefined) out.folate_ug = folate * 1e6;
  // Alcohol as % vol → g per 100 g, taking a drink's density as about 1
  const abv = num(n['alcohol_100g']);
  if (abv !== undefined && abv >= 0 && abv <= 100) {
    out.alcohol_g = abv * 0.789;
  }
  if (options.mainOnly) {
    for (const code of Object.keys(out) as NutrientCode[]) {
      if (!MAIN_NUTRIENTS.has(code)) delete out[code];
    }
  }
  return out;
}

/**
 * Schema 1004's aggregated nutrients as legacy `<id>_100g` keys, keeping
 * only label values (not OFF's estimates from ingredients) and dropping
 * "less than" values. Values for a prepared product (soup made up with
 * water) aren't the product as sold, so none are kept.
 */
export function labelNutriments(
  nutrition: OffProductDoc['nutrition'],
): Record<string, number> {
  const agg = nutrition?.aggregated_set;
  const out: Record<string, number> = {};
  if (!agg?.nutrients) return out;
  if (agg.preparation && agg.preparation !== 'as_sold') return out;
  for (const [id, n] of Object.entries(agg.nutrients)) {
    if (!n || (n.source !== 'packaging' && n.source !== 'manufacturer')) {
      continue;
    }
    if (n.modifier === '<' || n.modifier === '≤') continue;
    const v = num(n.value);
    if (v !== undefined) out[`${id}_100g`] = v;
  }
  return out;
}

function kjToKcal(kj: number | undefined) {
  return kj === undefined ? undefined : kj / 4.184;
}

// ── Countries ────────────────────────────────────────────────────────────────

// OFF's country tags are English names ("en:united-kingdom"). These differ
// from the names Intl gives for their ISO codes.
const COUNTRY_EXCEPTIONS: Record<string, string> = {
  'czech-republic': 'cz',
  czechia: 'cz',
  'hong-kong': 'hk',
  macau: 'mo',
  macao: 'mo',
  'ivory-coast': 'ci',
  'cote-d-ivoire': 'ci',
  'democratic-republic-of-the-congo': 'cd',
  'republic-of-the-congo': 'cg',
  'north-macedonia': 'mk',
  'republic-of-macedonia': 'mk',
  'vatican-city': 'va',
  palestine: 'ps',
  'state-of-palestine': 'ps',
  'south-korea': 'kr',
  'north-korea': 'kp',
  'east-timor': 'tl',
  'timor-leste': 'tl',
  myanmar: 'mm',
  burma: 'mm',
  eswatini: 'sz',
  swaziland: 'sz',
  'cape-verde': 'cv',
  'the-bahamas': 'bs',
  'the-gambia': 'gm',
  'saint-pierre-and-miquelon': 'pm',
  'french-polynesia': 'pf',
  'new-caledonia': 'nc',
  reunion: 're',
  'russian-federation': 'ru',
  turkey: 'tr',
  turkiye: 'tr',
  'united-states-of-america': 'us',
  'great-britain': 'gb',
  'united-kingdom': 'gb',
  'saudi-arabia': 'sa',
  'united-arab-emirates': 'ae',
};

const slug = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// Codes Intl still names but that aren't countries today, or that share a
// name with a current code ("FX" is Metropolitan France)
const NOT_COUNTRIES = new Set([
  // Retired codes that share a name with a current one
  'AN',
  'BU',
  'CS',
  'DD',
  'DY',
  'FX',
  'HV',
  'NH',
  'RH',
  'SU',
  'TP',
  'UK',
  'VD',
  'YD',
  'YU',
  'ZR',
  // Groupings, not countries
  'EU',
  'EZ',
  'QO',
  'UN',
  'ZZ',
  'XA',
  'XB',
]);

let countryBySlug: Map<string, string> | null = null;

function countryMap() {
  if (countryBySlug) return countryBySlug;
  const names = new Intl.DisplayNames(['en'], { type: 'region' });
  const map = new Map<string, string>();
  const A = 'A'.charCodeAt(0);
  for (let i = 0; i < 26; i++) {
    for (let j = 0; j < 26; j++) {
      const code = String.fromCharCode(A + i, A + j);
      if (NOT_COUNTRIES.has(code)) continue;
      const name = names.of(code);
      const key = name && name !== code ? slug(name) : null;
      if (key && !map.has(key)) map.set(key, code.toLowerCase());
    }
  }
  for (const [k, v] of Object.entries(COUNTRY_EXCEPTIONS)) map.set(k, v);
  countryBySlug = map;
  return map;
}

/** "en:united-kingdom" → "gb"; tags that aren't a country are dropped. */
export function offCountries(tags: string[] | string | undefined): string[] {
  const map = countryMap();
  const out = new Set<string>();
  for (const raw of list(tags)) {
    const tag = raw.trim().replace(/^[a-z]{2}:/, '');
    const code = map.get(tag);
    if (code) out.add(code);
  }
  return [...out].sort();
}

// ── Records ──────────────────────────────────────────────────────────────────

const LANGS = [
  'en',
  'fr',
  'de',
  'es',
  'it',
  'nl',
  'pt',
  'pl',
  'sv',
  'fi',
  'da',
  'nb',
];

/** OFF marks withdrawn products obsolete; they're not foods to offer. */
export function isObsolete(doc: OffProductDoc) {
  return doc.obsolete === true || doc.obsolete === 'on';
}

// Not foods: vitamin tablets and supplements, often entered as % of a dose
const NOT_FOOD_CATEGORIES = new Set(['en:dietary-supplements', 'en:vitamins']);

/** The product's name: its main language's, then any. */
function nameOf(doc: OffProductDoc): string {
  const lang = doc.lang ?? doc.lc;
  const pick = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const byLang = lang ? pick(doc[`product_name_${lang}`]) : '';
  if (byLang) return byLang;
  if (pick(doc.product_name)) return pick(doc.product_name);
  if (pick(doc.product_name_en)) return pick(doc.product_name_en);
  for (const [key, value] of Object.entries(doc)) {
    if (/^product_name_[a-z]{2}$/.test(key) && pick(value)) return pick(value);
  }
  return pick(doc.generic_name);
}

/**
 * The front image at 200 px. Older documents carry the URL; schema 1004
 * documents only the image's revision, from which OFF builds the path
 * (the code padded to 13 digits, split 3/3/3/rest).
 */
export function offImageUrl(doc: OffProductDoc): string | null {
  if (doc.image_small_url) return doc.image_small_url;
  if (doc.image_front_small_url) return doc.image_front_small_url;
  const front = doc.images?.selected?.front;
  const code = (doc.code ?? '').trim();
  if (!front || !/^\d+$/.test(code)) return null;
  const lc = doc.lc ?? doc.lang;
  const lang = lc && front[lc] ? lc : Object.keys(front)[0];
  const rev = num(front[lang]?.rev);
  if (!lang || rev === undefined) return null;
  const padded = code.length < 13 ? code.padStart(13, '0') : code;
  const path = padded
    .match(/^(...)(...)(...)(.*)$/)!
    .slice(1)
    .join('/');
  return `https://images.openfoodfacts.org/images/products/${path}/front_${lang}.${rev}.200.jpg`;
}

/**
 * A food record for an OFF product, or null when it isn't one to import
 * (no barcode, obsolete, a supplement). Whether it's worth keeping (a
 * name and calories) is decided by cleanRecord.
 *
 * `mainNutrientsOnly` keeps energy, macros, sodium, caffeine and alcohol:
 * for sources that can't tell OFF's estimates from label values (the CSV
 * export), so vitamins and minerals from ingredients don't pass as labels.
 */
export function offRecord(
  doc: OffProductDoc,
  options: { mainNutrientsOnly?: boolean } = {},
): FoodRecord | null {
  const code = (doc.code ?? '').trim();
  if (!/^\d{8,14}$/.test(code)) return null;
  if (isObsolete(doc)) return null;
  const categories = list(doc.categories_tags).map((c) => c.trim());
  if (categories.some((c) => NOT_FOOD_CATEGORIES.has(c))) return null;

  const mainName = nameOf(doc);
  const names: { name: string; lang: string }[] = [];
  for (const l of LANGS) {
    const name = doc[`product_name_${l}`];
    if (typeof name === 'string' && name.trim() && name.trim() !== mainName) {
      names.push({ name: name.trim(), lang: l });
    }
  }

  const brands = Array.isArray(doc.brands)
    ? doc.brands
    : (doc.brands ?? '').split(',');
  const brand = brands.map((b) => b.trim()).find(Boolean) ?? null;

  const servingGrams = num(doc.serving_quantity);
  const unit = (doc.serving_quantity_unit ?? 'g').toLowerCase();
  const servings =
    servingGrams && servingGrams > 0 && (unit === 'g' || unit === 'ml')
      ? [
          {
            label: servingLabel(doc.serving_size),
            grams: servingGrams,
            typical: true,
          },
        ]
      : [];

  const states = list(doc.states_tags);
  const nutritionErrors = list(doc.data_quality_errors_tags).some((t) =>
    t.startsWith('en:nutrition-'),
  );
  const completeness = Math.min(1, Math.max(0, num(doc.completeness) ?? 0));
  const scans = num(doc.unique_scans_n) ?? 0;
  const quality = Math.max(
    0.1,
    Math.min(
      0.8,
      0.3 +
        (states.includes('en:nutrition-facts-completed') ? 0.2 : 0) +
        0.2 * completeness +
        (scans >= 5 ? 0.1 : 0),
    ) - (nutritionErrors ? 0.2 : 0),
  );

  // The most specific English category, else OFF's comparison category
  const englishCategory = categories.filter((c) => c.startsWith('en:')).at(-1);
  const category =
    (englishCategory ?? doc.compared_to_category)?.replace(/^[a-z]{2}:/, '') ??
    null;

  // A scanner checks the check digit, so a code that fails it can't be
  // scanned; codes starting 200 are OFF's own, for products with none
  const gtin = normaliseBarcode(code);
  const barcodes =
    gtin && checkDigitOk(gtin) && !gtin.startsWith('200') ? [code] : [];

  const nutriments = doc.nutrition?.aggregated_set
    ? labelNutriments(doc.nutrition)
    : (doc.nutriments ?? {});
  const modified = num(doc.last_modified_t);

  return {
    source: 'off',
    externalId: code,
    fetchedAt: new Date(modified ? modified * 1000 : 0),
    name: mainName,
    brand,
    kind: 'branded',
    category,
    ingredients: doc.ingredients_text ?? null,
    countries: offCountries(doc.countries_tags),
    barcodes,
    servings,
    nutrients: offNutrients(nutriments, {
      mainOnly: options.mainNutrientsOnly,
    }),
    basis: 'label',
    names,
    quality,
    verified: false,
    imageUrl: offImageUrl(doc),
  };
}

/**
 * The printed serving without its weight, which the app adds back:
 * "2 tbsp (37 g)" → "2 tbsp"; "37 g" or nothing → "1 serving".
 */
export function servingLabel(printed: string | undefined) {
  const text = (printed ?? '')
    .replace(/\(\s*[\d.,]+\s*(g|ml|gr|grams?)\s*\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text || /^[\d.,]+\s*(g|ml|gr|grams?)$/i.test(text) || text.length > 60) {
    return '1 serving';
  }
  return text;
}
