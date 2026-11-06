import {
  amountEaten, defaultOption, defaultServing, foodUnit, kcalIn, parseQty, qtyAfterSwitch, scalePer100, searchServing,
  servingLabel, servingLog, servingOptions,
} from '@/lib/servings';

// Wholemeal bread, per 100 g
const bread = {
  calories: 265, proteinG: 10, carbsG: 43, fatG: 3.4,
  servingQty: 28, servingUnit: 'g',
  servings: [
    { label: '1 slice', grams: 28, typical: true },
    { label: '1 thick slice', grams: 44, typical: false },
  ],
};

describe('serving labels', () => {
  it('shows the grams in brackets', () => {
    expect(servingLabel({ label: '1 slice', grams: 28 })).toBe('1 slice (28 g)');
    expect(servingLabel({ label: '1 cup, chopped', grams: 160.4 })).toBe('1 cup, chopped (160 g)');
    expect(servingLabel({ label: '1 tsp', grams: 4.2 })).toBe('1 tsp (4.2 g)');
    expect(servingLabel({ label: '1 can', grams: 330 }, 'ml')).toBe('1 can (330 ml)');
  });
  it('treats only ml as millilitres', () => {
    expect(foodUnit({ servingUnit: 'ml' })).toBe('ml');
    expect(foodUnit({ servingUnit: 'g' })).toBe('g');
    expect(foodUnit({ servingUnit: 'serving' })).toBe('g');
  });
});

describe('serving options', () => {
  it("lists the food's servings, then 100 g, then grams", () => {
    expect(servingOptions(bread).map((o) => o.label)).toEqual(['1 slice (28 g)', '1 thick slice (44 g)', '100 g', 'Grams']);
    const direct = servingOptions(bread).at(-1)!;
    expect(direct).toMatchObject({ direct: true, grams: 1 });
  });
  it('drops servings with no grams or label', () => {
    const food = { ...bread, servings: [{ label: '', grams: 30, typical: false }, { label: '1 pot', grams: 0, typical: true }] };
    expect(servingOptions(food).map((o) => o.key)).toEqual(['serving', '100', 'direct']);
  });
  it('offers a plain serving size when there are no named servings', () => {
    expect(servingOptions({ servingQty: 30, servingUnit: 'g' }).map((o) => o.label)).toEqual(['1 serving (30 g)', '100 g', 'Grams']);
    expect(servingOptions({ servingQty: 100, servingUnit: 'ml' }).map((o) => o.label)).toEqual(['100 ml', 'Millilitres']);
  });
});

describe('default serving', () => {
  it('starts on the typical serving', () => {
    const food = { ...bread, servings: [bread.servings[1], bread.servings[0]] };
    expect(defaultOption(food).label).toBe('1 slice (28 g)');
  });
  it('else on the first serving', () => {
    const food = { ...bread, servings: bread.servings.map((s) => ({ ...s, typical: false })) };
    expect(defaultOption(food).label).toBe('1 slice (28 g)');
  });
  it("else on the food's serving size, or 100 g", () => {
    expect(defaultOption({ servingQty: 30, servingUnit: 'g' }).label).toBe('1 serving (30 g)');
    expect(defaultOption({ servingQty: 100, servingUnit: 'g' }).label).toBe('100 g');
    expect(defaultOption({ servingQty: 0, servingUnit: 'g' }).label).toBe('100 g');
    expect(defaultServing({ servingQty: 100, servingUnit: 'g' })).toBeNull();
  });
});

describe('search rows', () => {
  it('show the typical serving and its kcal', () => {
    expect(searchServing(bread)).toEqual({ serving: '1 slice (28 g)', kcal: 74 });
  });
  it('show kcal per 100 g without a serving', () => {
    expect(searchServing({ calories: 89.4, servingQty: 100, servingUnit: 'g' })).toEqual({ serving: null, kcal: 89 });
  });
});

describe('serving maths', () => {
  it('multiplies servings by the serving grams', () => {
    const slice = defaultOption(bread);
    expect(amountEaten(2, slice)).toBe(56);
    expect(amountEaten(-1, slice)).toBe(0);
    expect(amountEaten(45, { grams: 1 })).toBe(45);
  });
  it('scales per-100 g values to the grams eaten', () => {
    const per = scalePer100({ ...bread, caffeineMg: 10, alcoholG: 1.25 }, 56);
    expect(per.calories).toBeCloseTo(148.4);
    expect(per.proteinG).toBeCloseTo(5.6);
    expect(per.carbsG).toBeCloseTo(24.08);
    expect(per.fatG).toBeCloseTo(1.904);
    expect(per.caffeineMg).toBe(6);
    expect(per.alcoholG).toBe(0.7);
    expect(scalePer100(bread, 50).caffeineMg).toBeUndefined();
    expect(kcalIn(bread, 28)).toBe(74);
  });
  it('logs a number of servings as grams', () => {
    const [slice, , hundred, direct] = servingOptions(bread);
    expect(servingLog(bread, slice, '2')).toMatchObject({ grams: 56 });
    expect(servingLog(bread, slice, '2').calories).toBeCloseTo(148.4);
    expect(servingLog(bread, hundred, '1.5').grams).toBe(150);
    expect(servingLog(bread, direct, '45').grams).toBe(45);
    expect(servingLog(bread, direct, '45').calories).toBeCloseTo(119.25);
  });
  it('reads the amount field', () => {
    expect(parseQty('1.5', false)).toBe(1.5);
    expect(parseQty('1,5', false)).toBe(1.5);
    expect(parseQty('', false)).toBe(1);
    expect(parseQty('', true)).toBe(0);
    expect(parseQty('-3', true)).toBe(0);
  });
  it('keeps the grams when switching to typing grams, and starts a serving at 1', () => {
    expect(qtyAfterSwitch({ direct: true }, 56)).toBe('56');
    expect(qtyAfterSwitch({ direct: true }, 42.04)).toBe('42');
    expect(qtyAfterSwitch({}, 56)).toBe('1');
  });
});
