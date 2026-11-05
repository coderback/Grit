import { epley, parseDetail, platesFor, prOf, restSeconds, warmupsFor, withSet } from '../lib/strength';

describe('strength helpers', () => {
  it('works out plates per side', () => {
    expect(platesFor(100)).toEqual({ perSide: [25, 15], rest: 0 });
    expect(platesFor(62.5)).toEqual({ perSide: [20, 1.25], rest: 0 });
    expect(platesFor(61)).toEqual({ perSide: [20], rest: 1 });
    expect(platesFor(20)).toEqual({ perSide: [], rest: 0 });
  });

  it('builds warm-ups that climb to the working weight', () => {
    expect(warmupsFor(100)).toEqual([
      { weightKg: 20, reps: 10 },
      { weightKg: 40, reps: 5 },
      { weightKg: 60, reps: 3 },
      { weightKg: 80, reps: 2 },
    ]);
    // Light weights skip steps that would be at or below the bar
    expect(warmupsFor(40).map((s) => s.weightKg)).toEqual([20, 25, 32.5]);
    expect(warmupsFor(20)).toEqual([]);
  });

  it('marks PRs only against earlier history, updating as sets are done', () => {
    const none = { e1rm: null, weightKg: null, reps: null };
    expect(prOf({ reps: 5, weightKg: 100 }, none)).toBeNull();
    const before = { e1rm: 110, weightKg: 95, reps: null };
    expect(prOf({ reps: 5, weightKg: 100 }, before)).toBe('weight');
    expect(prOf({ reps: 8, weightKg: 90 }, before)).toBe('e1rm');
    expect(prOf({ reps: 5, weightKg: 100, warmup: true }, before)).toBeNull();
    const after = withSet(before, { reps: 5, weightKg: 100 });
    expect(after.weightKg).toBe(100);
    expect(prOf({ reps: 5, weightKg: 100 }, after)).toBeNull();
    expect(prOf({ reps: 13 }, { ...none, reps: 12 })).toBe('reps');
  });

  it('rests by set type and reads plan details', () => {
    expect(restSeconds('warmup', true)).toBe(45);
    expect(restSeconds('superset', true)).toBe(0);
    expect(restSeconds('working', true)).toBeGreaterThan(restSeconds('working', false));
    expect(epley(100, 5)).toBe(116.7);
    expect(parseDetail('3 × 8–12')).toEqual({ kind: 'reps', sets: 3, repsLow: 8, repsHigh: 12 });
    expect(parseDetail('3 × 30 s')).toEqual({ kind: 'timed', sets: 3, seconds: 30 });
    expect(parseDetail('20 min easy')).toBeNull();
  });
});
