/**
 * Turning an AI reading of a meal into loggable items. The model splits the
 * meal and estimates portions; nutrition comes from the user's own memory of
 * a food first, then the food database for branded items, and only then the
 * model's estimate, which is checked against its own macros.
 */

export interface ModelItem {
  name: string;
  brand: string | null;
  portion: string;
  grams: number;
  /** Whether the user said how much (e.g. "200 g", "2 eggs") */
  quantityStated: boolean;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  caffeineMgPer100g: number;
  alcoholGPer100g: number;
  category: FoodCategory;
  confidence: 'high' | 'medium' | 'low';
}

export const FOOD_CATEGORIES = [
  'meat_fish',
  'eggs',
  'dairy',
  'grains_bread',
  'vegetables',
  'fruit',
  'legumes',
  'nuts_seeds',
  'oils_fats',
  'sweets_snacks',
  'drinks',
  'mixed_dish',
  'other',
] as const;
export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

export interface Per100 {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** mg per 100 g; missing means unknown */
  caffeine?: number;
  /** g of alcohol per 100 g */
  alcohol?: number;
}

export interface Memory extends Per100 {
  usualGrams: number;
}

export type ItemSource = 'memory' | 'database' | 'estimate';

export interface ParsedItem {
  name: string;
  brand: string | null;
  portion: string;
  grams: number;
  per100: Per100;
  source: ItemSource;
  confidence: 'high' | 'medium' | 'low';
  category: FoodCategory;
  /** Protein or fat is outside what's normal for the category */
  check: boolean;
}

export const MEAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'question', 'cookingFatUnclear'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'name',
          'brand',
          'portion',
          'grams',
          'quantityStated',
          'kcalPer100g',
          'proteinPer100g',
          'carbsPer100g',
          'fatPer100g',
          'caffeineMgPer100g',
          'alcoholGPer100g',
          'category',
          'confidence',
        ],
        properties: {
          name: { type: 'string' },
          brand: { type: ['string', 'null'] },
          portion: { type: 'string' },
          grams: { type: 'number' },
          quantityStated: { type: 'boolean' },
          kcalPer100g: { type: 'number' },
          proteinPer100g: { type: 'number' },
          carbsPer100g: { type: 'number' },
          fatPer100g: { type: 'number' },
          caffeineMgPer100g: { type: 'number' },
          alcoholGPer100g: { type: 'number' },
          category: { type: 'string', enum: [...FOOD_CATEGORIES] },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
    question: { type: ['string', 'null'] },
    cookingFatUnclear: { type: 'boolean' },
  },
} as const;

// What's normal per 100 g, generously, so only clear mistakes are flagged
// (grilled chicken at 2 g protein, or rice at 40 g fat)
const RANGES: Partial<
  Record<FoodCategory, { protein: [number, number]; fat: [number, number] }>
> = {
  meat_fish: { protein: [8, 45], fat: [0, 45] },
  eggs: { protein: [8, 16], fat: [3, 25] },
  grains_bread: { protein: [1, 20], fat: [0, 30] },
  vegetables: { protein: [0, 10], fat: [0, 20] },
  fruit: { protein: [0, 5], fat: [0, 40] },
  legumes: { protein: [4, 40], fat: [0, 25] },
  nuts_seeds: { protein: [5, 40], fat: [25, 80] },
  oils_fats: { protein: [0, 3], fat: [50, 100] },
  drinks: { protein: [0, 12], fat: [0, 12] },
};

/** True when protein or fat is outside the normal range for the category. */
export function needsCheck(category: FoodCategory, per100: Per100) {
  const r = RANGES[category];
  if (!r) return false;
  return (
    per100.protein < r.protein[0] ||
    per100.protein > r.protein[1] ||
    per100.fat < r.fat[0] ||
    per100.fat > r.fat[1]
  );
}

/** Cooking oil, for the "Cooked in oil?" answer. */
export const COOKING_OIL: Per100 = {
  kcal: 884,
  protein: 0,
  carbs: 0,
  fat: 100,
};
export const OIL_AMOUNTS = { none: 0, a_little: 5, a_lot: 15 } as const;

/** The same food, ignoring case, spacing, punctuation and plurals. */
export function memoryKey(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^\p{L}\p{N} ]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean)
      // "eggs" and "egg" are one food; "hummus" and "glass" stay as they are
      .map((w) => (w.length > 3 && /[^su]s$/.test(w) ? w.slice(0, -1) : w))
      .join(' ')
  );
}

/**
 * The instructions, plus the foods this person has logged before, so the
 * model calls them by the same names and their numbers can be reused.
 */
export function mealInstructions(knownFoods: string[]) {
  if (!knownFoods.length) return MEAL_INSTRUCTIONS;
  return `${MEAL_INSTRUCTIONS}

Foods this person has logged before: ${knownFoods.map((f) => JSON.stringify(f)).join(', ')}.
When an item is one of these (same food, even if described differently), use that exact name.`;
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));

