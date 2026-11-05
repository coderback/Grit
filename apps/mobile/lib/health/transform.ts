import { localDateStr } from '@/lib/date';
import type { HealthData, MetricSample, SleepInterval, WeightSample } from './types';

// Apple Health workout activity types (HKWorkoutActivityType) → GRIT's
const APPLE_TYPES: Record<number, string> = {
  37: 'running', 52: 'walking', 13: 'cycling', 46: 'swimming', 57: 'yoga', 24: 'hiking',
  50: 'strength_training', 20: 'strength_training', 11: 'strength_training',
  63: 'hiit', 35: 'rowing', 16: 'elliptical', 44: 'stair_climbing', 68: 'stair_climbing',
  6: 'basketball', 48: 'tennis', 41: 'soccer', 77: 'dancing', 78: 'dancing',
  66: 'pilates', 8: 'boxing', 9: 'rock_climbing', 64: 'jump_rope',
};

// Health Connect exercise types → GRIT's
const ANDROID_TYPES: Record<number, string> = {
  56: 'running', 79: 'walking', 8: 'cycling', 9: 'cycling', 74: 'swimming', 73: 'swimming',
  83: 'yoga', 37: 'hiking', 70: 'strength_training', 81: 'strength_training', 13: 'strength_training',
  36: 'hiit', 53: 'rowing', 54: 'rowing', 25: 'elliptical', 68: 'stair_climbing',
  5: 'basketball', 76: 'tennis', 64: 'soccer', 16: 'dancing', 48: 'pilates', 11: 'boxing', 51: 'rock_climbing',
};

export const appleWorkoutType = (code: number) => APPLE_TYPES[code] ?? 'other';
export const androidExerciseType = (code: number) => ANDROID_TYPES[code] ?? 'other';

/**
 * Minutes asleep per night, keyed by the local date the night ends on.
 * Overlapping intervals (a watch and a phone both recording) count once,
 * and awake stretches inside a session are taken out.
 */
export function sleepByNight(intervals: SleepInterval[]): Record<string, number> {
  const merge = (list: SleepInterval[]) => {
    const sorted = [...list].sort((a, b) => a.start.getTime() - b.start.getTime());
    const out: { start: number; end: number }[] = [];
    for (const i of sorted) {
      const s = i.start.getTime(), e = i.end.getTime();
      if (e <= s) continue;
      const last = out[out.length - 1];
      if (last && s <= last.end) last.end = Math.max(last.end, e);
      else out.push({ start: s, end: e });
    }
    return out;
  };
  const asleep = merge(intervals.filter((i) => i.asleep));
  const awake = merge(intervals.filter((i) => !i.asleep));

  const nights: Record<string, number> = {};
  for (const a of asleep) {
    let ms = a.end - a.start;
    for (const w of awake) {
      const overlap = Math.min(a.end, w.end) - Math.max(a.start, w.start);
      if (overlap > 0) ms -= overlap;
    }
    // A nap after midday counts toward that day; overnight sleep toward the morning it ends
    const date = localDateStr(new Date(a.end));
    nights[date] = (nights[date] ?? 0) + Math.max(0, ms) / 60_000;
  }
  for (const d of Object.keys(nights)) nights[d] = Math.round(nights[d]);
  return nights;
}

