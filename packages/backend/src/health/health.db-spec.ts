import { TestDb } from '../test-utils/db';
import { addDays, dateMarker, localToday } from '../common/day';
import { WeightService } from '../progress/weight.service';
import { ChallengesService } from '../challenges/challenges.service';
import { HealthService } from './health.service';

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
      },
      0,
    );
    expect(res).toEqual({
      workouts: { created: 0, updated: 0 },
      days: 0,
      weights: 0,
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
});
