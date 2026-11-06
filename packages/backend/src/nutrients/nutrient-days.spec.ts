import { NUTRIENTS, type NutrientCode } from '../food/nutrients';
import {
  LOW_FRACTION,
  MIN_NUTRIENT_COVERAGE,
  anyJudged,
  displayAmount,
  isJudgedDay,
  lowOnDay,
  nutrientDay,
  nutrientDays,
  nutrientStatus,
  nutrientTargets,
  oftenLow,
  parseNutrients,
  percentOfTarget,
  roundShare,
  type NutrientLog,
} from './nutrient-days';

const measured = (values: Partial<Record<NutrientCode, number>>) =>
  Object.fromEntries(
    Object.entries(values).map(([code, amount]) => [
      code,
      { amount, basis: 'measured' },
    ]),
  );

const at = (iso: string) => new Date(iso);
const log = (
  name: string,
  calories: number,
  nutrients: Partial<Record<NutrientCode, number>> | null,
  loggedAt = at('2026-10-14T12:00:00Z'),
): NutrientLog => ({
  name,
  calories,
  loggedAt,
  nutrients: nutrients && measured(nutrients),
});

// A day logged entirely from foods with measured values (the Phase 7 exit
// check: totals must match a hand calculation)
const KNOWN_DAY = [
  log('Porridge oats', 300, {
    kcal: 300,
    protein_g: 10.5,
    iron_mg: 3.2,
    fibre_g: 8,
    magnesium_mg: 110,
    sat_fat_g: 1.2,
    sodium_mg: 5,
  }),
  log('Lentil soup', 400, {
    kcal: 400,
    protein_g: 22,
    iron_mg: 5.1,
    fibre_g: 12,
    folate_ug: 250,
    sodium_mg: 900,
    sat_fat_g: 0.8,
  }),
  log('Spinach, raw', 23, {
    kcal: 23,
    protein_g: 2.9,
    iron_mg: 2.7,
    vit_k_ug: 483,
    folate_ug: 194,
    vit_a_ug: 469,
  }),
  log('Greek yogurt', 146, {
    kcal: 146,
    protein_g: 20,
    calcium_mg: 200,
    b12_ug: 1.3,
    sat_fat_g: 4.4,
    sodium_mg: 65,
  }),
  log('Chicken and rice', 650, {
    kcal: 650,
    protein_g: 45,
    iron_mg: 1.9,
    sodium_mg: 780,
    sat_fat_g: 3.1,
    b12_ug: 0.6,
    fibre_g: 2.5,
  }),
];

// Iron and fibre well under target, with full coverage
const LOW_DAY = [
  log('White toast', 300, { kcal: 300, iron_mg: 1.0, fibre_g: 2.4 }),
  log('Cheddar', 400, { kcal: 400, iron_mg: 0.2, calcium_mg: 720 }),
  log('Pasta', 500, { kcal: 500, iron_mg: 1.5, fibre_g: 3 }),
];

const woman = nutrientTargets(
  {
    gender: 'female',
    dateOfBirth: new Date('1990-05-01T00:00:00Z'),
    calorieGoal: 2000,
  },
  new Date('2026-10-14T00:00:00Z'),
);

describe('parseNutrients', () => {
  it('keeps measured and label amounts of known codes', () => {
    expect(
      parseNutrients({
        iron_mg: { amount: 1.2, basis: 'measured' },
        sodium_mg: { amount: 400, basis: 'label' },
        vit_c_mg: { amount: 0, basis: 'measured' },
      }),
    ).toEqual({ iron_mg: 1.2, sodium_mg: 400, vit_c_mg: 0 });
  });

  it('drops anything it cannot trust', () => {
    expect(
      parseNutrients({
        iron_mg: { amount: 1.2, basis: 'estimated' },
        zinc_mg: { amount: '3', basis: 'measured' },
        b12_ug: { amount: -1, basis: 'measured' },
        calcium_mg: { amount: Infinity, basis: 'measured' },
        folate_ug: { basis: 'measured' },
        vit_d_ug: [5, 'measured'],
        magnesium_mg: null,
        made_up: { amount: 1, basis: 'measured' },
      }),
    ).toEqual({});
    expect(
      parseNutrients(
        JSON.parse('{"__proto__": {"amount": 1, "basis": "measured"}}'),
      ),
    ).toEqual({});
    for (const bad of [null, undefined, 'iron', 3, [], true]) {
      expect(parseNutrients(bad)).toEqual({});
    }
  });
});

