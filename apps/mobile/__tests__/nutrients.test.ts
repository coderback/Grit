import {
  amountText, barFraction, barTone, coverageNote, formatAmount, lowDaysText, nutrientA11yLabel, nutrientSections,
  percentText, sourcesLine, statusTag, type DayNutrient,
} from '@/lib/nutrients';

const nutrient = (over: Partial<DayNutrient>): DayNutrient => ({
  code: 'iron_mg', name: 'Iron', unit: 'mg', group: 'mineral', kind: 'target',
  amount: 9.4, target: 18, percent: 52, coverage: 0.8, status: 'low', sources: [],
  ...over,
});

describe('nutrient amounts', () => {
  it('rounds to a sensible precision', () => {
    expect(formatAmount(1840.4)).toBe('1,840');
    expect(formatAmount(18)).toBe('18');
    expect(formatAmount(12.6)).toBe('13');
    expect(formatAmount(9.44)).toBe('9.4');
    expect(formatAmount(0.354)).toBe('0.35');
    expect(formatAmount(0)).toBe('0');
    expect(formatAmount(-1)).toBe('0');
  });
  it('shows amount against target or limit', () => {
    expect(amountText(nutrient({}))).toBe('9.4 / 18 mg');
    expect(amountText(nutrient({ code: 'sodium_mg', kind: 'limit', amount: 1840, target: 2300 }))).toBe('1,840 / 2,300 mg max');
    expect(amountText(nutrient({ unit: 'µg', amount: 2.4, target: null }))).toBe('2.4 µg');
  });
  it('shows percent and fills the bar up to full', () => {
    expect(percentText(52)).toBe('52%');
    expect(percentText(null)).toBe('');
    expect(barFraction(52)).toBeCloseTo(0.52);
    expect(barFraction(140)).toBe(1);
    expect(barFraction(null)).toBe(0);
  });
});

describe('nutrient status', () => {
  it('only calls a nutrient low or over when the server judged it', () => {
    expect(statusTag('low')).toEqual({ text: 'Low', tone: 'orange' });
    expect(statusTag('over')).toEqual({ text: 'Over the limit', tone: 'error' });
    expect(statusTag('ok')).toBeNull();
    expect(statusTag(null)).toEqual({ text: 'not enough data', tone: 'muted' });
  });
  it('colours the bar by status, grey without data', () => {
    expect(barTone('low')).toBe('orange');
    expect(barTone('ok')).toBe('teal');
    expect(barTone('over')).toBe('error');
    expect(barTone(null)).toBe('muted');
  });
  it('tags nothing but a passed limit while today is in progress', () => {
    expect(statusTag(null, true)).toBeNull();
    expect(statusTag('over', true)).toEqual({ text: 'Over the limit', tone: 'error' });
    expect(barTone(null, true)).toBe('blue');
    expect(barTone('over', true)).toBe('error');
    expect(nutrientA11yLabel(nutrient({ status: null }), true)).toBe('Iron: 9.4 of 18 mg, 52%');
    expect(nutrientA11yLabel(nutrient({ status: null }))).toBe('Iron: 9.4 of 18 mg, 52%, not enough data');
  });
  it('reads out for screen readers', () => {
    expect(nutrientA11yLabel(nutrient({}))).toBe('Iron: 9.4 of 18 mg, 52%, low');
    expect(nutrientA11yLabel(nutrient({ status: 'ok', percent: 110, amount: 19.8 }))).toBe('Iron: 20 of 18 mg, 110%');
  });
  it('never uses diagnostic words', () => {
    const words = [statusTag('low'), statusTag('over'), statusTag(null)].map((t) => t?.text ?? '').join(' ');
    expect(words).not.toMatch(/deficien/i);
  });
});

describe('good sources', () => {
  const sources = [{ name: 'Spinach, raw', amount: 2.7 }, { name: 'Tea', amount: 0.1 }];
  it('lists foods giving a good share of a target', () => {
    expect(sourcesLine(nutrient({ sources }), true)).toBe('Good sources today: Spinach, raw (2.7 mg)');
    expect(sourcesLine(nutrient({ sources }), false)).toBe('Good sources: Spinach, raw (2.7 mg)');
    expect(sourcesLine(nutrient({ sources: [{ name: 'Tea', amount: 0.1 }] }), true)).toBeNull();
    expect(sourcesLine(nutrient({ sources: [] }), true)).toBeNull();
  });
  it('says where a limit came from only when over it', () => {
    const sodium = nutrient({ code: 'sodium_mg', name: 'Sodium', group: 'energy', kind: 'limit', sources: [{ name: 'Bacon', amount: 800 }] });
    expect(sourcesLine({ ...sodium, status: 'over' }, true)).toBe('Mostly from: Bacon (800 mg)');
    expect(sourcesLine({ ...sodium, status: 'ok' }, true)).toBeNull();
  });
});

describe('sections', () => {
  it('groups vitamins, minerals, then fibre, sodium and saturated fat', () => {
    const all = [
      nutrient({ code: 'kcal', name: 'Energy', group: 'energy', kind: 'none' }),
      nutrient({ code: 'sat_fat_g', name: 'Saturated fat', group: 'energy', kind: 'limit' }),
      nutrient({ code: 'fibre_g', name: 'Fibre', group: 'energy', kind: 'target' }),
      nutrient({ code: 'sodium_mg', name: 'Sodium', group: 'energy', kind: 'limit' }),
      nutrient({ code: 'vit_c_mg', name: 'Vitamin C', group: 'vitamin' }),
      nutrient({ code: 'iron_mg', name: 'Iron', group: 'mineral' }),
      nutrient({ code: 'caffeine_mg', name: 'Caffeine', group: 'other', kind: 'none' }),
    ];
    expect(nutrientSections(all).map((s) => [s.title, s.items.map((n) => n.name)])).toEqual([
      ['Vitamins', ['Vitamin C']],
      ['Minerals', ['Iron']],
      ['Fibre, sodium and saturated fat', ['Fibre', 'Sodium', 'Saturated fat']],
    ]);
    expect(nutrientSections([nutrient({})]).map((s) => s.title)).toEqual(['Minerals']);
  });
});

describe('coverage note', () => {
  const today = '2026-11-06';
  const yesterday = '2026-11-05';
  it("says how much of the day's calories it's based on", () => {
    expect(coverageNote(0.64, today, today, yesterday)).toBe("Based on 64% of today's calories");
    expect(coverageNote(0.5, yesterday, today, yesterday)).toBe("Based on 50% of yesterday's calories");
    expect(coverageNote(0.5, '2026-11-01', today, yesterday)).toBe("Based on 50% of the day's calories");
    expect(coverageNote(0.002, today, today, yesterday)).toBe("Based on 1% of today's calories");
    expect(coverageNote(1, today, today, yesterday)).toBe("Based on all of today's calories");
  });
});

describe('often low', () => {
  it('counts the low days', () => {
    expect(lowDaysText({ lowDays: 4, days: 4 })).toBe('low on 4 of 4 days');
    expect(lowDaysText({ lowDays: 1, days: 1 })).toBe('low on 1 of 1 day');
  });
});
