import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  addDays,
  dateMarker,
  dayRange,
  localDateOf,
  weekStart,
} from '../common/day';
import { calculateStreak } from '../habits/habits.streak';
import {
  isOffTrack,
  offsetRangesAtLocalHour,
  streakAlert,
  weeklyAlert,
  type AtRiskHabit,
} from './alert-schedule';

export const STREAK_ALERT_HOUR = 20; // 8pm local
export const WEEKLY_ALERT_HOUR = 18; // 6pm local, on Sundays
const MIN_STREAK = 2;

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
  ) {}

  @Cron('5 * * * *')
  async hourly() {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const streaks = await this.sendStreakAlerts(now);
      const weekly = await this.sendWeeklyProgress(now);
      const pruned = await this.notifications.prune();
      this.logger.log(
        `Alerts: ${streaks} streak, ${weekly} weekly, ${pruned} old removed`,
      );
    } catch (err) {
      this.logger.error(`Hourly alerts failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private usersAtLocalHour(
    now: Date,
    hour: number,
    pref: 'notifStreak' | 'notifProgress',
  ) {
    return this.prisma.user.findMany({
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
      },
    });
  }

  /** 8pm: habits done yesterday, not yet today, with a streak worth keeping. */
  async sendStreakAlerts(now: Date): Promise<number> {
    const users = await this.usersAtLocalHour(
      now,
      STREAK_ALERT_HOUR,
      'notifStreak',
    );
    let sent = 0;
    for (const user of users) {
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
    const users = await this.usersAtLocalHour(
      now,
      WEEKLY_ALERT_HOUR,
      'notifProgress',
    );
    let sent = 0;
    for (const user of users) {
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

      const delivered = await this.notifications.notify(user.id, {
        type: 'weekly_progress',
        ...weeklyAlert(stats),
        data: { screen: 'stats' },
        dedupeKey: `weekly:${monday}`,
      });
      if (delivered) sent++;
    }
    return sent;
  }
}