describe('nutrientDay', () => {
  it('totals a day of known values to match a hand calculation', () => {
    const day = nutrientDay('2026-10-14', KNOWN_DAY);
    const calories = 300 + 400 + 23 + 146 + 650; // 1519
    expect(day.calories).toBe(calories);
    expect(day.entries).toBe(5);
    // Every log carries vitamins or minerals
    expect(day.dataCoverage).toBe(1);

    const hand: Partial<Record<NutrientCode, number>> = {
      kcal: 1519,
      protein_g: 10.5 + 22 + 2.9 + 20 + 45,
      iron_mg: 3.2 + 5.1 + 2.7 + 1.9,
      fibre_g: 8 + 12 + 2.5,
      sodium_mg: 5 + 900 + 65 + 780,
      sat_fat_g: 1.2 + 0.8 + 4.4 + 3.1,
      folate_ug: 250 + 194,
      b12_ug: 1.3 + 0.6,
      calcium_mg: 200,
      magnesium_mg: 110,
      vit_k_ug: 483,
      vit_a_ug: 469,
    };
    expect(Object.keys(day.totals).sort()).toEqual(Object.keys(hand).sort());
    for (const [code, amount] of Object.entries(hand)) {
      expect(day.totals[code as NutrientCode]).toBeCloseTo(amount, 9);
    }

    // Coverage: the share of calories from logs that carry each nutrient
    expect(day.coverage.iron_mg).toBeCloseTo((300 + 400 + 23 + 650) / calories);
    expect(day.coverage.folate_ug).toBeCloseTo((400 + 23) / calories);
    expect(day.coverage.calcium_mg).toBeCloseTo(146 / calories);
    expect(day.coverage.vit_c_mg).toBeUndefined();

    expect(day.sources.iron_mg).toEqual([
      { name: 'Lentil soup', amount: 5.1 },
      { name: 'Porridge oats', amount: 3.2 },
    ]);
  });

  it('counts only calories from logs with vitamin or mineral data as covered', () => {
    const day = nutrientDay('2026-10-14', [
      log('Oats', 300, { kcal: 300, iron_mg: 3 }),
      // A label with only sodium, sat fat and fibre is not micronutrient data
      log('Ready meal', 500, { kcal: 500, sodium_mg: 1200, fibre_g: 4 }),
      log('Manual entry', 200, null),
    ]);
    expect(day.dataCoverage).toBeCloseTo(0.3);
    expect(day.coverage.sodium_mg).toBeCloseTo(0.5);
    expect(day.coverage.kcal).toBeCloseTo(0.8);
  });

  it('adds up the same food logged twice and lists the top two sources', () => {
    const day = nutrientDay('2026-10-14', [
      log('Spinach', 20, { iron_mg: 1.5 }),
      log('Beef', 300, { iron_mg: 2.5 }),
      log('Spinach', 20, { iron_mg: 1.5 }),
      log('Bread', 200, { iron_mg: 1 }),
      log('Water', 0, { iron_mg: 0 }),
    ]);
    expect(day.sources.iron_mg).toEqual([
      { name: 'Spinach', amount: 3 },
      { name: 'Beef', amount: 2.5 },
    ]);
  });

  it('handles an empty day and a day with no calories', () => {
    expect(nutrientDay('2026-10-14', [])).toMatchObject({
      calories: 0,
      entries: 0,
      totals: {},
      dataCoverage: 0,
    });
    const water = nutrientDay('2026-10-14', [
      log('Water', 0, { sodium_mg: 5 }),
    ]);
    expect(water.coverage.sodium_mg).toBe(0);
    expect(water.totals.sodium_mg).toBe(5);
  });
});

describe('nutrientDays', () => {
  it("groups logs into the user's local days, oldest first", () => {
    const days = nutrientDays(
      [
        log('Late snack', 100, { iron_mg: 1 }, at('2026-10-13T23:30:00Z')),
        log('Lunch', 500, { iron_mg: 2 }, at('2026-10-13T12:00:00Z')),
        log('Breakfast', 300, { iron_mg: 3 }, at('2026-10-14T07:00:00Z')),
      ],
      60, // UTC+1: the late snack is just after midnight on the 14th
    );
    expect(days.map((d) => [d.date, d.entries, d.totals.iron_mg])).toEqual([
      ['2026-10-13', 1, 2],
      ['2026-10-14', 2, 4],
    ]);
  });
});