/**
 * Keeps an estimate physically possible: macros within 100 g, and calories
 * consistent with them (4/4/9 kcal per gram). Where the stated calories and
 * the macros disagree by more than 30%, the macros win.
 */
export function saneEstimate(p: Per100): Per100 {
  let protein = clamp(p.protein, 0, 100);
  let carbs = clamp(p.carbs, 0, 100);
  let fat = clamp(p.fat, 0, 100);
  const mass = protein + carbs + fat;
  if (mass > 100) {
    protein = (protein / mass) * 100;
    carbs = (carbs / mass) * 100;
    fat = (fat / mass) * 100;
  }
  const fromMacros = protein * 4 + carbs * 4 + fat * 9;
  let kcal = clamp(p.kcal, 0, 900);
  if (fromMacros > 0 && Math.abs(kcal - fromMacros) / fromMacros > 0.3)
    kcal = fromMacros;
  return {
    kcal: round1(kcal),
    protein: round1(protein),
    carbs: round1(carbs),
    fat: round1(fat),
  };
}

/** Picks where each item's nutrition comes from, and its portion. */
export function groundItem(
  item: ModelItem,
  memory: Memory | undefined,
  database: Per100 | undefined,
): ParsedItem {
  const grams = clamp(Math.round(item.grams), 1, 2000);
  const category = (FOOD_CATEGORIES as readonly string[]).includes(
    item.category,
  )
    ? item.category
    : 'other';
  // Labels rarely give caffeine or alcohol, so the reading fills them in
  const drink = {
    caffeine: clamp(item.caffeineMgPer100g, 0, 5000),
    alcohol: clamp(item.alcoholGPer100g, 0, 80),
  };
  if (memory) {
    return {
      name: item.name,
      brand: item.brand,
      portion: item.quantityStated
        ? item.portion
        : `your usual ${Math.round(memory.usualGrams)} g`,
      // "Oats" with no amount means their usual amount
      grams: item.quantityStated ? grams : Math.round(memory.usualGrams),
      per100: {
        ...memory,
        caffeine: memory.caffeine ?? drink.caffeine,
        alcohol: memory.alcohol ?? drink.alcohol,
      },
      source: 'memory',
      confidence: 'high',
      category,
      // Their own numbers, so not second-guessed
      check: false,
    };
  }
  if (database) {
    return {
      name: item.name,
      brand: item.brand,
      portion: item.portion,
      grams,
      per100: { ...drink, ...database },
      source: 'database',
      confidence: item.confidence,
      category,
      check: needsCheck(category, database),
    };
  }
  const per100 = {
    ...saneEstimate({
      kcal: item.kcalPer100g,
      protein: item.proteinPer100g,
      carbs: item.carbsPer100g,
      fat: item.fatPer100g,
    }),
    ...drink,
  };
  return {
    name: item.name,
    brand: item.brand,
    portion: item.portion,
    grams,
    per100,
    source: 'estimate',
    confidence: item.confidence,
    category,
    check: needsCheck(category, per100),
  };
}

/** An item's totals for its grams. */
export function totals(per100: Per100, grams: number) {
  const f = grams / 100;
  return {
    calories: Math.round(per100.kcal * f),
    proteinG: round1(per100.protein * f),
    carbsG: round1(per100.carbs * f),
    fatG: round1(per100.fat * f),
    caffeineMg:
      per100.caffeine != null ? Math.round(per100.caffeine * f) : null,
    alcoholG: per100.alcohol != null ? round1(per100.alcohol * f) : null,
  };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export const MEAL_INSTRUCTIONS = `You read meals for a calorie tracker. Split what the person ate into separate foods.

For each food:
- name: short and generic ("fried egg", "sourdough toast"), brand only if they named one or it's clearly visible.
- grams eaten: use their amount if they said it; otherwise a realistic portion for what they described or what the photo shows. Say in "portion" what you assumed ("2 large eggs", "1 tbsp").
- quantityStated: true only if they gave the amount.
- nutrition per 100 g as eaten (cooked, with typical preparation).
- Hidden calories are the usual reason trackers undercount: list dressings, sauces, sugar in drinks and toppings as their own items when they're likely to be there.
- Cooking fat: if they said how it was cooked, or the photo clearly shows it fried or in oil, list the oil or butter as its own item. If it was probably cooked in fat but you can't tell how much, don't add it: set cookingFatUnclear to true and the app will ask. Otherwise cookingFatUnclear is false.
- caffeineMgPer100g and alcoholGPer100g: typical amounts per 100 g (0 if none). Coffee and tea have caffeine; beer, wine and spirits have alcohol.
- category: the kind of food.
- confidence: how sure you are of the portion.

If one detail other than cooking fat would change the total a lot and you can't tell (portion size of the main food, sugar in a drink), ask about it in "question" (one short question). Otherwise question is null.
Don't give advice. Only food the person ate.`;
