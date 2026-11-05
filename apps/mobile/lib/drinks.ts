import type { NormalizedFood } from '@/hooks/useFoodLog';

/**
 * Common drinks for the quick drinks shortcut, as whole portions. Typical
 * values: caffeine from USDA FoodData Central averages; alcohol as volume ×
 * % vol × 0.789 g/ml, at 7 kcal per gram plus the drink's carbs.
 */
const drink = (
  name: string,
  serving: string,
  calories: number,
  extra: Partial<NormalizedFood>,
): NormalizedFood => ({
  offId: `drink:${name}`,
  name,
  brand: null,
  barcode: null,
  calories,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  servingQty: 1,
  servingUnit: serving,
  imageUrl: null,
  portion: true,
  ...extra,
});

export const DRINKS: { emoji: string; food: NormalizedFood }[] = [
  { emoji: '☕', food: drink('Espresso', 'single shot (30 ml)', 3, { caffeineMg: 63 }) },
  { emoji: '☕', food: drink('Filter coffee', 'mug (240 ml)', 2, { caffeineMg: 95 }) },
  { emoji: '🥛', food: drink('Latte', 'medium (350 ml), whole milk', 190, { proteinG: 12, carbsG: 18, fatG: 7, caffeineMg: 130 }) },
  { emoji: '🍵', food: drink('Black tea', 'mug (240 ml)', 2, { caffeineMg: 47 }) },
  { emoji: '🍺', food: drink('Beer', '500 ml, 5%', 215, { carbsG: 18, alcoholG: 19.7 }) },
  { emoji: '🍷', food: drink('Wine', 'glass (175 ml), 13%', 160, { carbsG: 4, alcoholG: 18 }) },
  { emoji: '🥃', food: drink('Spirit', 'single (30 ml), 40%', 65, { alcoholG: 9.5 }) },
];