describe('nutrientStatus', () => {
  const day = nutrientDay('2026-10-14', KNOWN_DAY);
  const low = nutrientDay('2026-10-14', LOW_DAY);

  it('judges only full enough days with enough coverage', () => {
    expect(isJudgedDay(day, 2000)).toBe(true);
    // Under 40% of the goal, or a single entry
    expect(isJudgedDay(day, 4000)).toBe(false);
    expect(isJudgedDay(nutrientDay('d', KNOWN_DAY.slice(4)), 1000)).toBe(false);

    expect(nutrientStatus('iron_mg', low, 18, true)).toBe('low');
    expect(nutrientStatus('iron_mg', low, 18, false)).toBeNull();
    // Folate is carried by only 28% of the day's calories
    expect(day.coverage.folate_ug).toBeLessThan(MIN_NUTRIENT_COVERAGE);
    expect(nutrientStatus('folate_ug', day, 400, true)).toBeNull();
    // No data at all is never low
    expect(nutrientStatus('vit_c_mg', low, 75, true)).toBeNull();
  });

  it('pro-rates the low line to coverage', () => {
    const partial = nutrientDay('2026-10-14', [
      log('Soup', 700, { iron_mg: 7 }),
      log('Manual', 300, null),
    ]);
    // 0.67 × 18 × 0.7 = 8.44: 7 mg is low, 9 mg is not
    expect(LOW_FRACTION * 18 * 0.7).toBeCloseTo(8.442);
    expect(nutrientStatus('iron_mg', partial, 18, true)).toBe('low');
    const better = nutrientDay('2026-10-14', [
      log('Soup', 700, { iron_mg: 9 }),
      log('Manual', 300, null),
    ]);
    expect(nutrientStatus('iron_mg', better, 18, true)).toBe('ok');
  });

  it('calls limits over or ok, never low, and has nothing to say about energy', () => {
    expect(nutrientStatus('sodium_mg', day, 2300, true)).toBe('ok');
    expect(nutrientStatus('sat_fat_g', day, 22, true)).toBe('ok');
    const salty = nutrientDay('2026-10-14', [
      log('Ramen', 500, { sodium_mg: 1900, sat_fat_g: 0.1 }),
      log('Crisps', 300, { sodium_mg: 600, sat_fat_g: 0.1 }),
    ]);
    expect(nutrientStatus('sodium_mg', salty, 2300, true)).toBe('over');
    expect(nutrientStatus('sat_fat_g', salty, 22, true)).toBe('ok');
    expect(nutrientStatus('protein_g', day, 150, true)).toBeNull();
    expect(nutrientStatus('kcal', day, 2000, true)).toBeNull();
    expect(nutrientStatus('iron_mg', low, null, true)).toBeNull();
  });

  it('lists the target nutrients low on a day', () => {
    expect(lowOnDay(low, woman)).toEqual(['fibre_g', 'iron_mg']);
    expect(lowOnDay(day, woman)).toEqual([]);
    expect(percentOfTarget(low, 'iron_mg', 18)).toBe(15);
  });
});

describe('oftenLow', () => {
  const low = nutrientDay('2026-10-12', LOW_DAY);
  const fine = nutrientDay('2026-10-14', KNOWN_DAY);

  it('needs more than half of at least three judged days', () => {
    expect(oftenLow([low, low, fine], woman)).toEqual([
      { code: 'iron_mg', lowDays: 2, days: 3, avgPercent: 34 },
      { code: 'fibre_g', lowDays: 2, days: 3, avgPercent: 44 },
    ]);
    // Two days aren't enough, and half isn't most
    expect(oftenLow([low, low], woman)).toEqual([]);
    expect(oftenLow([low, low, fine, fine], woman)).toEqual([]);
    expect(oftenLow([low, low], woman, 2)).toHaveLength(2);
  });

  it("doesn't count days without data for that nutrient", () => {
    const noData = nutrientDay('2026-10-13', [
      log('Manual', 900, null),
      log('Manual', 600, null),
    ]);
    const result = oftenLow([low, low, noData, noData], woman);
    expect(result).toEqual([]);
    expect(anyJudged([noData])).toBe(false);
    // One judged day isn't enough to say nothing was often low
    expect(anyJudged([low])).toBe(false);
    expect(anyJudged([low, low, low])).toBe(true);
    expect(anyJudged([low], 1)).toBe(true);
  });

  it('only ever lists target nutrients', () => {
    const salty = nutrientDay('2026-10-14', [
      log('Ramen', 1500, { sodium_mg: 5000, kcal: 1500 }),
      log('Crisps', 300, { sodium_mg: 600, kcal: 300 }),
    ]);
    expect(oftenLow([salty, salty, salty], woman)).toEqual([]);
  });
});

describe('nutrientTargets', () => {
  it('adds the sodium and saturated-fat limits to the DRI targets', () => {
    expect(woman).toMatchObject({
      iron_mg: 18,
      fibre_g: 25,
      sodium_mg: 2300,
      sat_fat_g: 22,
    });
    const targetCodes = NUTRIENTS.filter((n) => n.kind !== 'none')
      .map((n) => n.code)
      .sort();
    expect(Object.keys(woman).sort()).toEqual(targetCodes);
  });

  it('uses the age on the date and the lower value without a sex', () => {
    const older = nutrientTargets(
      {
        gender: 'female',
        dateOfBirth: new Date('1975-10-15T00:00:00Z'),
        calorieGoal: 1800,
      },
      new Date('2026-10-15T00:00:00Z'),
    );
    expect(older.iron_mg).toBe(8); // 51 that day
    expect(older.sat_fat_g).toBe(20);
    const unknown = nutrientTargets(
      { gender: null, dateOfBirth: null, calorieGoal: 2000 },
      new Date(),
    );
    expect(unknown.iron_mg).toBe(8);
  });
});

describe('display rounding', () => {
  it('shows one decimal under 10 and whole numbers above', () => {
    expect(displayAmount(9.44)).toBe(9.4);
    expect(displayAmount(0.06)).toBe(0.06);
    expect(displayAmount(0.14)).toBe(0.14);
    expect(displayAmount(0.144)).toBe(0.14);
    expect(displayAmount(0)).toBe(0);
    expect(displayAmount(12.9)).toBe(13);
    expect(displayAmount(1750.4)).toBe(1750);
    expect(roundShare(723 / 1519)).toBe(0.48);
  });
});
