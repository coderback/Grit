import {
  deloadWeight,
  nextWeight,
  NO_RECOVERY,
  suggest,
  type ExerciseFacts,
  type PastSession,
  type Recovery,
} from './progression';

const squat: ExerciseFacts = {
  name: 'Barbell Squat',
  equipment: ['barbell'],
  pattern: 'squat',
  primary: ['quadriceps'],
};
const bench: ExerciseFacts = {
  name: 'Bench Press',
  equipment: ['barbell'],
  pattern: 'horizontal_press',
  primary: ['chest'],
};
const dbPress: ExerciseFacts = {
  name: 'Dumbbell Shoulder Press',
  equipment: ['dumbbell'],
  pattern: 'vertical_press',
  primary: ['shoulders'],
};
const pullups: ExerciseFacts = {
  name: 'Pullups',
  equipment: ['bodyweight'],
  pattern: 'vertical_pull',
  primary: ['lats'],
};
const range = { sets: 3, repsLow: 8, repsHigh: 12 };
const session = (
  date: string,
  weightKg: number | null,
  ...reps: number[]
): PastSession => ({
  date,
  sets: reps.map((r) => ({ reps: r, weightKg })),
});
const TODAY = '2026-11-20';

describe('progression rules', () => {
  it('starts with no history', () => {
    const s = suggest(bench, [], range, NO_RECOVERY, TODAY);
    expect(s.action).toBe('start');
    expect(s.weightKg).toBeNull();
    expect(s.reps).toBe(8);
  });

  it('adds a step once every set reaches the top of the range', () => {
    const s = suggest(
      bench,
      [session('2026-11-17', 80, 12, 12, 12)],
      range,
      NO_RECOVERY,
      TODAY,
    );
    expect(s).toMatchObject({ action: 'increase', weightKg: 82.5, reps: 8 });
    expect(s.reasons[0]).toContain('up to 82.5 kg');
    // Lower body moves in bigger steps
    expect(
      suggest(
        squat,
        [session('2026-11-17', 120, 12, 12, 12)],
        range,
        NO_RECOVERY,
        TODAY,
      ).weightKg,
    ).toBe(125);
  });

  it('holds the weight until every set gets there', () => {
    const s = suggest(
      bench,
      [session('2026-11-17', 80, 12, 11, 9)],
      range,
      NO_RECOVERY,
      TODAY,
    );
    expect(s).toMatchObject({ action: 'hold', weightKg: 80, reps: 10 });
    // Fewer sets than planned isn't "every set"
    expect(
      suggest(
        bench,
        [session('2026-11-17', 80, 12, 12)],
        range,
        NO_RECOVERY,
        TODAY,
      ).action,
    ).toBe('hold');
  });

  it('never jumps more than 5% or one step', () => {
    // 5% of 40 kg is 2 kg, less than the 5 kg lower-body step
    expect(nextWeight(40, squat)).toBe(42);
    expect(nextWeight(200, squat)).toBe(205);
    // A 2 kg dumbbell jump is over 5% below 40 kg: add reps instead
    expect(nextWeight(20, dbPress)).toBeNull();
    const s = suggest(
      dbPress,
      [session('2026-11-17', 20, 12, 12, 12)],
      range,
      NO_RECOVERY,
      TODAY,
    );
    expect(s).toMatchObject({ action: 'reps', weightKg: 20, reps: 13 });
    expect(nextWeight(8, bench)).toBeNull();
  });

  it('deloads 10% after two sessions without progress', () => {
    const stuck = [
      session('2026-11-17', 100, 10, 9, 8),
      session('2026-11-10', 100, 10, 9, 8),
      session('2026-11-03', 100, 10, 9, 8),
    ];
    const s = suggest(squat, stuck, range, NO_RECOVERY, TODAY);
    expect(s).toMatchObject({ action: 'deload', weightKg: 90 });
    expect(s.reasons[0]).toContain('two sessions');
    // One more rep counts as progress
    const moving = [session('2026-11-17', 100, 10, 9, 9), ...stuck.slice(1)];
    expect(suggest(squat, moving, range, NO_RECOVERY, TODAY).action).toBe(
      'hold',
    );
    // The session after a deload isn't a stall
    const afterDeload = [
      session('2026-11-17', 90, 10, 9, 8),
      ...stuck.slice(1),
    ];
    expect(suggest(squat, afterDeload, range, NO_RECOVERY, TODAY).action).toBe(
      'hold',
    );
  });

  it('deloads after two missed weekly sessions', () => {
    const s = suggest(
      bench,
      [session('2026-10-28', 80, 12, 12, 12)],
      range,
      NO_RECOVERY,
      TODAY,
    );
    expect(s).toMatchObject({ action: 'deload', weightKg: 72 });
    expect(s.reasons[0]).toContain('3 weeks');
    expect(deloadWeight(22, dbPress)).toBe(20);
  });

  it('holds increases in a big deficit, on low protein and after short sleep', () => {
    const ready = [session('2026-11-17', 80, 12, 12, 12)];
    const deficit: Recovery = { ...NO_RECOVERY, dailyBalanceKcal: -650 };
    const s1 = suggest(bench, ready, range, deficit, TODAY);
    expect(s1).toMatchObject({
      action: 'hold',
      weightKg: 80,
      holds: ['deficit'],
    });
    expect(s1.reasons[0]).toContain('650 kcal');

    const protein: Recovery = {
      ...NO_RECOVERY,
      loggedDays: 6,
      lowProteinDays: 4,
      proteinTargetG: 128,
    };
    expect(suggest(bench, ready, range, protein, TODAY).reasons[0]).toContain(
      '128 g on 4 of 6',
    );
    // Too few logged days to say
    expect(
      suggest(
        bench,
        ready,
        range,
        { ...protein, loggedDays: 3, lowProteinDays: 3 },
        TODAY,
      ).action,
    ).toBe('increase');

    const sleep: Recovery = { ...NO_RECOVERY, sleepMinutes: 310 };
    const s3 = suggest(bench, ready, range, sleep, TODAY);
    expect(s3.holds).toEqual(['sleep']);
    expect(s3.reasons[0]).toBe(
      "You slept 5 h 10 m last night: keeping today's weights.",
    );

    // A 400 kcal deficit is fine
    expect(
      suggest(
        bench,
        ready,
        range,
        { ...NO_RECOVERY, dailyBalanceKcal: -400 },
        TODAY,
      ).action,
    ).toBe('increase');
  });

  it("holds instead of deloading a stall that's expected in a deficit", () => {
    const stuck = [
      session('2026-11-17', 100, 10, 9, 8),
      session('2026-11-10', 100, 10, 9, 8),
      session('2026-11-03', 100, 10, 9, 8),
    ];
    const s = suggest(
      squat,
      stuck,
      range,
      { ...NO_RECOVERY, dailyBalanceKcal: -700 },
      TODAY,
    );
    expect(s).toMatchObject({ action: 'hold', weightKg: 100 });
  });

  it('progresses bodyweight exercises by reps', () => {
    const s = suggest(
      pullups,
      [session('2026-11-17', null, 10, 8, 7)],
      range,
      NO_RECOVERY,
      TODAY,
    );
    expect(s).toMatchObject({ action: 'reps', weightKg: null, reps: 11 });
  });

  it('never suggests more than 5% over the last weight, over scripted histories', () => {
    const exercises = [squat, bench, dbPress, pullups];
    const recoveries: Recovery[] = [
      NO_RECOVERY,
      { ...NO_RECOVERY, dailyBalanceKcal: -800 },
      { ...NO_RECOVERY, sleepMinutes: 300 },
    ];
    let checked = 0;
    for (const e of exercises) {
      for (let w = 5; w <= 250; w += 2.5) {
        for (const reps of [
          [12, 12, 12],
          [8, 8, 8],
          [12, 12, 11],
          [12, 12],
        ]) {
          for (const r of recoveries) {
            const history = [
              session('2026-11-17', w, ...reps),
              session('2026-11-10', w, ...reps),
            ];
            const s = suggest(e, history, range, r, TODAY);
            if (s.weightKg != null) {
              expect(s.weightKg).toBeLessThanOrEqual(w * 1.05 + 1e-9);
            }
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });
});
