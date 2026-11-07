/** Recent and favourite foods: saved portions, logged again in a tap. */
import type { NormalizedFood } from '@/hooks/useFoodLog';

/** A saved portion: the amounts are for the whole portion, not per 100 g. */
export interface QuickFood {
  name: string;
  brand: string | null;
  barcode: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  servingQty: number;
  servingUnit: string;
  /** The database food it came from (Phase 7) */
  foodId?: string | null;
  /** Grams in the whole portion, when known */
  grams?: number | null;
}

/** The most grams the server takes in one log or favourite. */
const MAX_GRAMS = 5000;

/** Matches the server's: same name and brand, ignoring case and spacing. */
export function foodKey(name: string, brand?: string | null) {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  return `${norm(name)}|${norm(brand ?? '')}`;
}

/** A saved portion in the shape the log sheet takes. */
export function portionAsFood(f: QuickFood): NormalizedFood {
  return {
    offId: '',
    portion: true,
    name: f.name,
    brand: f.brand,
    barcode: f.barcode,
    calories: f.calories,
    proteinG: f.proteinG,
    carbsG: f.carbsG,
    fatG: f.fatG,
    servingQty: f.servingQty,
    servingUnit: f.servingUnit,
    imageUrl: null,
    ...(f.foodId ? { foodId: f.foodId } : {}),
    ...(f.grams != null && f.grams > 0 ? { portionGrams: f.grams } : {}),
  };
}

/** Grams in a number of saved portions, if the portion's grams are known. */
export function portionGrams(gramsPerPortion: number | null | undefined, portions: number): number | undefined {
  if (gramsPerPortion == null || !(gramsPerPortion > 0) || !(portions > 0)) return undefined;
  return Math.round(gramsPerPortion * portions * 10) / 10;
}

/**
 * The body for POST /food/favorites: only the fields it takes (anything
 * else is a 400), with grams left out when out of range.
 */
export function favoriteBody(f: QuickFood) {
  const grams = f.grams != null && f.grams >= 0 && f.grams <= MAX_GRAMS ? f.grams : undefined;
  return {
    name: f.name,
    brand: f.brand ?? undefined,
    barcode: f.barcode ?? undefined,
    calories: f.calories,
    proteinG: f.proteinG,
    carbsG: f.carbsG,
    fatG: f.fatG,
    servingQty: f.servingQty,
    servingUnit: f.servingUnit,
    foodId: f.foodId || undefined,
    grams,
  };
}

/** "150 g" or "2 servings" */
export function portionLabel(f: Pick<QuickFood, 'servingQty' | 'servingUnit'>) {
  const qty = Math.round(f.servingQty * 10) / 10;
  return f.servingUnit === 'serving' ? `${qty} ${qty === 1 ? 'serving' : 'servings'}` : `${qty} ${f.servingUnit}`;
}
