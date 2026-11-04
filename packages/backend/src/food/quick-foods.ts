/** Recent and favourite foods: saved portions the app can log again in one tap. */

export interface QuickFood {
  key: string;
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

/** Same food = same name and brand, ignoring case and spacing. */
export function foodKey(name: string, brand?: string | null): string {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  return `${norm(name)}|${norm(brand ?? '')}`;
}

interface LogRow extends Omit<QuickFood, 'key'> {
  mealType: string;
  loggedAt: Date;
}

/**
 * The most recently eaten distinct foods, newest first, each as its latest
 * portion, with how often it was logged and the meal it was last eaten at.
 * `logs` must be newest first.
 */
export function recentFoods(logs: LogRow[], limit: number) {
  const seen = new Map<
    string,
    QuickFood & {
      timesLogged: number;
      lastMealType: string;
      lastLoggedAt: Date;
    }
  >();
  for (const l of logs) {
    const key = foodKey(l.name, l.brand);
    const existing = seen.get(key);
    if (existing) {
      existing.timesLogged++;
      continue;
    }
    if (seen.size >= limit) continue;
    seen.set(key, {
      key,
      name: l.name,
      brand: l.brand,
      barcode: l.barcode,
      calories: l.calories,
      proteinG: l.proteinG,
      carbsG: l.carbsG,
      fatG: l.fatG,
      servingQty: l.servingQty,
      servingUnit: l.servingUnit,
      timesLogged: 1,
      lastMealType: l.mealType,
      lastLoggedAt: l.loggedAt,
    });
  }
  return [...seen.values()];
}
