/**
 * Servings for foods from the database: what the log sheet offers, which one
 * it starts on, and the maths from a number of servings to grams and
 * nutrition. Database foods carry nutrition per 100 g.
 */
import type { NormalizedFood } from '@/hooks/useFoodLog';

/** The most the server takes as one log's grams. */
export const MAX_LOG_GRAMS = 5000;

export interface ServingOption {
  /** Stable key for the picker */
  key: string;
  /** What the chip shows: "1 slice (28 g)", "100 g" or "Grams" */
  label: string;
  /** Grams (or ml) in one; 1 for typing grams directly */
  grams: number;
  /** The usual serving */
  typical?: boolean;
  /** The amount is typed in grams, not as a number of servings */
  direct?: boolean;
}

type ServingFood = Pick<NormalizedFood, 'servings' | 'servingQty' | 'servingUnit'>;

export const round1 = (n: number) => Math.round(n * 10) / 10;

/** Grams, or ml for some drinks from Open Food Facts. */
export function foodUnit(food: Pick<NormalizedFood, 'servingUnit'>): 'g' | 'ml' {
  return food.servingUnit?.trim().toLowerCase() === 'ml' ? 'ml' : 'g';
}

/** "28", "7.5" */
export function formatGrams(grams: number): string {
  return String(grams >= 10 ? Math.round(grams) : round1(grams));
}

/** "1 slice (28 g)" */
export function servingLabel(s: { label: string; grams: number }, unit: 'g' | 'ml' = 'g'): string {
  return `${s.label.trim()} (${formatGrams(s.grams)} ${unit})`;
}

/**
 * The food's own servings, then 100 g, then typing grams. A food with a
 * serving size but no named servings (an Open Food Facts product) gets
 * "1 serving (30 g)" first.
 */
export function servingOptions(food: ServingFood): ServingOption[] {
  const unit = foodUnit(food);
  const own = (food.servings ?? []).filter((s) => s.grams > 0 && s.label?.trim());
  const options: ServingOption[] = own.map((s, i) => ({
    key: `s${i}`,
    label: servingLabel(s, unit),
    grams: s.grams,
    typical: s.typical,
  }));
  if (!own.length && food.servingQty > 0 && food.servingQty !== 100) {
    options.push({ key: 'serving', label: servingLabel({ label: '1 serving', grams: food.servingQty }, unit), grams: food.servingQty });
  }
  options.push({ key: '100', label: `100 ${unit}`, grams: 100 });
  options.push({ key: 'direct', label: unit === 'ml' ? 'Millilitres' : 'Grams', grams: 1, direct: true });
  return options;
}

/** Where the sheet starts: the typical serving, else the first, else the food's serving size (or 100 g). */
export function defaultOption(food: ServingFood, options: ServingOption[] = servingOptions(food)): ServingOption {
  return options.find((o) => o.typical) ?? options[0];
}

/** The serving to show a food with, or null to show it per 100 g. */
export function defaultServing(food: ServingFood): ServingOption | null {
  const o = defaultOption(food);
  return o.key === '100' || o.direct ? null : o;
}

/** kcal in a number of grams of a food listed per 100 g. */
export function kcalIn(food: Pick<NormalizedFood, 'calories'>, grams: number): number {
  return Math.round((food.calories * grams) / 100);
}

/** What a search row shows: "1 slice (28 g)" and its kcal, or the kcal per 100 g. */
export function searchServing(food: ServingFood & Pick<NormalizedFood, 'calories'>): { serving: string | null; kcal: number } {
  const s = defaultServing(food);
  return s ? { serving: s.label, kcal: kcalIn(food, s.grams) } : { serving: null, kcal: Math.round(food.calories) };
}

/**
 * The number typed into the amount field. A count of servings falls back to
 * 1 while the field is empty; grams typed directly fall back to 0.
 */
export function parseQty(text: string, direct: boolean): number {
  const n = parseFloat(text.replace(',', '.'));
  if (n > 0 && Number.isFinite(n)) return n;
  return direct ? 0 : 1;
}

/** Grams (or ml) eaten: a number of servings times the serving, or grams typed directly. */
export function amountEaten(qty: number, option: Pick<ServingOption, 'grams'>): number {
  return Math.max(0, qty) * option.grams;
}

/** What the amount field shows after switching serving: the grams so far, or 1 serving. */
export function qtyAfterSwitch(to: Pick<ServingOption, 'direct'>, amountSoFar: number): string {
  return to.direct ? String(round1(amountSoFar)) : '1';
}

/** Per-100 g nutrition scaled to the amount eaten. */
export function scalePer100(
  food: Pick<NormalizedFood, 'calories' | 'proteinG' | 'carbsG' | 'fatG' | 'caffeineMg' | 'alcoholG'>,
  grams: number,
) {
  const f = grams / 100;
  return {
    calories: food.calories * f,
    proteinG: food.proteinG * f,
    carbsG: food.carbsG * f,
    fatG: food.fatG * f,
    caffeineMg: food.caffeineMg != null ? Math.round(food.caffeineMg * f) : undefined,
    alcoholG: food.alcoholG != null ? round1(food.alcoholG * f) : undefined,
  };
}

/** A database food as logged: the grams eaten for the chosen serving and amount, and the nutrition in them. */
export function servingLog(
  food: Pick<NormalizedFood, 'calories' | 'proteinG' | 'carbsG' | 'fatG' | 'caffeineMg' | 'alcoholG'>,
  option: Pick<ServingOption, 'grams' | 'direct'>,
  qtyText: string,
) {
  const grams = amountEaten(parseQty(qtyText, !!option.direct), option);
  return { grams, ...scalePer100(food, grams) };
}
