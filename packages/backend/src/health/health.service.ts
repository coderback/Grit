import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WeightService } from '../progress/weight.service';
import { addDays, dateMarker, localToday } from '../common/day';
import { ageOn } from '../common/safety';
import { metFor } from '../activity/activity.constants';
import {
  CYCLE_METRICS,
  heartRateKcal,
  METRICS,
  type MetricName,
} from './heart-rate';
import type { HealthImportDto, HealthWorkoutDto } from './health.dto';

// Older data isn't imported: the app sends at most a month at a time
const MAX_AGE_DAYS = 62;

type ImportUser = {
  id: string;
  weightKg: number | null;
  gender: string | null;
  dateOfBirth: Date | null;
};

/**
 * Calories for an imported workout: the device's own figure if it gave one,
 * then the heart-rate equation, then the activity's MET value.
 */
export function workoutCalories(w: HealthWorkoutDto, user: ImportUser) {
  if (w.caloriesBurned != null) {
    return { caloriesBurned: w.caloriesBurned, calorieMethod: 'device' };
  }
  const fromHeart = w.avgHeartRate
    ? heartRateKcal(w.avgHeartRate, w.durationMin, {
        ageYears: user.dateOfBirth
          ? ageOn(user.dateOfBirth, new Date(w.startedAt))
          : null,
        weightKg: user.weightKg,
        gender: user.gender,
      })
    : null;
  if (fromHeart != null) {
    return { caloriesBurned: fromHeart, calorieMethod: 'heart_rate' };
  }
  return {
    caloriesBurned: Math.round(
      metFor(w.activityType) * (user.weightKg ?? 70) * (w.durationMin / 60),
    ),
    calorieMethod: 'met',
  };
}

type MetricRow = {
  metric: string;
  type: string;
  unit: string;
  value: number;
  day: Date;
};

