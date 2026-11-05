import { drinkValues } from './food.service';

describe('caffeine and alcohol from food labels', () => {
  it('turns grams of caffeine into mg and % vol into grams of alcohol', () => {
    expect(drinkValues({ caffeine_100g: 0.032 })).toEqual({ caffeineMg: 32 });
    // A 5% beer: about 3.9 g of alcohol per 100 g
    expect(drinkValues({ alcohol_100g: '5' })).toEqual({ alcoholG: 3.9 });
  });

  it('ignores missing or impossible values', () => {
    expect(drinkValues({})).toEqual({});
    expect(drinkValues(undefined)).toEqual({});
    expect(drinkValues({ caffeine_100g: 40, alcohol_100g: 0 })).toEqual({});
  });
});
