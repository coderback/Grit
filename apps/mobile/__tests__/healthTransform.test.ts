import { androidExerciseType, appleWorkoutType, dailyMetrics, latestWeightPerDay, sleepByNight, temperatureDeviations, toImportPayload, toMetres } from '@/lib/health/transform';

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
      metrics: [],
    }, now);
    expect(body.workouts).toEqual([
      { externalId: 'hk:1', activityType: 'running', startedAt: at('2026-11-04T07:00:00').toISOString(), durationMin: 33, caloriesBurned: 311 },
    ]);
    expect(body.days).toEqual([{ date: '2026-11-04', steps: 6400, sleepMinutes: 420 }]);
    expect(body.weights).toEqual([{ date: '2026-11-04', weightKg: 80.21 }]);
  });

  it('turns readings into one value per metric per day', () => {
    const rows = dailyMetrics([
      // Apple takes several HRV readings overnight: averaged
      { metric: 'hrv', type: 'sdnn', at: at('2026-11-04T02:00:00'), value: 40 },
      { metric: 'hrv', type: 'sdnn', at: at('2026-11-04T05:00:00'), value: 50, device: 'Apple Watch' },
      // Resting heart rate: the day's latest
      { metric: 'resting_hr', at: at('2026-11-04T08:00:00'), value: 58 },
      { metric: 'resting_hr', at: at('2026-11-04T20:00:00'), value: 55 },
      // Flow: the heaviest of the day
      { metric: 'menstrual_flow', at: at('2026-11-04T08:00:00'), value: 1 },
      { metric: 'menstrual_flow', at: at('2026-11-04T18:00:00'), value: 3 },
      { metric: 'vo2max', at: at('2026-11-03T09:00:00'), value: 47.25 },
    ]);
    expect(rows).toEqual([
      { date: '2026-11-03', metric: 'vo2max', value: 47.25 },
      { date: '2026-11-04', metric: 'hrv', type: 'sdnn', value: 45, device: 'Apple Watch' },
      { date: '2026-11-04', metric: 'menstrual_flow', value: 3 },
      { date: '2026-11-04', metric: 'resting_hr', value: 55 },
    ]);
  });

  it("works out Apple's temperature as a deviation from earlier nights", () => {
    const nights = [36.1, 36.2, 36.0, 36.1, 36.1, 36.6].map((celsius, i) => ({ at: at(`2026-11-0${i + 1}T06:00:00`), celsius }));
    const dev = temperatureDeviations(nights);
    // Only the sixth night has five before it
    expect(dev).toHaveLength(1);
    expect(dev[0].value).toBe(0.5);
    expect(toMetres({ quantity: 5.2, unit: 'km' })).toBe(5200);
    expect(toMetres({ quantity: 1, unit: 'furlong' })).toBeUndefined();
  });

  it('sends heart rate and distance with workouts', () => {
    const body = toImportPayload('health_connect', {
      workouts: [{ id: 'hc:1', activityType: 'running', start: at('2026-11-04T07:00:00'), end: at('2026-11-04T07:45:00'), avgHeartRate: 151.4, distanceM: 8012.6 }],
      steps: [], sleep: [], weights: [], metrics: [{ metric: 'resting_hr', at: at('2026-11-04T08:00:00'), value: 52 }],
    }, at('2026-11-04T12:00:00'));
    expect(body.workouts[0]).toMatchObject({ avgHeartRate: 151, distanceM: 8013 });
    expect(body.metrics).toEqual([{ date: '2026-11-04', metric: 'resting_hr', value: 52 }]);
  });
});