/** The last weigh-in of each local day. */
export function latestWeightPerDay(samples: WeightSample[]): { date: string; weightKg: number }[] {
  const byDay = new Map<string, WeightSample>();
  for (const s of samples) {
    const date = localDateStr(s.at);
    const prev = byDay.get(date);
    if (!prev || s.at > prev.at) byDay.set(date, s);
  }
  return [...byDay.entries()]
    .map(([date, s]) => ({ date, weightKg: Math.round(s.kg * 100) / 100 }))
    .filter((w) => w.weightKg >= 20 && w.weightKg <= 400)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// How a day's readings become one value: HRV and breathing rate are
// averaged over the day's readings (Apple takes several overnight); for the
// rest the day's latest counts, and for flow the heaviest
const COMBINE: Record<MetricSample['metric'], 'mean' | 'latest' | 'max'> = {
  hrv: 'mean',
  respiratory_rate: 'mean',
  resting_hr: 'latest',
  sleep_temp_deviation: 'latest',
  vo2max: 'latest',
  menstrual_flow: 'max',
};

export interface DailyMetric {
  date: string;
  metric: MetricSample['metric'];
  type?: 'sdnn' | 'rmssd';
  value: number;
  device?: string;
}

/** One value per metric (and HRV type) per local day. */
export function dailyMetrics(samples: MetricSample[]): DailyMetric[] {
  const groups = new Map<string, MetricSample[]>();
  for (const s of samples) {
    if (!Number.isFinite(s.value)) continue;
    const k = `${localDateStr(s.at)}|${s.metric}|${s.type ?? ''}`;
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  const out: DailyMetric[] = [];
  for (const [k, list] of groups) {
    const [date, metric] = k.split('|') as [string, MetricSample['metric']];
    const sorted = [...list].sort((a, b) => a.at.getTime() - b.at.getTime());
    const latest = sorted[sorted.length - 1];
    const how = COMBINE[metric];
    const value =
      how === 'mean' ? sorted.reduce((t, s) => t + s.value, 0) / sorted.length : how === 'max' ? Math.max(...sorted.map((s) => s.value)) : latest.value;
    out.push({
      date,
      metric,
      ...(latest.type ? { type: latest.type } : {}),
      value: Math.round(value * 100) / 100,
      ...(latest.device ? { device: latest.device.slice(0, 80) } : {}),
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.metric.localeCompare(b.metric));
}

/**
 * Apple records sleeping wrist temperature as a reading, not a deviation:
 * each night against the average of the nights before it (at least 5, up to
 * 30), as the Health app shows it. Nights before there's a baseline are left out.
 */
export function temperatureDeviations(nights: { at: Date; celsius: number; device?: string }[]): MetricSample[] {
  const sorted = [...nights].filter((n) => n.celsius > 25 && n.celsius < 45).sort((a, b) => a.at.getTime() - b.at.getTime());
  const out: MetricSample[] = [];
  sorted.forEach((n, i) => {
    const before = sorted.slice(Math.max(0, i - 30), i);
    if (before.length < 5) return;
    const baseline = before.reduce((t, b) => t + b.celsius, 0) / before.length;
    out.push({ metric: 'sleep_temp_deviation', at: n.at, value: Math.round((n.celsius - baseline) * 100) / 100, device: n.device });
  });
  return out;
}

/** Metres from a HealthKit quantity in any length unit. */
export function toMetres(q: { quantity: number; unit: string } | undefined) {
  if (!q || !Number.isFinite(q.quantity)) return undefined;
  const per: Record<string, number> = { m: 1, km: 1000, mi: 1609.344, ft: 0.3048, yd: 0.9144, cm: 0.01 };
  const f = per[q.unit];
  return f ? Math.round(q.quantity * f) : undefined;
}

/** The backend's import body for what was read. */
export function toImportPayload(source: 'healthkit' | 'health_connect', data: HealthData, now = new Date()) {
  const workouts = data.workouts
    .filter((w) => w.start <= now)
    .map((w) => ({
      externalId: w.id.slice(0, 120),
      activityType: w.activityType,
      startedAt: w.start.toISOString(),
      durationMin: Math.min(1440, Math.max(1, Math.round((w.end.getTime() - w.start.getTime()) / 60_000))),
      ...(w.kcal && w.kcal > 0 ? { caloriesBurned: Math.min(20000, Math.round(w.kcal)) } : {}),
      ...(w.avgHeartRate && w.avgHeartRate >= 30 && w.avgHeartRate <= 230 ? { avgHeartRate: Math.round(w.avgHeartRate) } : {}),
      ...(w.distanceM && w.distanceM > 0 ? { distanceM: Math.min(1_000_000, Math.round(w.distanceM)) } : {}),
    }))
    .slice(-300);

  const days = new Map<string, { date: string; steps?: number; sleepMinutes?: number }>();
  for (const s of data.steps) {
    days.set(s.date, { ...days.get(s.date), date: s.date, steps: Math.min(200000, Math.round(s.steps)) });
  }
  for (const [date, minutes] of Object.entries(sleepByNight(data.sleep))) {
    days.set(date, { ...days.get(date), date, sleepMinutes: Math.min(1440, minutes) });
  }
  const today = localDateStr(now);
  return {
    source,
    workouts,
    days: [...days.values()].filter((d) => d.date <= today).sort((a, b) => a.date.localeCompare(b.date)).slice(-62),
    weights: latestWeightPerDay(data.weights).filter((w) => w.date <= today).slice(-62),
    metrics: dailyMetrics(data.metrics ?? []).filter((m) => m.date <= today).slice(-600),
  };
}
