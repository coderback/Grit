import { mealForHour } from '@/lib/meals';

describe('mealForHour', () => {
  it('picks the meal for the time of day', () => {
    expect([6, 10, 11, 14, 15, 16, 17, 21, 22, 2].map(mealForHour)).toEqual([
      'breakfast', 'breakfast', 'lunch', 'lunch', 'snack', 'snack', 'dinner', 'dinner', 'snack', 'snack',
    ]);
  });
});
