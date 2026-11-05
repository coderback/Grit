import {
  needsCheck,
  groundItem,
  memoryKey,
  saneEstimate,
  totals,
  type ModelItem,
} from './meal-parse';

const item = (over: Partial<ModelItem> = {}): ModelItem => ({
  name: 'Porridge oats',
  brand: null,
  portion: '1 bowl',
  grams: 80,
  quantityStated: false,
  kcalPer100g: 370,
  proteinPer100g: 13,
  carbsPer100g: 60,
  fatPer100g: 7,
  caffeineMgPer100g: 0,
  alcoholGPer100g: 0,
  category: 'grains_bread',
  confidence: 'medium',
  ...over,
});

describe('meal parsing', () => {
  it('matches foods regardless of case and punctuation', () => {
    expect(memoryKey('  Porridge-Oats! ')).toBe('porridge oat');
    expect(memoryKey('Fried eggs')).toBe(memoryKey('fried egg'));
    expect(memoryKey('Hummus')).toBe('hummus');
    expect(memoryKey('Glass of milk')).toBe('glass of milk');
  });

  it("uses the person's own food and usual portion first", () => {
    const mem = { kcal: 380, protein: 12, carbs: 62, fat: 8, usualGrams: 60 };
    expect(groundItem(item(), mem, undefined)).toMatchObject({
      source: 'memory',
      grams: 60,
      portion: 'your usual 60 g',
      per100: mem,
    });
    // An amount they stated wins over the usual
    expect(
      groundItem(
        item({ quantityStated: true, grams: 100, portion: '100 g' }),
        mem,
        undefined,
      ),
    ).toMatchObject({ grams: 100, portion: '100 g' });
  });

  it('then the database, then a checked estimate', () => {
    const db = { kcal: 389, protein: 17, carbs: 66, fat: 7 };
    expect(groundItem(item({ brand: 'Quaker' }), undefined, db).source).toBe(
      'database',
    );
    const est = groundItem(item(), undefined, undefined);
    expect(est.source).toBe('estimate');
    expect(est.per100.kcal).toBe(370);
  });

  it('keeps estimates possible', () => {
    // Calories far from the macros: the macros win (4·10 + 4·20 + 9·10 = 210)
    expect(
      saneEstimate({ kcal: 50, protein: 10, carbs: 20, fat: 10 }).kcal,
    ).toBe(210);
    // Macros over 100 g are scaled down
    const s = saneEstimate({ kcal: 500, protein: 80, carbs: 80, fat: 40 });
    expect(s.protein + s.carbs + s.fat).toBeCloseTo(100, 0);
    // Nonsense grams are clamped
    expect(groundItem(item({ grams: -5 }), undefined, undefined).grams).toBe(1);
    expect(groundItem(item({ grams: 99999 }), undefined, undefined).grams).toBe(
      2000,
    );
  });

  it('works out totals for the portion', () => {
    expect(totals({ kcal: 370, protein: 13, carbs: 60, fat: 7 }, 60)).toEqual({
      calories: 222,
      proteinG: 7.8,
      carbsG: 36,
      caffeineMg: null,
      alcoholG: null,
      fatG: 4.2,
    });
  });

  it('flags protein or fat that is wrong for the kind of food', () => {
    // Grilled chicken can't be 2 g protein per 100 g
    expect(
      needsCheck('meat_fish', { kcal: 120, protein: 2, carbs: 0, fat: 3 }),
    ).toBe(true);
    expect(
      needsCheck('meat_fish', { kcal: 165, protein: 31, carbs: 0, fat: 3.6 }),
    ).toBe(false);
    // Rice at 40 g fat
    expect(
      needsCheck('grains_bread', { kcal: 500, protein: 3, carbs: 30, fat: 40 }),
    ).toBe(true);
    // Mixed dishes aren't checked
    expect(
      needsCheck('mixed_dish', { kcal: 500, protein: 0, carbs: 0, fat: 90 }),
    ).toBe(false);
  });

  it("keeps the user's own numbers unchecked, and carries caffeine", () => {
    const remembered = groundItem(
      item({ name: 'Flat white', category: 'drinks', caffeineMgPer100g: 40 }),
      { kcal: 50, protein: 40, carbs: 4, fat: 3, usualGrams: 200 },
      undefined,
    );
    expect(remembered.check).toBe(false);
    expect(remembered.per100.caffeine).toBe(40);
    expect(totals(remembered.per100, 200).caffeineMg).toBe(80);
    // A made-up category falls back to "other"
    const odd = groundItem(
      item({ category: 'snacky' as never }),
      undefined,
      undefined,
    );
    expect(odd.category).toBe('other');
  });
});
