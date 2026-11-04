import { androidExerciseType, appleWorkoutType, latestWeightPerDay, sleepByNight, toImportPayload } from '@/lib/health/transform';

const at = (iso: string) => new Date(iso);

describe('health transform', () => {
  it('maps workout types from both platforms', () => {
    expect(appleWorkoutType(37)).toBe('running');
    expect(appleWorkoutType(50)).toBe('strength_training');
    expect(appleWorkoutType(9999)).toBe('other');
    expect(androidExerciseType(79)).toBe('walking');
    expect(androidExerciseType(54)).toBe('rowing');
    expect(androidExerciseType(-1)).toBe('other');
  });

  it('counts overlapping sleep once and removes awake time', () => {
    const nights = sleepByNight([
      // Phone and watch both recorded 23:00–07:00
      { start: at('2026-11-03T23:00:00'), end: at('2026-11-04T07:00:00'), asleep: true },
      { start: at('2026-11-04T00:00:00'), end: at('2026-11-04T06:30:00'), asleep: true },
      // 30 minutes awake in the middle
      { start: at('2026-11-04T03:00:00'), end: at('2026-11-04T03:30:00'), asleep: false },
    ]);
    expect(nights).toEqual({ '2026-11-04': 450 });
  });

  it('keeps the last weigh-in of each day and drops silly values', () => {
    expect(
      latestWeightPerDay([
        { at: at('2026-11-04T07:00:00'), kg: 80.2 },
        { at: at('2026-11-04T20:00:00'), kg: 80.9 },
        { at: at('2026-11-03T07:00:00'), kg: 81 },
        { at: at('2026-11-02T07:00:00'), kg: 2 },
      ]),
    ).toEqual([
      { date: '2026-11-03', weightKg: 81 },
      { date: '2026-11-04', weightKg: 80.9 },
    ]);
  });

  it('builds the import body, merging steps and sleep per day', () => {
    const now = at('2026-11-04T12:00:00');
    const body = toImportPayload('healthkit', {
      workouts: [
        { id: 'hk:1', activityType: 'running', start: at('2026-11-04T07:00:00'), end: at('2026-11-04T07:32:30'), kcal: 310.6 },
        { id: 'hk:future', activityType: 'yoga', start: at('2026-11-05T07:00:00'), end: at('2026-11-05T08:00:00') },
      ],
      steps: [{ date: '2026-11-04', steps: 6400.4 }, { date: '2026-11-05', steps: 10 }],
      sleep: [{ start: at('2026-11-03T23:30:00'), end: at('2026-11-04T06:30:00'), asleep: true }],
      weights: [{ at: at('2026-11-04T07:00:00'), kg: 80.21 }],
    }, now);
    expect(body.workouts).toEqual([
      { externalId: 'hk:1', activityType: 'running', startedAt: at('2026-11-04T07:00:00').toISOString(), durationMin: 33, caloriesBurned: 311 },
    ]);
    expect(body.days).toEqual([{ date: '2026-11-04', steps: 6400, sleepMinutes: 420 }]);
    expect(body.weights).toEqual([{ date: '2026-11-04', weightKg: 80.21 }]);
  });
});
