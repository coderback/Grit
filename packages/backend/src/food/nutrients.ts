/**
 * The 28 nutrients GRIT's food database tracks. Every value in
 * `food_nutrients` and every `FoodLog.nutrients` snapshot uses these codes,
 * in these units, per 100 g in the database and per eaten amount in a log.
 *
 * Shared by the backend and the importers in packages/food-data, which map
 * each source's own nutrient ids to these codes.
 */

export type NutrientGroup = 'energy' | 'vitamin' | 'mineral' | 'other';

/**
 * - target: more is better up to a daily target (vitamins, minerals, fibre);
 * - limit: an upper amount to stay under (sodium, saturated fat);
 * - none: shown as a number only (energy, macros, sugars, caffeine,
 *   alcohol). Sugars have no limit because the advice is about added
 *   sugars, which labels and tables rarely give.
 */
export type NutrientKind = 'target' | 'limit' | 'none';

export interface NutrientInfo {
  code: string;
  name: string;
  unit: 'kcal' | 'g' | 'mg' | 'µg';
  group: NutrientGroup;
  kind: NutrientKind;
}

export const NUTRIENTS = [
  // Energy and macros
  { code: 'kcal', name: 'Energy', unit: 'kcal', group: 'energy', kind: 'none' },
  {
    code: 'protein_g',
    name: 'Protein',
    unit: 'g',
    group: 'energy',
    kind: 'none',
  },
  { code: 'carbs_g', name: 'Carbs', unit: 'g', group: 'energy', kind: 'none' },
  {
    code: 'sugars_g',
    name: 'Sugars',
    unit: 'g',
    group: 'energy',
    kind: 'none',
  },
  { code: 'fat_g', name: 'Fat', unit: 'g', group: 'energy', kind: 'none' },
  {
    code: 'sat_fat_g',
    name: 'Saturated fat',
    unit: 'g',
    group: 'energy',
    kind: 'limit',
  },
  {
    code: 'fibre_g',
    name: 'Fibre',
    unit: 'g',
    group: 'energy',
    kind: 'target',
  },
  {
    code: 'sodium_mg',
    name: 'Sodium',
    unit: 'mg',
    group: 'energy',
    kind: 'limit',
  },
  // Vitamins
  {
    code: 'vit_a_ug',
    name: 'Vitamin A',
    unit: 'µg',
    group: 'vitamin',
    kind: 'target',
  },
  {
    code: 'vit_c_mg',
    name: 'Vitamin C',
    unit: 'mg',
    group: 'vitamin',
    kind: 'target',
  },
  {
    code: 'vit_d_ug',
    name: 'Vitamin D',
    unit: 'µg',
    group: 'vitamin',
    kind: 'target',
  },
  {
    code: 'vit_e_mg',
    name: 'Vitamin E',
    unit: 'mg',
    group: 'vitamin',
    kind: 'target',
  },
  {
    code: 'vit_k_ug',
    name: 'Vitamin K',
    unit: 'µg',
    group: 'vitamin',
    kind: 'target',
  },
  {
    code: 'b1_mg',
    name: 'Thiamin (B1)',
    unit: 'mg',
    group: 'vitamin',
    kind: 'target',
  },
  {
    code: 'b2_mg',
    name: 'Riboflavin (B2)',
    unit: 'mg',
    group: 'vitamin',
    kind: 'target',
  },
  {
    code: 'b3_mg',
    name: 'Niacin (B3)',
    unit: 'mg',
    group: 'vitamin',
    kind: 'target',
  },
  {
    code: 'b6_mg',
    name: 'Vitamin B6',
    unit: 'mg',
    group: 'vitamin',
    kind: 'target',
  },
  {
    code: 'b12_ug',
    name: 'Vitamin B12',
    unit: 'µg',
    group: 'vitamin',
    kind: 'target',
  },
  {
    code: 'folate_ug',
    name: 'Folate',
    unit: 'µg',
    group: 'vitamin',
    kind: 'target',
  },
  // Minerals
  {
    code: 'calcium_mg',
    name: 'Calcium',
    unit: 'mg',
    group: 'mineral',
    kind: 'target',
  },
  {
    code: 'iron_mg',
    name: 'Iron',
    unit: 'mg',
    group: 'mineral',
    kind: 'target',
  },
  {
    code: 'magnesium_mg',
    name: 'Magnesium',
    unit: 'mg',
    group: 'mineral',
    kind: 'target',
  },
  {
    code: 'potassium_mg',
    name: 'Potassium',
    unit: 'mg',
    group: 'mineral',
    kind: 'target',
  },
  {
    code: 'zinc_mg',
    name: 'Zinc',
    unit: 'mg',
    group: 'mineral',
    kind: 'target',
  },
  {
    code: 'phosphorus_mg',
    name: 'Phosphorus',
    unit: 'mg',
    group: 'mineral',
    kind: 'target',
  },
  {
    code: 'selenium_ug',
    name: 'Selenium',
    unit: 'µg',
    group: 'mineral',
    kind: 'target',
  },
  // Other
  {
    code: 'caffeine_mg',
    name: 'Caffeine',
    unit: 'mg',
    group: 'other',
    kind: 'none',
  },
  {
    code: 'alcohol_g',
    name: 'Alcohol',
    unit: 'g',
    group: 'other',
    kind: 'none',
  },
] as const satisfies readonly NutrientInfo[];

