import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ChallengesService } from '../challenges/challenges.service';
import { AdaptiveService } from '../progress/adaptive.service';
import {
  addDays,
  dateMarker,
  dayRange,
  localDateOf,
  weekStart,
} from '../common/day';
import { calculateStreak } from '../habits/habits.streak';
import { macroTargets } from '../common/nutrition';
import { NUTRIENT_LOW_WINDOW, checkInsFor } from './coach-checkins';
import {
  isJudgedDay,
  lowOnDay,
  nutrientDays,
  nutrientTargets,
  percentOfTarget,
} from '../nutrients/nutrient-days';
import {
  isOffTrack,
  offsetRangesAtLocalHour,
  streakAlert,
  weeklyAlert,
  type AtRiskHabit,
} from './alert-schedule';

export const STREAK_ALERT_HOUR = 20; // 8pm local
export const WEEKLY_ALERT_HOUR = 18; // 6pm local, on Sundays
export const COACH_CHECKIN_HOUR = 13; // 1pm local, not on Sundays
const MIN_STREAK = 2;
const USER_PAGE = 500;

/**
 * Alerts that depend on logged data, sent at a fixed local time. The job runs
 * hourly and picks out the users for whom it's that hour. Each alert carries
 * a dedupe key, so running twice (a restart, two servers) never sends twice.
 */
