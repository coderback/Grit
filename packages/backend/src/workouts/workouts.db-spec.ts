import type OpenAI from 'openai';
import { TestDb } from '../test-utils/db';
import { ExercisesService } from '../exercises/exercises.service';
import { AdaptiveService } from '../progress/adaptive.service';
import { TrendsService } from '../progress/trends.service';
import { SocialService } from '../social/social.service';
import { PrivacyService } from '../social/privacy.service';
import { ChallengesService } from '../challenges/challenges.service';
import { dateMarker, localToday } from '../common/day';
import { WorkoutsService } from './workouts.service';

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
const SQUAT = 'Barbell_Squat';
const PULLUPS = 'Pullups';

// The model, for the phrasings the rules can't read
function fakeModel(reply: unknown) {
  const calls: unknown[] = [];
  const client = {
    responses: {
      create: (req: unknown) => {
        calls.push(req);
        return Promise.resolve({ output_text: JSON.stringify(reply) });
      },
    },
  } as unknown as OpenAI;
  return { client, calls };
}

describe('WorkoutsService (database)', () => {
  const db = new TestDb();
  const exercises = new ExercisesService(db.prisma);
  const adaptive = new AdaptiveService(db.prisma, new TrendsService(db.prisma));
  const model = fakeModel({ sets: [] });
  const workouts = new WorkoutsService(
    db.prisma,
    adaptive,
    model.client,
    'test',
  );
  const privacy = new PrivacyService(db.prisma);
  const social = new SocialService(db.prisma, privacy, db.notifications);
  const challenges = new ChallengesService(db.prisma, db.notifications);
  beforeAll(async () => {
    if ((await db.prisma.exercise.count()) < 800) await exercises.seed();
  }, 60_000);
  afterAll(() => db.cleanup());

  let n = 0;
  const at = (daysAgo: number, hour = 9) => {
    const d = new Date(Date.now() - daysAgo * 86_400_000);
    d.setUTCHours(hour, 0, 0, 0);
    if (d > new Date()) d.setUTCDate(d.getUTCDate() - 1);
    return d;
  };
  const save = (
    supabaseId: string,
    daysAgo: number,
    sets: {
      exerciseId: string;
      reps: number;
      weightKg?: number;
      warmup?: boolean;
    }[],
    extra: Record<string, unknown> = {},
  ) =>
    workouts.save(supabaseId, {
      clientId: `client-${++n}-${Date.now()}`,
      startedAt: at(daysAgo).toISOString(),
      endedAt: new Date(at(daysAgo).getTime() + 50 * 60_000).toISOString(),
      sets,
      ...extra,
    });
  const three = (exerciseId: string, weightKg: number, ...reps: number[]) =>
    reps.map((r) => ({ exerciseId, reps: r, weightKg }));

  it('saves a workout once, as an activity log with sets', async () => {
    const u = await db.user();
    await db.prisma.user.update({
      where: { id: u.id },
      data: { weightKg: 80 },
    });
    const dto = {
      clientId: 'phone-abc-123',
      title: 'Upper body',
      startedAt: at(1).toISOString(),
      endedAt: new Date(at(1).getTime() + 45 * 60_000).toISOString(),
      sets: [
        { exerciseId: BENCH, reps: 10, weightKg: 40, warmup: true },
        ...three(BENCH, 80, 8, 8, 7),
        { exerciseId: PULLUPS, reps: 10 },
      ],
    };
    const first = await workouts.save(u.supabaseId, dto);
    // Sent again after a dropped connection: the same workout, not a copy
    const again = await workouts.save(u.supabaseId, dto);
    expect(again.id).toBe(first.id);
    expect(
      await db.prisma.workoutSession.count({ where: { userId: u.id } }),
    ).toBe(1);

    expect(first).toMatchObject({
      title: 'Upper body',
      setCount: 4,
      volumeKg: 80 * 23,
      prCount: 0,
    });
    expect(first.sets.map((s) => s.exerciseName)[1]).toBe(
      'Barbell Bench Press - Medium Grip',
    );
    const log = await db.prisma.activityLog.findUnique({
      where: { id: first.activityLog.id },
    });
    expect(log).toMatchObject({
      activityType: 'strength_training',
      durationMin: 45,
      calorieMethod: 'met',
    });
    // 5 MET × 80 kg × 0.75 h
    expect(log?.caloriesBurned).toBe(300);
  });

  it('marks PRs against earlier sessions and shows counts in the feed', async () => {
    const u = await db.user({ isPrivate: false });
    const friend = await db.user();
    await db.prisma.follow.create({
      data: { followerId: friend.id, followingId: u.id, status: 'accepted' },
    });
    await save(u.supabaseId, 8, three(BENCH, 80, 8, 8, 8));
    const s = await save(u.supabaseId, 1, [
      ...three(BENCH, 82.5, 8, 8, 6),
      { exerciseId: PULLUPS, reps: 12 },
    ]);
    expect(s.sets.map((x) => x.pr)).toEqual(['weight', null, null, null]);
    expect(s.prCount).toBe(1);

    const feed = await social.getFeed(friend.supabaseId);
    const item = feed.find((f) => f.id === s.activityLog.id);
    expect(item?.data).toMatchObject({
      activityType: 'strength_training',
      workout: { title: null, setCount: 4, prCount: 1 },
    });
    // No weights in the feed
    expect(JSON.stringify(item?.data)).not.toContain('82.5');
  });

  it('counts toward workout challenges like any other workout', async () => {
    const u = await db.user();
    const c = await challenges.createChallenge(
      u.supabaseId,
      { title: 'Lift', type: 'workouts', goalValue: 3, durationDays: 7 },
      0,
    );
    await save(u.supabaseId, 0, three(SQUAT, 100, 5, 5, 5));
    const board = await challenges.getChallenge(u.supabaseId, c.id);
    expect(board.totalProgress).toBe(1);
  });

  it('runs the plan by session order, wrapping round the week', async () => {
    const u = await db.user();
    const day = (d: string, rest: boolean) => ({
      day: d,
      rest,
      title: rest ? 'Rest' : `Day ${d}`,
      activityType: rest ? 'other' : 'strength_training',
      durationMin: rest ? 0 : 45,
      exercises: rest
        ? []
        : [{ exerciseId: SQUAT, name: 'Barbell Squat', detail: '3 × 5–8' }],
    });
    await db.prisma.workoutPlan.create({
      data: {
        userId: u.id,
        summary: '',
        daysPerWeek: 2,
        location: 'gym',
        generationDay: localToday(0),
        days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) =>
          day(d, !['mon', 'thu'].includes(d)),
        ),
      },
    });
    const next = async () =>
      (await db.prisma.workoutPlan.findUnique({ where: { userId: u.id } }))!
        .nextSession;
    expect(await next()).toBe(1);
    await save(u.supabaseId, 2, three(SQUAT, 100, 5, 5, 5), { planSession: 1 });
    expect(await next()).toBe(2);
    await save(u.supabaseId, 1, three(SQUAT, 100, 5, 5, 5), { planSession: 2 });
    expect(await next()).toBe(1);
  });

  it('prepares last time, records and targets, borrowing history for a swap', async () => {
    const u = await db.user();
    await db.prisma.user.update({
      where: { id: u.id },
      data: { weightKg: 80 },
    });
    await save(u.supabaseId, 7, three(BENCH, 80, 12, 12, 12));
    const res = await workouts.prepare(
      u.supabaseId,
      {
        exercises: [
          { exerciseId: BENCH, detail: '3 × 8–12' },
          // Same movement and equipment, never done: borrows the bench's history
          {
            exerciseId: 'Barbell_Incline_Bench_Press_-_Medium_Grip',
            detail: '3 × 8–12',
          },
          { exerciseId: 'Plank', detail: '3 × 30 s' },
        ].filter(Boolean),
      },
      0,
    );
    const [bench, wide, plank] = res.exercises;
    expect(bench.last?.sets).toHaveLength(3);
    expect(bench.records.weightKg).toBe(80);
    expect(bench.suggestion).toMatchObject({
      action: 'increase',
      weightKg: 82.5,
    });
    expect(wide.historyFrom?.id).toBe(BENCH);
    expect(wide.suggestion?.action).toBe('increase');
    expect(plank.timed).toEqual({ sets: 3, seconds: 30 });
    expect(plank.suggestion).toBeNull();
  });

  it('holds the weight after a short night', async () => {
    const u = await db.user();
    await save(u.supabaseId, 7, three(BENCH, 80, 12, 12, 12));
    await db.prisma.healthDay.create({
      data: {
        userId: u.id,
        day: dateMarker(localToday(0)),
        sleepMinutes: 300,
        source: 'healthkit',
      },
    });
    const res = await workouts.prepare(
      u.supabaseId,
      { exercises: [{ exerciseId: BENCH, detail: '3 × 8–12' }] },
      0,
    );
    expect(res.exercises[0].suggestion).toMatchObject({
      action: 'hold',
      weightKg: 80,
      holds: ['sleep'],
    });
    const lines = await workouts.coachLines(u, 0);
    expect(lines).toEqual([]); // no plan, no PRs this week
  });

  it('edits, then deletes with its activity log', async () => {
    const u = await db.user();
    const s = await save(u.supabaseId, 3, three(SQUAT, 100, 5, 5, 5));
    const edited = await workouts.update(u.supabaseId, s.id, {
      title: 'Legs',
      sets: three(SQUAT, 100, 5, 5, 4),
    });
    expect(edited).toMatchObject({
      title: 'Legs',
      setCount: 3,
      volumeKg: 1400,
    });
    const history = await workouts.history(u.supabaseId, SQUAT, 0);
    expect(history.sessions[0]).toMatchObject({
      topWeightKg: 100,
      bestE1rm: 116.7,
    });

    await workouts.remove(u.supabaseId, s.id);
    expect(await db.prisma.workoutSet.count({ where: { userId: u.id } })).toBe(
      0,
    );
    expect(await db.prisma.activityLog.count({ where: { userId: u.id } })).toBe(
      0,
    );
    // Someone else's workout isn't found
    const other = await db.user();
    const theirs = await save(other.supabaseId, 1, three(SQUAT, 60, 5));
    await expect(workouts.remove(u.supabaseId, theirs.id)).rejects.toThrow(
      'not found',
    );
  });

  it('refuses exercises that are not in the library', async () => {
    const u = await db.user();
    await expect(
      save(u.supabaseId, 1, [
        { exerciseId: 'Made_Up_Lift', reps: 5, weightKg: 50 },
      ]),
    ).rejects.toThrow('Unknown exercise');
  });

  it('reads simple phrasings without the model or AI consent', async () => {
    const u = await db.user({ aiConsent: false });
    const before = model.calls.length;
    const res = await workouts.parse(
      u.supabaseId,
      { text: 'bench 80 for 8, 8, 7', exerciseIds: [BENCH, SQUAT] },
      0,
    );
    expect(res.source).toBe('rules');
    expect(res.sets.map((s) => [s.exerciseId, s.reps, s.weightKg])).toEqual([
      [BENCH, 8, 80],
      [BENCH, 8, 80],
      [BENCH, 7, 80],
    ]);
    expect(model.calls.length).toBe(before);
    // Anything else needs consent for the model
    await expect(
      workouts.parse(
        u.supabaseId,
        { text: 'did a few heavy ones', exerciseIds: [BENCH] },
        0,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('asks the model for the rest, converting pounds and finding exercises by name', async () => {
    const u = await db.user();
    const m = fakeModel({
      sets: [
        {
          exerciseId: BENCH,
          exerciseName: 'bench',
          reps: 5,
          weight: 185,
          unit: 'lb',
          durationSec: null,
        },
        {
          exerciseId: '',
          exerciseName: 'Leg Press',
          reps: 12,
          weight: 140,
          unit: 'kg',
          durationSec: null,
        },
        {
          exerciseId: '',
          exerciseName: 'Nonsense lift',
          reps: 5,
          weight: 10,
          unit: 'kg',
          durationSec: null,
        },
      ],
    });
    const w = new WorkoutsService(db.prisma, adaptive, m.client, 'test');
    const res = await w.parse(
      u.supabaseId,
      {
        text: 'did bench, 185 pounds five times, then some leg press',
        exerciseIds: [BENCH],
      },
      0,
    );
    expect(res.source).toBe('ai');
    expect(res.sets.map((s) => [s.exerciseId, s.reps, s.weightKg])).toEqual([
      [BENCH, 5, 83.9],
      ['Leg_Press', 12, 140],
    ]);
    const row = await db.prisma.user.findUnique({ where: { id: u.id } });
    expect(row?.aiParseCount).toBe(1);
  });

  it('finds exercises by everyday names', async () => {
    const find = async (n: string) => (await workouts.findByName(n))?.id;
    expect(await find('Pull-ups')).toBe('Pullups');
    expect(await find('pull ups')).toBe('Pullups');
    expect(await find('Leg Press')).toBe('Leg_Press');
    expect(await find('barbell squat')).toBe('Barbell_Squat');
  });
});
