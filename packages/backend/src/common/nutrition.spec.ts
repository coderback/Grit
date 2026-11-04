import { calorieBudget, macroTargets } from './nutrition';

describe('macroTargets', () => {
  it('splits 30/40/30 for a balanced focus', () => {
    expect(macroTargets(2000, 'balanced')).toEqual({
      proteinG: 150,
      carbsG: 200,
      fatG: 67,
    });
  });

  it('shifts calories to protein or fat for other focuses', () => {
    expect(macroTargets(2000, 'high_protein').proteinG).toBe(200);
    expect(macroTargets(2000, 'low_carb')).toEqual({
      proteinG: 150,
      carbsG: 100,
      fatG: 111,
    });
  });

  it('falls back to balanced for an unknown focus', () => {
    expect(macroTargets(2000, 'keto')).toEqual(macroTargets(2000, 'balanced'));
  });
});

describe('calorieBudget', () => {
  const base = {
    calorieGoal: 2000,
    earnbackCalories: false,
    rolloverCalories: false,
    burnedToday: 350,
    eatenYesterday: 1500,
  };

  it('is just the goal with both options off', () => {
    expect(calorieBudget(base)).toEqual({
      goal: 2000,
      earnback: 0,
      rollover: 0,
      total: 2000,
    });
  });

  it('adds burned calories with earnback on', () => {
    expect(calorieBudget({ ...base, earnbackCalories: true }).total).toBe(2350);
  });

  it('carries over unused calories, capped at 200', () => {
    expect(calorieBudget({ ...base, rolloverCalories: true }).rollover).toBe(
      200,
    );
    expect(
      calorieBudget({ ...base, rolloverCalories: true, eatenYesterday: 1900 })
        .rollover,
    ).toBe(100);
  });

  it('never rolls over a negative amount', () => {
    expect(
      calorieBudget({ ...base, rolloverCalories: true, eatenYesterday: 2600 })
        .rollover,
    ).toBe(0);
  });

  it('gives no rollover for a day with nothing logged', () => {
    expect(
      calorieBudget({ ...base, rolloverCalories: true, eatenYesterday: null })
        .rollover,
    ).toBe(0);
  });

  it('combines both', () => {
    expect(
      calorieBudget({
        ...base,
        earnbackCalories: true,
        rolloverCalories: true,
        eatenYesterday: 1950,
      }),
    ).toEqual({ goal: 2000, earnback: 350, rollover: 50, total: 2400 });
  });
});
