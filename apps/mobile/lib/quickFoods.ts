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
}

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
  };
}

/** "150 g" or "2 servings" */
export function portionLabel(f: Pick<QuickFood, 'servingQty' | 'servingUnit'>) {
  const qty = Math.round(f.servingQty * 10) / 10;
  return f.servingUnit === 'serving' ? `${qty} ${qty === 1 ? 'serving' : 'servings'}` : `${qty} ${f.servingUnit}`;
}
