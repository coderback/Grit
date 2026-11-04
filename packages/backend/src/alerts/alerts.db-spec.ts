import { TestDb } from '../test-utils/db';
import { dateMarker } from '../common/day';
import { AlertsService } from './alerts.service';
import { ChallengesService } from '../challenges/challenges.service';
import { AdaptiveService } from '../progress/adaptive.service';
import { TrendsService } from '../progress/trends.service';

describe('AlertsService (database)', () => {
  const db = new TestDb();
  const alerts = new AlertsService(
    db.prisma,
    db.notifications,
    new ChallengesService(db.prisma, db.notifications),
    new AdaptiveService(db.prisma, new TrendsService(db.prisma)),
  );
  const inbox = (userId: string) =>
    db.prisma.notification.findMany({ where: { userId } });

  afterAll(() => db.cleanup());

  async function habitWithDays(userId: string, days: string[], name = 'Water') {
    const habit = await db.prisma.habit.create({
      data: { userId, name, emoji: '💧' },
    });
    for (const d of days) {
      await db.prisma.habitLog.create({
        data: { habitId: habit.id, userId, loggedAt: dateMarker(d) },
      });
    }
    return habit;
  }

  // 20:05 in UTC+1 on Wednesday 4 November
  const evening = new Date('2026-11-04T19:05:00Z');

  it('warns at 8pm local about a streak not checked in today, once', async () => {
    const user = await db.user();
    await db.prisma.user.update({
      where: { id: user.id },
      data: { utcOffset: 60 },
    });
    await habitWithDays(user.id, ['2026-11-01', '2026-11-02', '2026-11-03']);

    await alerts.sendStreakAlerts(evening);
    await alerts.sendStreakAlerts(evening);
    const items = await inbox(user.id);
    expect(items).toHaveLength(1);
    expect(items[0].body).toBe(
      'Your 3-day 💧 Water streak ends at midnight. Check in now.',
    );
  });

  it('stays quiet when checked in, off, at another hour or for a 1-day streak', async () => {
    const done = await db.user();
    const off = await db.user();
    const elsewhere = await db.user();
    const short = await db.user();
    await db.prisma.user.update({
      where: { id: done.id },
      data: { utcOffset: 60 },
    });
    await db.prisma.user.update({
      where: { id: off.id },
      data: { utcOffset: 60, notifStreak: false },
    });
    await db.prisma.user.update({
      where: { id: elsewhere.id },
      data: { utcOffset: 0 },
    });
    await db.prisma.user.update({
      where: { id: short.id },
      data: { utcOffset: 60 },
    });
    await habitWithDays(done.id, ['2026-11-02', '2026-11-03', '2026-11-04']);
    await habitWithDays(off.id, ['2026-11-02', '2026-11-03']);
    await habitWithDays(elsewhere.id, ['2026-11-02', '2026-11-03']);
    await habitWithDays(short.id, ['2026-11-03']);

    await alerts.sendStreakAlerts(evening);
    for (const u of [done, off, elsewhere, short])
      expect(await inbox(u.id)).toHaveLength(0);
  });

  // 18:05 UTC on Sunday 8 November
  const sunday = new Date('2026-11-08T18:05:00Z');

  it('sends the weekly check-in on Sunday evening', async () => {
    const user = await db.user();
    for (let i = 0; i < 4; i++) {
      await db.prisma.activityLog.create({
        data: {
          userId: user.id,
          activityType: 'running',
          durationMin: 60,
          loggedAt: new Date(`2026-11-0${2 + i}T08:00:00Z`),
        },
      });
      await db.prisma.foodLog.create({
        data: {
          userId: user.id,
          name: 'Oats',
          mealType: 'breakfast',
          calories: 300,
          loggedAt: new Date(`2026-11-0${2 + i}T08:00:00Z`),
        },
      });
    }
    // Last week's workout doesn't count
    await db.prisma.activityLog.create({
      data: {
        userId: user.id,
        activityType: 'yoga',
        durationMin: 30,
        loggedAt: new Date('2026-11-01T08:00:00Z'),
      },
    });

    await alerts.sendWeeklyProgress(sunday);
    await alerts.sendWeeklyProgress(sunday);
    const items = await inbox(user.id);
    expect(items).toHaveLength(1);
    expect(items[0].body).toBe(
      '4 workouts · 240 active min · food logged 4/7 days. Strong week. Keep it rolling.',
    );
  });

  it('skips on-track weeks for "only when off track", and other days', async () => {
    const picky = await db.user();
    await db.prisma.user.update({
      where: { id: picky.id },
      data: { notifOffTrackOnly: true, activeMinutesGoal: 10 },
    });
    for (let i = 0; i < 4; i++) {
      await db.prisma.foodLog.create({
        data: {
          userId: picky.id,
          name: 'Oats',
          mealType: 'breakfast',
          calories: 300,
          loggedAt: new Date(`2026-11-0${2 + i}T08:00:00Z`),
        },
      });
    }
    await db.prisma.activityLog.create({
      data: {
        userId: picky.id,
        activityType: 'running',
        durationMin: 60,
        loggedAt: new Date('2026-11-03T08:00:00Z'),
      },
    });
    await alerts.sendWeeklyProgress(sunday);
    expect(await inbox(picky.id)).toHaveLength(0);

    const behind = await db.user();
    await db.prisma.user.update({
      where: { id: behind.id },
      data: { notifOffTrackOnly: true },
    });
    await alerts.sendWeeklyProgress(sunday);
    expect((await inbox(behind.id))[0].body).toContain('0 workouts');

    const saturday = await db.user();
    await alerts.sendWeeklyProgress(new Date('2026-11-07T18:05:00Z'));
    expect(await inbox(saturday.id)).toHaveLength(0);
  });
});