@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);
  private running = false;

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private challenges: ChallengesService,
    private adaptive: AdaptiveService,
  ) {}

  @Cron('5 * * * *')
  async hourly() {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const ended = await this.challenges.finishEnded(now);
      const streaks = await this.sendStreakAlerts(now);
      const weekly = await this.sendWeeklyProgress(now);
      const coach = await this.sendCoachCheckIns(now);
      const pruned = await this.notifications.prune();
      this.logger.log(
        `Alerts: ${ended} challenges ended, ${streaks} streak, ${weekly} weekly, ${coach} coach, ${pruned} old removed`,
      );
    } catch (err) {
      this.logger.error(`Hourly alerts failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  /**
   * Everyone opted in for whom it's `hour` o'clock now, a page at a time so
   * a large user base doesn't load into memory at once.
   */
  private async *usersAtLocalHour(
    now: Date,
    hour: number,
    pref: 'notifStreak' | 'notifProgress',
  ) {
    let cursor: string | undefined;
    for (;;) {
      const page = await this.prisma.user.findMany({
        where: {
          [pref]: true,
          OR: offsetRangesAtLocalHour(now, hour).map((r) => ({
            utcOffset: { gte: r.gte, lt: r.lt },
          })),
        },
        select: {
          id: true,
          utcOffset: true,
          activeMinutesGoal: true,
          notifOffTrackOnly: true,
          supabaseId: true,
        },
        orderBy: { id: 'asc' },
        take: USER_PAGE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      yield* page;
      if (page.length < USER_PAGE) return;
      cursor = page[page.length - 1].id;
    }
  }

  /** 8pm: habits done yesterday, not yet today, with a streak worth keeping. */
  async sendStreakAlerts(now: Date): Promise<number> {
    const users = this.usersAtLocalHour(now, STREAK_ALERT_HOUR, 'notifStreak');
    let sent = 0;
    for await (const user of users) {
      const today = localDateOf(now, user.utcOffset);
      const habits = await this.prisma.habit.findMany({
        where: {
          userId: user.id,
          isActive: true,
          logs: {
            some: { completed: true, loggedAt: dateMarker(addDays(today, -1)) },
          },
          NOT: {
            logs: { some: { completed: true, loggedAt: dateMarker(today) } },
          },
        },
        select: {
          name: true,
          emoji: true,
          logs: {
            where: { completed: true, loggedAt: { lte: dateMarker(today) } },
            select: { loggedAt: true },
          },
        },
      });
      const atRisk: AtRiskHabit[] = habits
        .map((h) => ({
          name: h.name,
          emoji: h.emoji,
          streak: calculateStreak(
            new Set(h.logs.map((l) => l.loggedAt.toISOString().slice(0, 10))),
            today,
          ),
        }))
        .filter((h) => h.streak >= MIN_STREAK);

      const alert = streakAlert(atRisk);
      if (!alert) continue;
      const delivered = await this.notifications.notify(user.id, {
        type: 'streak_at_risk',
        ...alert,
        data: { screen: 'habits' },
        dedupeKey: `streak:${today}`,
      });
      if (delivered) sent++;
    }
    return sent;
  }

  /** Sunday 6pm: the week so far. With "only when off track", only if behind. */
  async sendWeeklyProgress(now: Date): Promise<number> {
    const users = this.usersAtLocalHour(
      now,
      WEEKLY_ALERT_HOUR,
      'notifProgress',
    );
    let sent = 0;
    for await (const user of users) {
      const today = localDateOf(now, user.utcOffset);
      if (new Date(`${today}T00:00:00Z`).getUTCDay() !== 0) continue; // Sundays
      const monday = weekStart(today);
      const since = dayRange(monday, user.utcOffset).start;

      const [activity, foodLogs] = await Promise.all([
        this.prisma.activityLog.aggregate({
          where: { userId: user.id, loggedAt: { gte: since, lte: now } },
          _sum: { durationMin: true },
          _count: { _all: true },
        }),
        this.prisma.foodLog.findMany({
          where: { userId: user.id, loggedAt: { gte: since, lte: now } },
          select: { loggedAt: true },
        }),
      ]);
      const stats = {
        workouts: activity._count._all,
        activeMinutes: activity._sum.durationMin ?? 0,
        foodDays: new Set(
          foodLogs.map((l) => localDateOf(l.loggedAt, user.utcOffset)),
        ).size,
        activeMinutesGoal: user.activeMinutesGoal,
      };
      if (user.notifOffTrackOnly && !isOffTrack(stats)) continue;

      // The weekly check-in also carries a target adjustment, if there is one
      const checkIn = await this.adaptive
        .checkIn(user.supabaseId, user.utcOffset)
        .catch(() => null);
      const alert = weeklyAlert(stats);
      const s = checkIn?.suggestion;
      if (s) {
        alert.body += ` Your coach suggests ${s.change > 0 ? 'raising' : 'lowering'} your target to ${s.suggested.toLocaleString('en-US')} kcal: tap to review.`;
      }

      const delivered = await this.notifications.notify(user.id, {
        type: 'weekly_progress',
        ...alert,
        data: { screen: 'stats' },
        dedupeKey: `weekly:${monday}`,
      });
      if (delivered) sent++;
    }
    return sent;
  }

  /**
   * 1pm: one check-in from the coach, if a pattern calls for one. Each kind
   * is sent at most once a week; Sundays are left to the weekly summary.
   */
  async sendCoachCheckIns(now: Date): Promise<number> {
    const users = this.usersAtLocalHour(
      now,
      COACH_CHECKIN_HOUR,
      'notifProgress',
    );
    let sent = 0;
    for await (const user of users) {
      const offset = user.utcOffset;
      const today = localDateOf(now, offset);
      if (new Date(`${today}T00:00:00Z`).getUTCDay() === 0) continue;

      const since14 = dayRange(addDays(today, -14), offset).start;
      const todayStart = dayRange(today, offset).start;
      const weekAgo = dayRange(addDays(today, -7), offset).start;
      const [profile, food, activity, weights] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: user.id },
          select: {
            calorieGoal: true,
            goalFocus: true,
            dietType: true,
            primaryGoal: true,
            gender: true,
            dateOfBirth: true,
            edScreen: true,
          },
        }),
        this.prisma.foodLog.findMany({
          where: { userId: user.id, loggedAt: { gte: since14, lte: now } },
          select: {
            loggedAt: true,
            proteinG: true,
            calories: true,
            nutrients: true,
          },
        }),
        this.prisma.activityLog.findMany({
          where: { userId: user.id, loggedAt: { gte: since14, lte: now } },
          select: { loggedAt: true },
        }),
        this.prisma.weightLog.findMany({
          where: {
            userId: user.id,
            day: { gte: dateMarker(addDays(today, -21)) },
          },
          select: { day: true, weightKg: true },
        }),
      ]);
      if (!profile) continue;

      // Protein per logged day over the last 7 full days
      const protein = new Map<string, number>();
      for (const f of food) {
        if (f.loggedAt < weekAgo || f.loggedAt >= todayStart) continue;
        const d = localDateOf(f.loggedAt, offset);
        protein.set(d, (protein.get(d) ?? 0) + f.proteinG);
      }

      // Nutrients low on each of the latest fully logged days before today
      const targets = nutrientTargets(profile, todayStart);
      const judgedDays =
        profile.edScreen === 'yes'
          ? []
          : nutrientDays(
              food.filter((f) => f.loggedAt < todayStart),
              offset,
            )
              .filter((d) => isJudgedDay(d, profile.calorieGoal))
              .reverse()
              .slice(0, NUTRIENT_LOW_WINDOW);

      const checkIns = checkInsFor({
        today,
        foodDays: food.map((f) => localDateOf(f.loggedAt, offset)),
        proteinByDay: [...protein].map(([date, proteinG]) => ({
          date,
          proteinG,
        })),
        proteinTarget: macroTargets(profile.calorieGoal, profile.goalFocus)
          .proteinG,
        dietType: profile.dietType,
        workoutDays: activity.map((a) => localDateOf(a.loggedAt, offset)),
        weights: weights.map((w) => ({
          date: w.day.toISOString().slice(0, 10),
          weightKg: w.weightKg,
        })),
        primaryGoal: profile.primaryGoal,
        nutrientDays: judgedDays.map((d) => {
          const low = lowOnDay(d, targets);
          return {
            date: d.date,
            low,
            percent: Object.fromEntries(
              low.map((code) => [
                code,
                percentOfTarget(d, code, targets[code]!),
              ]),
            ),
          };
        }),
        edScreen: profile.edScreen,
      });

      // The first one not already sent this week
      for (const c of checkIns) {
        const delivered = await this.notifications.notify(user.id, {
          type: 'coach_checkin',
          title: c.title,
          body: c.body,
          data: {
            screen: c.screen,
            rule: c.rule,
            ...(c.nutrient ? { nutrient: c.nutrient } : {}),
          },
          dedupeKey: `coach:${c.rule}:${weekStart(today)}`,
        });
        if (delivered) {
          sent++;
          break;
        }
      }
    }
    return sent;
  }
}
