import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  addDays,
  dateMarker,
  dayRange,
  localToday,
  weekStart,
} from '../common/day';
import { NUTRIENTS, nutrientInfo } from '../food/nutrients';
import {
  displayAmount,
  isJudgedDay,
  nutrientDay,
  nutrientDays,
  nutrientStatus,
  nutrientTargets,
  oftenLow,
  roundShare,
} from './nutrient-days';

/**
 * A day's vitamins and minerals against the user's targets, and the ones
 * that were often low in a week. Only measured and label values count.
 */
@Injectable()
export class NutrientsService {
  constructor(private prisma: PrismaService) {}

  private async resolveUser(supabaseId: string) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId },
      select: { id: true, gender: true, dateOfBirth: true, calorieGoal: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** Totals against targets for one local day, with how much of it has data. */
  async day(supabaseId: string, date: string, offset: number) {
    const user = await this.resolveUser(supabaseId);
    const { start, end } = dayRange(date, offset);
    const logs = await this.prisma.foodLog.findMany({
      where: { userId: user.id, loggedAt: { gte: start, lt: end } },
      select: { loggedAt: true, calories: true, name: true, nutrients: true },
      orderBy: { loggedAt: 'asc' },
    });

    const day = nutrientDay(date, logs);
    // Today is still being logged: nothing is low yet, though a limit
    // already passed stays passed
    const inProgress = date >= localToday(offset);
    const judged = !inProgress && isJudgedDay(day, user.calorieGoal);
    const targets = nutrientTargets(user, dateMarker(date));

    return {
      date,
      calories: Math.round(day.calories),
      entries: day.entries,
      coverage: roundShare(day.dataCoverage),
      judged,
      inProgress,
      nutrients: NUTRIENTS.map((n) => {
        const amount = day.totals[n.code] ?? 0;
        const target = n.kind === 'none' ? null : (targets[n.code] ?? null);
        return {
          code: n.code,
          name: n.name,
          unit: n.unit,
          group: n.group,
          kind: n.kind,
          amount: displayAmount(amount),
          target,
          percent: target ? Math.round((amount / target) * 100) : null,
          coverage: roundShare(day.coverage[n.code] ?? 0),
          status:
            n.kind === 'limit' && target && amount > target
              ? ('over' as const)
              : nutrientStatus(n.code, day, target, judged),
          sources: (day.sources[n.code] ?? []).map((s) => ({
            name: s.name,
            amount: displayAmount(s.amount),
          })),
        };
      }),
    };
  }

  /**
   * Target nutrients low on most judged days of the Mon–Sun week containing
   * `date` (default: this week). Today is still being logged, so it counts
   * as a logged day but isn't judged.
   */
  async week(supabaseId: string, offset: number, date?: string) {
    const user = await this.resolveUser(supabaseId);
    const today = localToday(offset);
    const monday = weekStart(date ?? today);
    const sunday = addDays(monday, 6);
    const logs = await this.prisma.foodLog.findMany({
      where: {
        userId: user.id,
        loggedAt: {
          gte: dayRange(monday, offset).start,
          lt: dayRange(sunday, offset).end,
        },
      },
      select: { loggedAt: true, calories: true, nutrients: true },
    });

    const days = nutrientDays(logs, offset);
    const judged = days.filter(
      (d) => d.date < today && isJudgedDay(d, user.calorieGoal),
    );
    const targets = nutrientTargets(user, dateMarker(monday));

    return {
      weekStart: monday,
      weekEnd: sunday,
      loggedDays: days.length,
      judgedDays: judged.length,
      oftenLow: oftenLow(judged, targets).map((o) => {
        const info = nutrientInfo(o.code)!;
        return {
          code: o.code,
          name: info.name,
          unit: info.unit,
          target: targets[o.code]!,
          lowDays: o.lowDays,
          days: o.days,
          avgPercent: o.avgPercent,
        };
      }),
    };
  }
}
