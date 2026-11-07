import { favoriteBody, foodKey, portionAsFood, portionGrams, portionLabel } from '@/lib/quickFoods';

describe('quick foods', () => {
  it('matches the server key', () => {
    expect(foodKey(' Greek  Yogurt ', 'Fage')).toBe('greek yogurt|fage');
    expect(foodKey('Oats')).toBe('oats|');
  });
  it('labels portions', () => {
    expect(portionLabel({ servingQty: 150, servingUnit: 'g' })).toBe('150 g');
    expect(portionLabel({ servingQty: 1, servingUnit: 'serving' })).toBe('1 serving');
    expect(portionLabel({ servingQty: 2.25, servingUnit: 'serving' })).toBe('2.3 servings');
  });
  it('turns a saved portion into a loggable food', () => {
    const food = portionAsFood({ name: 'Oats', brand: null, barcode: null, calories: 300, proteinG: 10, carbsG: 50, fatG: 6, servingQty: 80, servingUnit: 'g' });
    expect(food).toMatchObject({ portion: true, offId: '', calories: 300, servingQty: 80 });
    expect(food.foodId).toBeUndefined();
    expect(food.portionGrams).toBeUndefined();
  });
  it("keeps a database food's id and grams", () => {
    const food = portionAsFood({ name: 'Bread', brand: null, barcode: null, calories: 148, proteinG: 5.6, carbsG: 24, fatG: 1.9, servingQty: 56, servingUnit: 'g', foodId: 'f1', grams: 56 });
    expect(food).toMatchObject({ portion: true, foodId: 'f1', portionGrams: 56 });
  });
  it('scales grams by the number of portions', () => {
    expect(portionGrams(56, 2)).toBe(112);
    expect(portionGrams(28, 1.5)).toBe(42);
    expect(portionGrams(33.3, 3)).toBe(99.9);
    expect(portionGrams(null, 2)).toBeUndefined();
    expect(portionGrams(undefined, 2)).toBeUndefined();
    expect(portionGrams(0, 2)).toBeUndefined();
  });
  it('sends only the fields a favourite takes', () => {
    const recent = {
      name: 'Bread', brand: null, barcode: '5000000000001', calories: 148, proteinG: 5.6, carbsG: 24, fatG: 1.9,
      servingQty: 56, servingUnit: 'g', foodId: 'f1', grams: 56,
      key: 'bread|', timesLogged: 3, lastMealType: 'lunch', lastLoggedAt: '2026-11-05T12:00:00Z', favoriteId: null,
    };
    expect(favoriteBody(recent)).toEqual({
      name: 'Bread', brand: undefined, barcode: '5000000000001', calories: 148, proteinG: 5.6, carbsG: 24, fatG: 1.9,
      servingQty: 56, servingUnit: 'g', foodId: 'f1', grams: 56,
    });
    const manual = favoriteBody({ ...recent, foodId: null, grams: null });
    expect(manual.foodId).toBeUndefined();
    expect(manual.grams).toBeUndefined();
    expect(favoriteBody({ ...recent, grams: 6000 }).grams).toBeUndefined();
  });
});