export type NutrientCode = (typeof NUTRIENTS)[number]['code'];

export const NUTRIENT_CODES: readonly NutrientCode[] = NUTRIENTS.map(
  (n) => n.code,
);

const BY_CODE = new Map<string, NutrientInfo>(
  NUTRIENTS.map((n) => [n.code, n]),
);

export function nutrientInfo(code: string): NutrientInfo | undefined {
  return BY_CODE.get(code);
}

export function isNutrientCode(code: string): code is NutrientCode {
  return BY_CODE.has(code);
}

/** The vitamins and minerals: what a "micronutrient profile" means. */
export const MICRONUTRIENTS: readonly NutrientCode[] = NUTRIENTS.filter(
  (n) => n.group === 'vitamin' || n.group === 'mineral',
).map((n) => n.code);

/** Where a value comes from. Only measured and label values are shown in Phase 7. */
export type NutrientBasis = 'measured' | 'label' | 'estimated';

/** Per 100 g, by code. */
export type NutrientValues = Partial<Record<NutrientCode, number>>;

/** A logged amount's nutrients, as stored in `FoodLog.nutrients`. */
export type NutrientSnapshot = Partial<
  Record<NutrientCode, { amount: number; basis: NutrientBasis }>
>;

/**
 * Plausible upper bounds per 100 g, to drop values a source got wrong by a
 * unit (mg stored as g, kJ as kcal). Anything above is treated as missing.
 */
export const MAX_PER_100G: Record<NutrientCode, number> = {
  kcal: 902, // pure fat is about 900
  protein_g: 100,
  carbs_g: 100,
  sugars_g: 100,
  fat_g: 100,
  sat_fat_g: 100,
  fibre_g: 100,
  sodium_mg: 40_000, // table salt is about 39 g
  vit_a_ug: 100_000, // cod liver oil is about 30,000
  vit_c_mg: 5_000, // acerola powder is a few thousand
  vit_d_ug: 1_000, // cod liver oil is about 250
  vit_e_mg: 500,
  vit_k_ug: 5_000,
  b1_mg: 100,
  b2_mg: 100,
  b3_mg: 500,
  b6_mg: 100,
  b12_ug: 1_000, // clams and liver reach about 100
  folate_ug: 10_000, // fortified cereals and yeast reach a few thousand
  calcium_mg: 10_000, // baking powder is about 7,400
  iron_mg: 500,
  magnesium_mg: 5_000,
  potassium_mg: 20_000,
  zinc_mg: 500,
  phosphorus_mg: 10_000,
  selenium_ug: 10_000, // brazil nuts are about 1,900
  caffeine_mg: 10_000, // instant coffee powder is about 3,000–5,000
  alcohol_g: 80, // spirits at 100% vol would be 79
};

/** A value within its plausible range, or undefined. */
export function plausible(code: NutrientCode, value: unknown) {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return typeof n === 'number' &&
    Number.isFinite(n) &&
    n >= 0 &&
    n <= MAX_PER_100G[code]
    ? n
    : undefined;
}
