import {
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
      fatG: 4.2,
    });
  });
});
