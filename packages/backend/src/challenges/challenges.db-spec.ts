import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TestDb } from '../test-utils/db';
import { ChallengesService } from './challenges.service';

describe('ChallengesService (database)', () => {
  const db = new TestDb();
  const challenges = new ChallengesService(db.prisma, db.notifications);
  const settle = () => new Promise((r) => setTimeout(r, 150));
  const inbox = (userId: string) =>
    db.prisma.notification.findMany({ where: { userId } });

  afterAll(() => db.cleanup());

  async function workout(
    userId: string,
    minutes: number,
    at = new Date(),
    steps?: number,
  ) {
    await db.prisma.activityLog.create({
      data: {
        userId,
        activityType: 'walking',
        durationMin: minutes,
        steps,
        loggedAt: at,
      },
    });
  }

  it('counts logged workouts in the window toward the goal', async () => {
    const ana = await db.user({ displayName: 'Cana' });
    const ben = await db.user({ displayName: 'Cben' });
    // Logged before the challenge: doesn't count
    await workout(ana.id, 90, new Date(Date.now() - 3 * 86_400_000));

    const c = await challenges.createChallenge(
      ana.supabaseId,
      {
        title: 'Minutes',
        type: 'active_minutes',
        goalValue: 60,
        durationDays: 7,
      },
      0,
    );
    await challenges.joinByInviteCode(ben.supabaseId, c.inviteCode);
    await settle();
    expect((await inbox(ana.id)).map((n) => n.body)).toEqual([
      'Cben joined Minutes',
    ]);

    await workout(ana.id, 20);
    await workout(ben.id, 30);
    let view = await challenges.getChallenge(ana.supabaseId, c.id);
    expect(view.totalProgress).toBe(50);
    expect(view.isComplete).toBe(false);
    expect(view.participants.map((p) => p.userId)).toEqual([ben.id, ana.id]);
    expect(view.isCreator).toBe(true);

    await workout(ana.id, 15);
    view = await challenges.getChallenge(ben.supabaseId, c.id);
    expect(view.totalProgress).toBe(65);
    expect(view.isComplete).toBe(true);
    expect(view.isCreator).toBe(false);
  });

  it('counts steps and workouts by type', async () => {
    const ana = await db.user();
    const steps = await challenges.createChallenge(
      ana.supabaseId,
      { title: 'Steps', type: 'steps', goalValue: 10000, durationDays: 3 },
      0,
    );
    const count = await challenges.createChallenge(
      ana.supabaseId,
      { title: 'Count', type: 'workouts', goalValue: 5, durationDays: 3 },
      0,
    );
    await workout(ana.id, 30, new Date(), 4200);
    await workout(ana.id, 10);
    const mine = await challenges.getUserChallenges(ana.supabaseId);
    expect(mine.find((c) => c.id === steps.id)?.totalProgress).toBe(4200);
    expect(mine.find((c) => c.id === count.id)?.totalProgress).toBe(2);
  });

  it('defaults to steps for older apps and checks goal limits per type', async () => {
    const ana = await db.user();
    const old = await challenges.createChallenge(
      ana.supabaseId,
      { title: 'Old app', goalValue: 50000, durationDays: 7 },
      0,
    );
    expect(old.type).toBe('steps');
    await expect(
      challenges.createChallenge(
        ana.supabaseId,
        { title: 'Tiny', type: 'steps', goalValue: 10, durationDays: 7 },
        0,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      challenges.createChallenge(
        ana.supabaseId,
        { title: 'Many', type: 'workouts', goalValue: 5000, durationDays: 7 },
        0,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lets participants leave and only the creator delete', async () => {
    const ana = await db.user();
    const ben = await db.user();
    const c = await challenges.createChallenge(
      ana.supabaseId,
      { title: 'Leave me', type: 'workouts', goalValue: 3, durationDays: 7 },
      0,
    );
    await challenges.joinByInviteCode(ben.supabaseId, c.inviteCode);
    await expect(challenges.leave(ana.supabaseId, c.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      challenges.remove(ben.supabaseId, c.id),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await challenges.leave(ben.supabaseId, c.id);
    expect(await challenges.getUserChallenges(ben.supabaseId)).toEqual([]);
    await challenges.remove(ana.supabaseId, c.id);
    expect(await db.prisma.challenge.count({ where: { id: c.id } })).toBe(0);
  });

  it('finishes ended challenges once, with final places', async () => {
    const ana = await db.user({ displayName: 'Ena' });
    const ben = await db.user({ displayName: 'Eben' });
    const c = await challenges.createChallenge(
      ana.supabaseId,
      {
        title: 'Ending',
        type: 'active_minutes',
        goalValue: 100,
        durationDays: 3,
      },
      0,
    );
    await challenges.joinByInviteCode(ben.supabaseId, c.inviteCode);
    await workout(ana.id, 30);
    await workout(ben.id, 45);
    // Pretend it started earlier and has just ended
    await db.prisma.challenge.update({
      where: { id: c.id },
      data: {
        startDate: new Date(Date.now() - 3 * 86_400_000),
        endDate: new Date(Date.now() + 1000),
      },
    });
    const later = new Date(Date.now() + 60_000);

    await challenges.finishEnded(later);
    await challenges.finishEnded(later);
    const anaInbox = (await inbox(ana.id)).filter(
      (n) => n.type === 'challenge_ended',
    );
    const benInbox = (await inbox(ben.id)).filter(
      (n) => n.type === 'challenge_ended',
    );
    expect(anaInbox.map((n) => n.body)).toEqual([
      'The group got to 75% (75 active minutes of 100). You placed #2 of 2.',
    ]);
    expect(benInbox[0].body).toContain('You placed #1 of 2.');

    // Workouts after the end don't change the result, and nobody can join
    await workout(ana.id, 200);
    expect(
      (await challenges.getChallenge(ana.supabaseId, c.id)).totalProgress,
    ).toBe(75);
    const carl = await db.user();
    await expect(
      challenges.joinByInviteCode(carl.supabaseId, c.inviteCode),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
