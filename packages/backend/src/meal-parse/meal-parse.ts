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
  confidence: 'high' | 'medium' | 'low';
}

export interface Per100 {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
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
}

export const MEAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'question'],
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
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
    question: { type: ['string', 'null'] },
  },
} as const;

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
  if (memory) {
    return {
      name: item.name,
      brand: item.brand,
      portion: item.quantityStated
        ? item.portion
        : `your usual ${Math.round(memory.usualGrams)} g`,
      // "Oats" with no amount means their usual amount
      grams: item.quantityStated ? grams : Math.round(memory.usualGrams),
      per100: memory,
      source: 'memory',
      confidence: 'high',
    };
  }
  if (database) {
    return {
      name: item.name,
      brand: item.brand,
      portion: item.portion,
      grams,
      per100: database,
      source: 'database',
      confidence: item.confidence,
    };
  }
  return {
    name: item.name,
    brand: item.brand,
    portion: item.portion,
    grams,
    per100: saneEstimate({
      kcal: item.kcalPer100g,
      protein: item.proteinPer100g,
      carbs: item.carbsPer100g,
      fat: item.fatPer100g,
    }),
    source: 'estimate',
    confidence: item.confidence,
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
- Hidden calories are the usual reason trackers undercount: list cooking oil, butter, dressings, sauces, sugar in drinks and toppings as their own items when they're likely to be there.
- confidence: how sure you are of the portion.

If one detail would change the total a lot and you can't tell (portion size of the main food, fried or grilled, sugar in a drink), ask about it in "question" (one short question). Otherwise question is null.
Don't give advice. Only food the person ate.`;