/** Each metric's latest value and its average, oldest rows first in. */
export function summarizeMetrics(rows: MetricRow[]) {
  const groups = new Map<string, MetricRow[]>();
  for (const r of rows) {
    const k = `${r.metric}|${r.type}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return [...groups.values()].map((g) => {
    const latest = g[g.length - 1];
    return {
      metric: latest.metric,
      type: latest.type || null,
      unit: latest.unit,
      latest: latest.value,
      latestDate: latest.day.toISOString().slice(0, 10),
      average:
        Math.round((g.reduce((t, r) => t + r.value, 0) / g.length) * 10) / 10,
      days: g.length,
    };
  });
}

const METRIC_LABELS: Record<string, string> = {
  resting_hr: 'Resting heart rate',
  hrv: 'Heart rate variability',
  respiratory_rate: 'Breathing rate during sleep',
  sleep_temp_deviation: 'Sleeping temperature vs usual',
  vo2max: 'VO2max',
};
const UNIT_LABELS: Record<string, string> = {
  ms: 'ms',
  bpm: 'bpm',
  breaths_min: 'breaths/min',
  degC: '°C',
  ml_kg_min: 'mL/kg/min',
};

/** Lines for the coach about recent recovery metrics (never cycle data). */
export function recoveryLines(
  summary: ReturnType<typeof summarizeMetrics>,
  today: string,
) {
  return summary
    .filter(
      (m) => METRIC_LABELS[m.metric] && m.latestDate >= addDays(today, -2),
    )
    .map((m) => {
      const unit = UNIT_LABELS[m.unit] ?? m.unit;
      const label = `${METRIC_LABELS[m.metric]}${m.type ? ` (${m.type.toUpperCase()})` : ''}`;
      return `- ${label}: ${m.latest} ${unit}${m.days >= 7 ? ` (30-day average ${m.average})` : ''}`;
    });
}

const sameWorkout = (a: Record<string, unknown>, b: Record<string, unknown>) =>
  Object.keys(b).every((k) => {
    const x = a[k];
    const y = b[k];
    return x instanceof Date && y instanceof Date
      ? x.getTime() === y.getTime()
      : x === y;
  });

/**
 * Takes what the phone read from Apple Health or Health Connect and stores
 * it. Safe to send the same data again: workouts are matched on the health
 * app's ID, days, weigh-ins and metrics on their date, and anything that
 * hasn't changed is left alone.
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
      const data = {
        activityType: w.activityType,
        durationMin: w.durationMin,
        ...workoutCalories(w, user),
        steps: w.steps ?? null,
        avgHeartRate: w.avgHeartRate ?? null,
        distanceM: w.distanceM != null ? Math.round(w.distanceM) : null,
        loggedAt,
        source,
      };
      const existing = await this.prisma.activityLog.findUnique({
        where: {
          userId_externalId: { userId: user.id, externalId: w.externalId },
        },
      });
      if (existing) {
        if (sameWorkout(existing, data)) continue;
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
      const where = {
        userId_day: { userId: user.id, day: dateMarker(d.date) },
      };
      const row = await this.prisma.healthDay.findUnique({ where });
      if (
        row &&
        (d.steps === undefined || row.steps === d.steps) &&
        (d.sleepMinutes === undefined || row.sleepMinutes === d.sleepMinutes) &&
        row.source === source
      )
        continue;
      await this.prisma.healthDay.upsert({
        where,
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

    const metrics = await this.importMetrics(user, dto, oldest);
    return { workouts: { created, updated }, days, weights, metrics };
  }

  /** Recovery and cycle values, one per metric per day. */
  private async importMetrics(
    user: { id: string; consentCycleData: boolean },
    dto: HealthImportDto,
    oldest: string,
  ) {
    let stored = 0;
    let skipped = 0;
    const incoming = dto.metrics.filter((m) => {
      const spec = METRICS[m.metric as MetricName];
      const ok =
        m.date >= oldest &&
        !!spec &&
        Number.isFinite(m.value) &&
        m.value >= spec.min &&
        m.value <= spec.max &&
        // Cycle data only with its own consent
        (!CYCLE_METRICS.has(m.metric) || user.consentCycleData) &&
        (m.metric === 'hrv' ? m.type === 'sdnn' || m.type === 'rmssd' : true);
      if (!ok) skipped++;
      return ok;
    });
    if (!incoming.length) return { stored, skipped };

    const existing = await this.prisma.healthMetric.findMany({
      where: {
        userId: user.id,
        day: { gte: dateMarker(oldest) },
        metric: { in: [...new Set(incoming.map((m) => m.metric))] },
      },
    });
    const key = (day: string, metric: string, type: string) =>
      `${day}|${metric}|${type}`;
    const have = new Map(
      existing.map((r) => [
        key(r.day.toISOString().slice(0, 10), r.metric, r.type),
        r,
      ]),
    );
    for (const m of incoming) {
      const type = m.metric === 'hrv' ? m.type! : '';
      const value = Math.round(m.value * 100) / 100;
      const device = m.device?.trim() || null;
      const row = have.get(key(m.date, m.metric, type));
      if (
        row &&
        row.value === value &&
        row.device === device &&
        row.source === dto.source
      )
        continue;
      const data = {
        value,
        unit: METRICS[m.metric as MetricName].unit,
        source: dto.source,
        device,
      };
      await this.prisma.healthMetric.upsert({
        where: {
          userId_day_metric_type: {
            userId: user.id,
            day: dateMarker(m.date),
            metric: m.metric,
            type,
          },
        },
        update: data,
        create: {
          ...data,
          userId: user.id,
          day: dateMarker(m.date),
          metric: m.metric,
          type,
        },
      });
      stored++;
    }
    return { stored, skipped };
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
      recovery: await this.recovery(user.id, today),
    };
  }

  /**
   * Each recovery metric's latest value and its 30-day average, for the
   * app and the coach. HRV is compared only with the same type. Cycle data
   * isn't included.
   */
  async recovery(userId: string, today: string) {
    const rows = await this.prisma.healthMetric.findMany({
      where: {
        userId,
        day: { gte: dateMarker(addDays(today, -30)) },
        metric: { notIn: [...CYCLE_METRICS] },
      },
      orderBy: { day: 'asc' },
    });
    return summarizeMetrics(rows);
  }

  /** What's been imported of cycle data, for the settings screen. */
  async cycleSummary(supabaseId: string) {
    const user = await this.prisma.user.findUnique({ where: { supabaseId } });
    if (!user) throw new NotFoundException('User not found');
    const days = await this.prisma.healthMetric.count({
      where: { userId: user.id, metric: { in: [...CYCLE_METRICS] } },
    });
    return { consent: user.consentCycleData, days };
  }
}
