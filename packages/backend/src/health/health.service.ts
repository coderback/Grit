import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WeightService } from '../progress/weight.service';
import { addDays, dateMarker, localToday } from '../common/day';
import { MET } from '../activity/activity.constants';
import type { HealthImportDto } from './health.dto';

// Older data isn't imported: the app sends at most a month at a time
const MAX_AGE_DAYS = 62;

/**
 * Takes what the phone read from Apple Health or Health Connect and stores
 * it. Safe to send the same data again: workouts are matched on the health
 * app's ID, days and weigh-ins on their date.
 */
@Injectable()
export class HealthService {
  constructor(
    private prisma: PrismaService,
    private weight: WeightService,
  ) {}

  async import(supabaseId: string, dto: HealthImportDto, offset: number) {
    const user = await this.prisma.user.findUnique({ where: { supabaseId } });
    if (!user) throw new NotFoundException('User not found');
    const oldest = addDays(localToday(offset), -MAX_AGE_DAYS);
    const source = dto.source;

    let created = 0;
    let updated = 0;
    for (const w of dto.workouts) {
      const loggedAt = new Date(w.startedAt);
      if (loggedAt < new Date(`${oldest}T00:00:00Z`)) continue;
      const caloriesBurned =
        w.caloriesBurned ??
        Math.round(
          (MET[w.activityType] ?? 5) *
            (user.weightKg ?? 70) *
            (w.durationMin / 60),
        );
      const data = {
        activityType: w.activityType,
        durationMin: w.durationMin,
        caloriesBurned,
        steps: w.steps ?? null,
        loggedAt,
        source,
      };
      const existing = await this.prisma.activityLog.findUnique({
        where: {
          userId_externalId: { userId: user.id, externalId: w.externalId },
        },
        select: { id: true },
      });
      if (existing) {
        await this.prisma.activityLog.update({
          where: { id: existing.id },
          data,
        });
        updated++;
      } else {
        await this.prisma.activityLog.create({
          data: { ...data, userId: user.id, externalId: w.externalId },
        });
        created++;
      }
    }

    let days = 0;
    for (const d of dto.days) {
      if (
        d.date < oldest ||
        (d.steps === undefined && d.sleepMinutes === undefined)
      )
        continue;
      const values = {
        ...(d.steps !== undefined ? { steps: d.steps } : {}),
        ...(d.sleepMinutes !== undefined
          ? { sleepMinutes: d.sleepMinutes }
          : {}),
        source,
      };
      await this.prisma.healthDay.upsert({
        where: { userId_day: { userId: user.id, day: dateMarker(d.date) } },
        update: values,
        create: { ...values, userId: user.id, day: dateMarker(d.date) },
      });
      days++;
    }

    let weights = 0;
    // Oldest first, so the profile ends up on the latest
    for (const w of [...dto.weights].sort((a, b) =>
      a.date.localeCompare(b.date),
    )) {
      if (w.date < oldest) continue;
      try {
        await this.weight.logForUser(user.id, w.weightKg, offset, w.date);
        weights++;
      } catch {
        // A date the weight log refuses (e.g. tomorrow in this zone): skip it
      }
    }

    return { workouts: { created, updated }, days, weights };
  }

  /** The last week of synced days, for the app and the coach. */
  async recent(supabaseId: string, offset: number) {
    const user = await this.prisma.user.findUnique({ where: { supabaseId } });
    if (!user) throw new NotFoundException('User not found');
    const today = localToday(offset);
    const rows = await this.prisma.healthDay.findMany({
      where: { userId: user.id, day: { gte: dateMarker(addDays(today, -6)) } },
      orderBy: { day: 'asc' },
    });
    const imported = await this.prisma.activityLog.count({
      where: {
        userId: user.id,
        source: { in: ['healthkit', 'health_connect'] },
      },
    });
    return {
      days: rows.map((r) => ({
        date: r.day.toISOString().slice(0, 10),
        steps: r.steps,
        sleepMinutes: r.sleepMinutes,
        source: r.source,
      })),
      importedWorkouts: imported,
      lastSyncedAt: rows.reduce<Date | null>(
        (latest, r) => (!latest || r.updatedAt > latest ? r.updatedAt : latest),
        null,
      ),
    };
  }
}
