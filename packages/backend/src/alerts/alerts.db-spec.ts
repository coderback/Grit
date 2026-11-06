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

  describe('coach check-ins', () => {
    // 13:05 UTC on Wednesday 4 November
    const lunchtime = new Date('2026-11-04T13:05:00Z');
    const at = (date: string) => new Date(`${date}T12:00:00Z`);

    it('sends the first one that applies, once a week', async () => {
      const u = await db.user();
      // Logged food regularly until 4 days ago, and trained until 6 days ago
      for (const d of [
        '2026-10-25',
        '2026-10-27',
        '2026-10-29',
        '2026-10-31',
      ]) {
        await db.prisma.foodLog.create({
          data: {
            userId: u.id,
            name: 'x',
            mealType: 'lunch',
            calories: 500,
            loggedAt: at(d),
          },
        });
      }
      for (const d of ['2026-10-24', '2026-10-26', '2026-10-29']) {
        await db.prisma.activityLog.create({
          data: {
            userId: u.id,
            activityType: 'running',
            durationMin: 30,
            loggedAt: at(d),
          },
        });
      }

      await alerts.sendCoachCheckIns(lunchtime);
      let items = await inbox(u.id);
      expect(items.map((n) => [n.type, n.title])).toEqual([
        ['coach_checkin', 'Quick catch-up?'],
      ]);
      expect(items[0].data).toEqual({ screen: 'food', rule: 'logging_gap' });

      // The next day: logging gap already sent this week, so the next rule
      await alerts.sendCoachCheckIns(new Date('2026-11-05T13:05:00Z'));
      items = await inbox(u.id);
      expect(
        items.map((n) => (n.data as { rule: string }).rule).sort(),
      ).toEqual(['activity_gap', 'logging_gap']);
      // And again: nothing left to say this week
      await alerts.sendCoachCheckIns(new Date('2026-11-06T13:05:00Z'));
      expect(await inbox(u.id)).toHaveLength(2);
    });

    it('stays quiet on track, when progress alerts are off, and on Sundays', async () => {
      const fine = await db.user();
      const off = await db.user();
      await db.prisma.user.update({
        where: { id: off.id },
        data: { notifProgress: false },
      });
      for (const u of [fine, off]) {
        for (const d of [
          '2026-10-25',
          '2026-10-27',
          '2026-10-29',
          '2026-10-30',
        ]) {
          await db.prisma.foodLog.create({
            data: {
              userId: u.id,
              name: 'x',
              mealType: 'lunch',
              calories: 500,
              loggedAt: at(d),
            },
          });
        }
      }
      await db.prisma.foodLog.create({
        data: {
          userId: fine.id,
          name: 'x',
          mealType: 'lunch',
          calories: 500,
          loggedAt: at('2026-11-03'),
        },
      });
      await alerts.sendCoachCheckIns(lunchtime);
      expect(await inbox(fine.id)).toHaveLength(0);
      expect(await inbox(off.id)).toHaveLength(0);

      const sunday = await db.user();
      for (const d of ['2026-10-25', '2026-10-27', '2026-10-29']) {
        await db.prisma.foodLog.create({
          data: {
            userId: sunday.id,
            name: 'x',
            mealType: 'lunch',
            calories: 500,
            loggedAt: at(d),
          },
        });
      }
      await alerts.sendCoachCheckIns(new Date('2026-11-08T13:05:00Z'));
      expect(await inbox(sunday.id)).toHaveLength(0);
    });

    describe('nutrient_low', () => {
      const iron = (amount: number) => ({
        iron_mg: { amount, basis: 'measured' },
      });
      // Fully logged, enough protein, and 2.7 mg of iron (under 2/3 of 8 mg)
      const LOW: [string, number, number][] = [
        ['White toast', 300, 1.0],
        ['Cheddar', 400, 0.2],
        ['Pasta', 500, 1.5],
      ];
      const FINE: [string, number, number][] = [
        ['Steak', 600, 12],
        ['Lentil curry', 600, 6.6],
      ];
      async function logDay(
        userId: string,
        date: string,
        foods: [string, number, number][],
      ) {
        await db.prisma.foodLog.createMany({
          data: foods.map(([name, calories, ironMg], i) => ({
            userId,
            name,
            mealType: 'lunch',
            calories,
            proteinG: 60,
            loggedAt: new Date(`${date}T0${7 + i}:00:00Z`),
            nutrients: iron(ironMg),
          })),
        });
      }
      // The 7 days before Wednesday 4 November, oldest first
      const week = [
        '2026-10-28',
        '2026-10-29',
        '2026-10-30',
        '2026-10-31',
        '2026-11-01',
        '2026-11-02',
        '2026-11-03',
      ];
      async function logWeek(userId: string, lowDays: number) {
        for (const [i, d] of week.entries()) {
          await logDay(userId, d, i < lowDays ? LOW : FINE);
        }
      }

      it('sends one when the same nutrient was low on 5 of the last 7 logged days', async () => {
        const u = await db.user();
        await logWeek(u.id, 5);

        await alerts.sendCoachCheckIns(lunchtime);
        const items = await inbox(u.id);
        expect(items.map((n) => [n.type, n.title, n.body])).toEqual([
          [
            'coach_checkin',
            'Iron has been running low',
            'Iron was low on 5 of your last 7 logged days. Good sources include beef, lentils, beans, spinach or fortified cereal: adding one to a meal a day helps.',
          ],
        ]);
        expect(items[0].data).toEqual({
          screen: 'food',
          rule: 'nutrient_low',
          nutrient: 'iron_mg',
        });
        expect(`${items[0].title} ${items[0].body}`).not.toMatch(
          /deficien|diagnos/i,
        );

        // Once a week
        await alerts.sendCoachCheckIns(new Date('2026-11-05T13:05:00Z'));
        expect(await inbox(u.id)).toHaveLength(1);
      });

      it('stays quiet at 4 of 7, for today, without data, and after an eating disorder answer', async () => {
        // Low on 4 days, and today so far: today doesn't count
        const four = await db.user();
        await logWeek(four.id, 4);
        await logDay(four.id, '2026-11-04', LOW);

        // Low every day, but asked not to hear about foods as good or bad
        const ed = await db.user();
        await db.prisma.user.update({
          where: { id: ed.id },
          data: { edScreen: 'yes' },
        });
        await logWeek(ed.id, 7);

        // Logged every day, without nutrient data
        const manual = await db.user();
        for (const d of week) {
          await db.prisma.foodLog.createMany({
            data: [7, 8].map((h) => ({
              userId: manual.id,
              name: 'x',
              mealType: 'lunch',
              calories: 600,
              proteinG: 60,
              loggedAt: new Date(`${d}T0${h}:00:00Z`),
            })),
          });
        }

        await alerts.sendCoachCheckIns(lunchtime);
        expect(await inbox(four.id)).toHaveLength(0);
        expect(await inbox(ed.id)).toHaveLength(0);
        expect(await inbox(manual.id)).toHaveLength(0);
      });
    });
  });
});
