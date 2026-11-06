import { foodKey, recentFoods } from './quick-foods';

const log = (
  name: string,
  brand: string | null,
  at: string,
  calories = 100,
  mealType = 'lunch',
) => ({
  name,
  brand,
  barcode: null,
  calories,
  proteinG: 1,
  carbsG: 2,
  fatG: 3,
  servingQty: 150,
  servingUnit: 'g',
  foodId: null,
  grams: 150,
  mealType,
  loggedAt: new Date(at),
});

describe('recent foods', () => {
  it('matches the same food regardless of case and spacing', () => {
    expect(foodKey(' Greek  Yogurt ', 'Fage')).toBe(
      foodKey('greek yogurt', 'FAGE'),
    );
    expect(foodKey('Oats', null)).toBe('oats|');
  });

  it('keeps the newest portion of each food and counts repeats', () => {
    const logs = [
      log('Oats', null, '2026-11-04T08:00:00Z', 320, 'breakfast'),
      log('Chicken wrap', 'Tesco', '2026-11-03T12:00:00Z'),
      log('oats', null, '2026-11-03T08:00:00Z', 250),
      log('Apple', null, '2026-11-02T15:00:00Z'),
    ];
    const recent = recentFoods(logs, 2);
    expect(recent.map((r) => r.name)).toEqual(['Oats', 'Chicken wrap']);
    expect(recent[0]).toMatchObject({
      calories: 320,
      timesLogged: 2,
      lastMealType: 'breakfast',
      // The newest portion's database link
      foodId: null,
      grams: 150,
    });
  });
});
