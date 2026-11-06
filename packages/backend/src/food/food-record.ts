import {
  NUTRIENT_CODES,
  plausible,
  type NutrientBasis,
  type NutrientValues,
} from './nutrients';
import { normaliseBarcode, searchTextOf } from './food-text';

/** The sources GRIT imports, as stored in `food_sources.source`. */
export const SOURCES = [
  'fdc',
  'off',
  'cofid',
  'cnf',
  'ciqual',
  'fineli',
] as const;
export type SourceId = (typeof SOURCES)[number];

export type FoodKind = 'generic' | 'branded' | 'dish';

/** One food as a source describes it, before cleaning. Values per 100 g. */
export interface FoodRecord {
  source: SourceId;
  externalId: string;
  /** When the source last changed this row: its release date or last edit */
  fetchedAt: Date;
  name: string;
  brand?: string | null;
  kind: FoodKind;
  category?: string | null;
  ingredients?: string | null;
  /** ISO 3166-1 alpha-2, lowercase: where it's sold or which table lists it */
  countries: string[];
  barcodes?: string[];
  servings?: { label: string; grams: number; typical?: boolean }[];
  nutrients: NutrientValues;
  basis: Exclude<NutrientBasis, 'estimated'>;
  /** Other names, e.g. the French name in CIQUAL, by BCP 47 language */
  names?: { name: string; lang: string }[];
  /** 0–1 */
  quality: number;
  verified: boolean;
  imageUrl?: string | null;
}

/** A record ready to write: trimmed, checked and with its search text. */
export interface CleanRecord extends Required<
  Omit<
    FoodRecord,
    'brand' | 'category' | 'ingredients' | 'imageUrl' | 'servings'
  >
> {
  id: string;
  servings: { label: string; grams: number; typical: boolean }[];
  brand: string | null;
  category: string | null;
  ingredients: string | null;
  imageUrl: string | null;
  searchText: string;
  rank: number;
}

/**
 * Which source's values a food shows when several describe it: government
 * tables first, then USDA's branded products (from manufacturers), then
 * Open Food Facts (crowd-sourced).
 */
export function rankOf(source: string, kind: string) {
  if (source === 'off') return 1;
  if (source === 'fdc' && kind === 'branded') return 2;
  return 3;
}

/** The SQL twin of rankOf, for a row of `foods`. */
export const RANK_SQL = (alias: string) =>
  `(CASE WHEN ${alias}.source = 'off' THEN 1 WHEN ${alias}.source = 'fdc' AND ${alias}.kind = 'branded' THEN 2 ELSE 3 END)`;

/** A food's id: stable, so re-imports and other environments agree. */
export function foodIdOf(source: SourceId, externalId: string) {
  return `${source}_${externalId.replace(/[^A-Za-z0-9-]+/g, '-')}`;
}

// Postgres text can't hold NUL, and sources sometimes carry stray control
// characters or long runs of spaces
function text(value: string | null | undefined, max: number) {
  const s = (value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s ? s.slice(0, max).trim() : null;
}

/** Four significant figures: plenty for food data, and stable across runs. */
export function round4(n: number) {
  return n === 0 ? 0 : Number(n.toPrecision(4));
}

/**
 * Checks and tidies a record. Returns null for anything GRIT shouldn't
 * import: no name, no calories, or macros that can't be right (more than
 * 100 g of protein, carbs and fat in 100 g).
 */
export function cleanRecord(r: FoodRecord): CleanRecord | null {
  // As long as a log's or favourite's name may be
  const name = text(r.name, 200);
  if (!name) return null;

  const nutrients: NutrientValues = {};
  for (const code of NUTRIENT_CODES) {
    const v = plausible(code, r.nutrients[code]);
    if (v !== undefined) nutrients[code] = round4(v);
  }
  if (nutrients.kcal === undefined) return null;
  const macros =
    (nutrients.protein_g ?? 0) +
    (nutrients.carbs_g ?? 0) +
    (nutrients.fat_g ?? 0);
  if (macros > 105) return null;
  // Parts can't exceed their whole
  if (
    nutrients.sugars_g !== undefined &&
    nutrients.carbs_g !== undefined &&
    nutrients.sugars_g > nutrients.carbs_g + 0.5
  ) {
    delete nutrients.sugars_g;
  }
  if (
    nutrients.sat_fat_g !== undefined &&
    nutrients.fat_g !== undefined &&
    nutrients.sat_fat_g > nutrients.fat_g + 0.5
  ) {
    delete nutrients.sat_fat_g;
  }

  const brand = text(r.brand, 200);
  const barcodes = [
    ...new Set(
      (r.barcodes ?? [])
        .map((c) => normaliseBarcode(c))
        .filter((c): c is string => !!c),
    ),
  ];

  const servings: CleanRecord['servings'] = [];
  const labels = new Set<string>();
  for (const s of r.servings ?? []) {
    // Labels never carry the weight: the app shows "1 slice (28 g)"
    const label = text(
      s.label.replace(/\(\s*[\d.,]+\s*(g|ml)\s*\)\s*$/i, ''),
      120,
    );
    if (!label || !(s.grams > 0 && s.grams <= 5000)) continue;
    const key = label.toLowerCase();
    if (labels.has(key)) continue;
    labels.add(key);
    servings.push({ label, grams: round4(s.grams), typical: !!s.typical });
  }
  // At most one typical portion
  let typicalSeen = false;
  for (const s of servings) {
    if (s.typical && typicalSeen) s.typical = false;
    typicalSeen ||= s.typical;
  }

  const names: CleanRecord['names'] = [];
  const nameKeys = new Set<string>();
  for (const n of r.names ?? []) {
    const value = text(n.name, 300);
    const lang = text(n.lang, 20);
    if (!value || !lang) continue;
    const key = `${lang}|${value}`;
    if (nameKeys.has(key)) continue;
    nameKeys.add(key);
    names.push({ name: value, lang });
  }

  const countries = [
    ...new Set(r.countries.filter((c) => /^[a-z]{2}$/.test(c))),
  ].sort();

  return {
    id: foodIdOf(r.source, r.externalId),
    source: r.source,
    externalId: r.externalId,
    fetchedAt: r.fetchedAt,
    name,
    brand,
    kind: r.kind,
    category: text(r.category, 200),
    ingredients: text(r.ingredients, 4000),
    countries,
    barcodes,
    servings,
    nutrients,
    basis: r.basis,
    names,
    quality: round4(Math.min(1, Math.max(0, r.quality))),
    verified: r.verified,
    imageUrl: text(r.imageUrl, 500),
    searchText: searchTextOf(
      name,
      brand,
      names.map((n) => n.name),
    ),
    rank: rankOf(r.source, r.kind),
  };
}
