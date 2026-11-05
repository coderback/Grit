import { foodKey, portionAsFood, portionLabel } from '@/lib/quickFoods';

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
  });
});
