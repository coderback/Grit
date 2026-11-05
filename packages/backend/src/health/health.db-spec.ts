import { TestDb } from '../test-utils/db';
import { addDays, dateMarker, localToday } from '../common/day';
import { WeightService } from '../progress/weight.service';
import { ChallengesService } from '../challenges/challenges.service';
import { HealthService } from './health.service';
import { UsersService } from '../users/users.service';
import { ageOn } from '../common/safety';

describe('HealthService (database)', () => {
  const db = new TestDb();
  const health = new HealthService(db.prisma, new WeightService(db.prisma));
  const challenges = new ChallengesService(db.prisma, db.notifications);
  const today = localToday(0);
  afterAll(() => db.cleanup());

  const run = (
    externalId: string,
    minutes: number,
    at = new Date(Date.now() - 3_600_000),
  ) => ({
    externalId,
    activityType: 'running',
    startedAt: at.toISOString(),
    durationMin: minutes,
  });

  it('imports workouts once, updating them when sent again', async () => {
    const u = await db.user();
    const first = await health.import(
      u.supabaseId,
      {
        source: 'healthkit',
        workouts: [run('hk-1', 30), run('hk-2', 20)],
        days: [],
        weights: [],
        metrics: [],
      },
      0,
    );
    expect(first.workouts).toEqual({ created: 2, updated: 0 });
    const again = await health.import(
      u.supabaseId,
      {
        source: 'healthkit',
        workouts: [run('hk-1', 35)],
        days: [],
        weights: [],
        metrics: [],
      },
      0,
    );
    expect(again.workouts).toEqual({ created: 0, updated: 1 });

    const logs = await db.prisma.activityLog.findMany({
      where: { userId: u.id },
      orderBy: { durationMin: 'asc' },
    });
    expect(logs.map((l) => [l.externalId, l.durationMin, l.source])).toEqual([
      ['hk-2', 20, 'healthkit'],
      ['hk-1', 35, 'healthkit'],
    ]);
    // Calories estimated when the health app didn't give them
    expect(logs[0].caloriesBurned).toBeGreaterThan(0);
  });

  it('stores daily steps and sleep, and weigh-ins with the latest on the profile', async () => {
    const u = await db.user();
    const yesterday = addDays(today, -1);
    await health.import(
      u.supabaseId,
      {
        source: 'health_connect',
        workouts: [],
        days: [
          { date: yesterday, steps: 8000, sleepMinutes: 410 },
          { date: today, steps: 2500 },
        ],
        weights: [
          { date: today, weightKg: 79.4 },
          { date: yesterday, weightKg: 80 },
        ],
        metrics: [],
      },
      0,
    );
    // A later sync only updates what it sends
    await health.import(
      u.supabaseId,
      {
        source: 'health_connect',
        workouts: [],
        days: [{ date: today, steps: 6100 }],
        weights: [],
        metrics: [],
      },
      0,
    );

    const recent = await health.recent(u.supabaseId, 0);
    expect(recent.days).toEqual([
      {
        date: yesterday,
        steps: 8000,
        sleepMinutes: 410,
        source: 'health_connect',
      },
      {
        date: today,
        steps: 6100,
        sleepMinutes: null,
        source: 'health_connect',
      },
    ]);
    expect(
      (await db.prisma.user.findUnique({ where: { id: u.id } }))?.weightKg,
    ).toBe(79.4);
  });

  it('ignores data older than two months', async () => {
    const u = await db.user();
    const old = new Date(Date.now() - 90 * 86_400_000);
    const res = await health.import(
      u.supabaseId,
      {
        source: 'healthkit',
        workouts: [run('old-1', 30, old)],
        days: [{ date: addDays(today, -90), steps: 9000 }],
        weights: [],
        metrics: [],
      },
      0,
    );
    expect(res).toEqual({
      workouts: { created: 0, updated: 0 },
      days: 0,
      weights: 0,
      metrics: { stored: 0, skipped: 0 },
    });
  });

  it('step challenges count the phone total without double-counting logged walks', async () => {
    const u = await db.user();
    const c = await challenges.createChallenge(
      u.supabaseId,
      { title: 'Steps', type: 'steps', goalValue: 20000, durationDays: 7 },
      0,
    );
    // Today: a logged walk with 3,000 steps, and the phone counted 7,000 in total
    await db.prisma.activityLog.create({
      data: {
        userId: u.id,
        activityType: 'walking',
        durationMin: 30,
        steps: 3000,
        loggedAt: new Date(),
      },
    });
    await db.prisma.healthDay.create({
      data: {
        userId: u.id,
        day: dateMarker(today),
        steps: 7000,
        source: 'healthkit',
      },
    });
    // Before the challenge started: not counted
    await db.prisma.healthDay.create({
      data: {
        userId: u.id,
        day: dateMarker(addDays(today, -3)),
        steps: 12000,
        source: 'healthkit',
      },
    });

    const view = await challenges.getChallenge(u.supabaseId, c.id);
    expect(view.totalProgress).toBe(7000);
  });
  it('uses heart rate for calories when the device gave none, and a second sync changes nothing', async () => {
    const u = await db.user();
    await db.prisma.user.update({
      where: { id: u.id },
      data: {
        weightKg: 80,
        gender: 'male',
        dateOfBirth: new Date('1996-01-01'),
      },
    });
    const at = new Date(Date.now() - 3_600_000).toISOString();
    const body = {
      source: 'health_connect' as const,
      workouts: [
        {
          ...run('hc-hr', 60),
          startedAt: at,
          avgHeartRate: 140,
          distanceM: 9800.4,
        },
        {
          ...run('hc-dev', 30),
          startedAt: at,
          caloriesBurned: 250,
          avgHeartRate: 150,
        },
        { ...run('hc-low', 30), startedAt: at, avgHeartRate: 80 },
      ],
      days: [{ date: today, steps: 4000, sleepMinutes: 420 }],
      weights: [],
      metrics: [
        { date: today, metric: 'resting_hr', value: 54 },
        {
          date: today,
          metric: 'hrv',
          type: 'rmssd',
          value: 61.2,
          device: 'Pixel Watch 3',
        },
        { date: today, metric: 'vo2max', value: 48 },
        // Out of range, and HRV without its type: both skipped
        { date: today, metric: 'resting_hr', value: 400 },
        { date: addDays(today, -1), metric: 'hrv', value: 50 },
        // Cycle data without its consent: skipped
        { date: today, metric: 'menstrual_flow', value: 2 },
      ],
    };
    const first = await health.import(u.supabaseId, body, 0);
    expect(first.workouts).toEqual({ created: 3, updated: 0 });
    expect(first.metrics).toEqual({ stored: 3, skipped: 3 });

    const logs = await db.prisma.activityLog.findMany({
      where: { userId: u.id },
    });
    const by = (id: string) => logs.find((l) => l.externalId === id)!;
    // Keytel et al.: (-55.0969 + 0.6309×140 + 0.1988×80 + 0.2017×age) / 4.184 per minute
    const age = ageOn(new Date('1996-01-01'), new Date(at));
    const perMin =
      (-55.0969 + 0.6309 * 140 + 0.1988 * 80 + 0.2017 * age) / 4.184;
    expect(by('hc-hr')).toMatchObject({
      calorieMethod: 'heart_rate',
      caloriesBurned: Math.round(perMin * 60),
      avgHeartRate: 140,
      distanceM: 9800,
    });
    // The device's own figure comes first
    expect(by('hc-dev')).toMatchObject({
      calorieMethod: 'device',
      caloriesBurned: 250,
    });
    // Below the equation's range: the MET estimate
    expect(by('hc-low').calorieMethod).toBe('met');

    const again = await health.import(u.supabaseId, body, 0);
    expect(again).toMatchObject({
      workouts: { created: 0, updated: 0 },
      days: 0,
      metrics: { stored: 0, skipped: 3 },
    });

    const recent = await health.recent(u.supabaseId, 0);
    expect(
      recent.recovery.map((m) => [m.metric, m.type, m.latest]).sort(),
    ).toEqual([
      ['hrv', 'rmssd', 61.2],
      ['resting_hr', null, 54],
      ['vo2max', null, 48],
    ]);
  });

  it('keeps cycle data only with its own consent, and deletes it when withdrawn', async () => {
    const u = await db.user();
    const users = new UsersService(
      db.prisma,
      {} as never,
      new WeightService(db.prisma),
    );
    await users.updateUser(u.supabaseId, { consentCycleData: true });
    const res = await health.import(
      u.supabaseId,
      {
        source: 'healthkit',
        workouts: [],
        days: [],
        weights: [],
        metrics: [
          { date: today, metric: 'menstrual_flow', value: 2 },
          { date: addDays(today, -1), metric: 'menstrual_flow', value: 3 },
          { date: today, metric: 'resting_hr', value: 60 },
        ],
      },
      0,
    );
    expect(res.metrics).toEqual({ stored: 3, skipped: 0 });
    expect(await health.cycleSummary(u.supabaseId)).toEqual({
      consent: true,
      days: 2,
    });
    // Never in the recovery summary the coach and app read
    const recent = await health.recent(u.supabaseId, 0);
    expect(recent.recovery.map((m) => m.metric)).toEqual(['resting_hr']);

    await users.updateUser(u.supabaseId, { consentCycleData: false });
    expect(await health.cycleSummary(u.supabaseId)).toEqual({
      consent: false,
      days: 0,
    });
    expect(
      await db.prisma.healthMetric.count({
        where: { userId: u.id, metric: 'resting_hr' },
      }),
    ).toBe(1);
  });
});
