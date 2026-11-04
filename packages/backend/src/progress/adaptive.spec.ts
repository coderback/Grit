import {
  estimateExpenditure,
  isLoggedDay,
  suggestTarget,
  weightTrend,
  type AdaptiveDay,
} from './adaptive';

/** n days, eating `intake`, weight moving `kgPerDay` from 80 kg, weighed every `every` days. */
function series(
  n: number,
  intake: number | null,
  kgPerDay: number,
  every = 1,
): AdaptiveDay[] {
  return Array.from({ length: n }, (_, i) => ({
    date: `d${i}`,
    intake,
    weightKg: i % every === 0 ? 80 + kgPerDay * i : null,
  }));
}

describe('adaptive targets', () => {
  it('judges whether a day was logged fully', () => {
    expect(isLoggedDay(1500, 3, 2000)).toBe(true);
    expect(isLoggedDay(600, 3, 2000)).toBe(false);
    expect(isLoggedDay(1500, 1, 2000)).toBe(false);
  });

  it('smooths weigh-ins and carries the trend over gaps', () => {
    const t = weightTrend([
      { date: 'a', intake: null, weightKg: 80 },
      { date: 'b', intake: null, weightKg: null },
      { date: 'c', intake: null, weightKg: 82 },
    ]);
    expect(t).toEqual([80, 80, 80.2]);
  });

  it('needs enough days, logging and weigh-ins', () => {
    expect(estimateExpenditure(series(10, 2000, 0), 2400)).toBeNull();
    expect(estimateExpenditure(series(28, null, 0), 2400)).toBeNull();
    expect(estimateExpenditure(series(28, 2000, 0, 10), 2400)).toBeNull();
  });

  it('finds maintenance when weight holds steady', () => {
    const est = estimateExpenditure(series(28, 2300, 0), 2300)!;
    expect(est.tdee).toBe(2300);
    expect(est.confidence).toBe('high');
    expect(est.trendKgPerWeek).toBe(0);
  });

  it('sees a higher burn when eating 2,000 while losing weight', () => {
    // Losing 0.5 kg/week on 2,000 kcal → 2,000 + 0.5 × 7,700 / 7 = 2,550 burned
    const est = estimateExpenditure(series(28, 2000, -0.5 / 7), null)!;
    expect(est.tdee).toBe(2550);
    expect(est.trendKgPerWeek).toBe(-0.5);
  });

  it('is steady against noisy weigh-ins', () => {
    const noise = [0.6, -0.4, 0.2, -0.7, 0.5, -0.1, 0.3, -0.5];
    const days = series(28, 2000, -0.5 / 7).map((d, i) => ({
      ...d,
      weightKg: d.weightKg! + noise[i % noise.length],
    }));
    const est = estimateExpenditure(days, null)!;
    expect(Math.abs(est.tdee - 2550)).toBeLessThan(120);
  });

  it('leans on the formula when data is thin', () => {
    const thin = series(14, 2000, 0, 3).map((d, i) => ({
      ...d,
      intake: i % 1 === 0 ? 2000 : null,
    }));
    const est = estimateExpenditure(thin, 3000)!;
    expect(est.tdee).toBeGreaterThan(2000);
    expect(est.confidence).toBe('low');
  });

  it('suggests a target for the goal in limited steps', () => {
    const est = {
      tdee: 2600,
      confidence: 'high' as const,
      loggedDays: 28,
      weighIns: 20,
      spanDays: 28,
      trendKgPerWeek: -0.2,
      avgIntake: 2400,
    };
    // Ideal for losing 0.5 kg/week is 2,050; from 2,400 the first step is −200
    const s = suggestTarget(est, 2400, 'lose_weight', 'moderate')!;
    expect(s).toMatchObject({
      current: 2400,
      suggested: 2200,
      change: -200,
      ideal: 2050,
    });
    expect(s.reason).toContain('losing 0.2 kg a week');
    // Already there: nothing to suggest
    expect(suggestTarget(est, 2060, 'lose_weight', 'moderate')).toBeNull();
    // Maintaining, eating too little
    expect(suggestTarget(est, 2300, 'maintain', null)?.suggested).toBe(2500);
    // Never below the floor
    expect(
      suggestTarget({ ...est, tdee: 1300 }, 1400, 'lose_weight', 'aggressive')
        ?.suggested,
    ).toBe(1200);
  });
});
