import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  addDays,
  dateMarker,
  dayRange,
  localDateOf,
  localToday,
} from '../common/day';
import { macroTargets } from '../common/nutrition';

export interface TrendDay {
  date: string;
  calories: number;
  proteinG: number;
  /** Food entries that day; 0 means nothing was logged */
  foodEntries: number;
  activeMinutes: number;
  caloriesBurned: number;
  workouts: number;
  weightKg: number | null;
}

/** Day-by-day totals for the Stats charts, in the user's local days. */
@Injectable()
export class TrendsService {
  constructor(private prisma: PrismaService) {}

  async trends(supabaseId: string, days: number, offset: number) {
    const user = await this.prisma.user.findUnique({ where: { supabaseId } });
    if (!user) throw new NotFoundException('User not found');

    const today = localToday(offset);
    const first = addDays(today, -(days - 1));
    const since = dayRange(first, offset).start;
    const until = dayRange(today, offset).end;

    const [food, activity, weights] = await Promise.all([
      this.prisma.foodLog.findMany({
        where: { userId: user.id, loggedAt: { gte: since, lt: until } },
        select: { loggedAt: true, calories: true, proteinG: true },
      }),
      this.prisma.activityLog.findMany({
        where: { userId: user.id, loggedAt: { gte: since, lt: until } },
        select: { loggedAt: true, durationMin: true, caloriesBurned: true },
      }),
      this.prisma.weightLog.findMany({
        where: {
          userId: user.id,
          day: { gte: dateMarker(first), lte: dateMarker(today) },
        },
        select: { day: true, weightKg: true },
      }),
    ]);

    const byDate = new Map<string, TrendDay>();
    for (let i = 0; i < days; i++) {
      const date = addDays(first, i);
      byDate.set(date, {
        date,
        calories: 0,
        proteinG: 0,
        foodEntries: 0,
        activeMinutes: 0,
        caloriesBurned: 0,
        workouts: 0,
        weightKg: null,
      });
    }
    for (const f of food) {
      const d = byDate.get(localDateOf(f.loggedAt, offset));
      if (!d) continue;
      d.calories += f.calories;
      d.proteinG += f.proteinG;
      d.foodEntries++;
    }
    for (const a of activity) {
      const d = byDate.get(localDateOf(a.loggedAt, offset));
      if (!d) continue;
      d.activeMinutes += a.durationMin;
      d.caloriesBurned += a.caloriesBurned ?? 0;
      d.workouts++;
    }
    for (const w of weights) {
      const d = byDate.get(w.day.toISOString().slice(0, 10));
      if (d) d.weightKg = w.weightKg;
    }

    const list = [...byDate.values()].map((d) => ({
      ...d,
      calories: Math.round(d.calories),
      proteinG: Math.round(d.proteinG),
      caloriesBurned: Math.round(d.caloriesBurned),
    }));
    return {
      days: list,
      goals: {
        calories: user.calorieGoal,
        proteinG: macroTargets(user.calorieGoal, user.goalFocus).proteinG,
        activeMinutes: user.activeMinutesGoal,
        weightKg: user.goalWeightKg,
      },
      weightUnit: user.weightUnit,
    };
  }
}
