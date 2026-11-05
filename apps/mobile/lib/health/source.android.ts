import {
  aggregateGroupByPeriod,
  aggregateRecord,
  deleteRecordsByUuids,
  getSdkStatus,
  initialize,
  insertRecords,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import { localDateStr } from '@/lib/date';
import { androidExerciseType } from './transform';
import type { AccessOptions, HealthSource, HealthWorkout, MetricSample, SleepInterval } from './types';

// Sleep stage types that are awake time inside a session
const AWAKE_STAGES = new Set([1, 3]);

// Health Connect MealType: 1 breakfast, 2 lunch, 3 dinner, 4 snack
const MEAL_TYPES: Record<string, number> = { breakfast: 1, lunch: 2, dinner: 3, snack: 4 };

const READ = [
  'ExerciseSession',
  'Steps',
  'Weight',
  'SleepSession',
  'HeartRate',
  'HeartRateVariabilityRmssd',
  'RestingHeartRate',
  'RespiratoryRate',
  'SkinTemperature',
  'Vo2Max',
  'Distance',
] as const;
const CYCLE = ['MenstruationFlow', 'MenstruationPeriod'] as const;

let initialized = false;
async function ready() {
  if (!initialized) initialized = await initialize();
  return initialized;
}

async function records<T>(type: string, timeRangeFilter: object): Promise<T[]> {
  try {
    return ((await readRecords(type as never, { timeRangeFilter } as never)) as unknown as { records: T[] }).records;
  } catch {
    // Not allowed: carry on without it
    return [];
  }
}

type WithOrigin = { metadata?: { dataOrigin?: string; device?: { model?: string; manufacturer?: string } } };
const deviceOf = (r: WithOrigin) => r.metadata?.device?.model ?? r.metadata?.dataOrigin;

/** Health Connect, through react-native-health-connect. */
export const healthSource: HealthSource = {
  id: 'health_connect',
  name: 'Health Connect',
  isAvailable: async () => {
    try {
      return (await getSdkStatus()) === SdkAvailabilityStatus.SDK_AVAILABLE && (await ready());
    } catch {
      return false;
    }
  },
  requestAccess: async (opts?: AccessOptions) => {
    if (!(await ready())) return false;
    const permissions = [
      ...READ.map((recordType) => ({ accessType: 'read', recordType })),
      ...(opts?.cycle ? CYCLE.map((recordType) => ({ accessType: 'read', recordType })) : []),
      ...(opts?.writeFood ? [{ accessType: 'write', recordType: 'Nutrition' }] : []),
      // Data from before GRIT was connected (Health Connect otherwise allows 30 days)
      { accessType: 'read', recordType: 'ReadHealthDataHistory' },
    ];
    const granted = await requestPermission(permissions as never);
    return granted.length > 0;
  },
  read: async (since, until, opts) => {
    await ready();
    const timeRangeFilter = { operator: 'between' as const, startTime: since.toISOString(), endTime: until.toISOString() };

    const sessions = await records<{ startTime: string; endTime: string; exerciseType: number; metadata?: { id?: string } }>('ExerciseSession', timeRangeFilter);
    const workouts: HealthWorkout[] = [];
    for (const r of sessions) {
      const range = { operator: 'between' as const, startTime: r.startTime, endTime: r.endTime };
      const beats = (await records<{ samples: { beatsPerMinute: number }[] }>('HeartRate', range)).flatMap((h) => h.samples);
      let distanceM: number | undefined;
      try {
        distanceM = ((await aggregateRecord({ recordType: 'Distance', timeRangeFilter: range } as never)) as unknown as { DISTANCE?: { inMeters: number } }).DISTANCE?.inMeters;
      } catch {
        distanceM = undefined;
      }
      workouts.push({
        id: `hc:${r.metadata?.id ?? `${r.startTime}-${r.exerciseType}`}`,
        activityType: androidExerciseType(r.exerciseType),
        start: new Date(r.startTime),
        end: new Date(r.endTime),
        avgHeartRate: beats.length ? beats.reduce((t, b) => t + b.beatsPerMinute, 0) / beats.length : undefined,
        distanceM: distanceM && distanceM > 0 ? distanceM : undefined,
      });
    }

    const midnight = new Date(since);
    midnight.setHours(0, 0, 0, 0);
    const stepGroups = await aggregateGroupByPeriod({
      recordType: 'Steps',
      timeRangeFilter: { operator: 'between', startTime: midnight.toISOString(), endTime: until.toISOString() },
      timeRangeSlicer: { period: 'DAYS', length: 1 },
    } as never);
    const steps = (stepGroups as unknown as { startTime: string; result: { COUNT_TOTAL?: number } }[]).map((g) => ({
      date: localDateStr(new Date(g.startTime)),
      steps: g.result.COUNT_TOTAL ?? 0,
    }));

    const weights = (await records<{ time: string; weight: { inKilograms: number } }>('Weight', timeRangeFilter)).map((w) => ({ at: new Date(w.time), kg: w.weight.inKilograms }));

    const sleep: SleepInterval[] = [];
    for (const s of await records<{ startTime: string; endTime: string; stages?: { stage: number; startTime: string; endTime: string }[] }>('SleepSession', timeRangeFilter)) {
      sleep.push({ start: new Date(s.startTime), end: new Date(s.endTime), asleep: true });
      for (const stage of s.stages ?? []) {
        if (AWAKE_STAGES.has(stage.stage)) {
          sleep.push({ start: new Date(stage.startTime), end: new Date(stage.endTime), asleep: false });
        }
      }
    }

    const metrics: MetricSample[] = [];
    for (const r of await records<{ time: string; heartRateVariabilityMillis: number } & WithOrigin>('HeartRateVariabilityRmssd', timeRangeFilter)) {
      metrics.push({ metric: 'hrv', type: 'rmssd', at: new Date(r.time), value: r.heartRateVariabilityMillis, device: deviceOf(r) });
    }
    for (const r of await records<{ time: string; beatsPerMinute: number } & WithOrigin>('RestingHeartRate', timeRangeFilter)) {
      metrics.push({ metric: 'resting_hr', at: new Date(r.time), value: r.beatsPerMinute, device: deviceOf(r) });
    }
    for (const r of await records<{ time: string; rate: number } & WithOrigin>('RespiratoryRate', timeRangeFilter)) {
      metrics.push({ metric: 'respiratory_rate', at: new Date(r.time), value: r.rate, device: deviceOf(r) });
    }
    for (const r of await records<{ time: string; vo2MillilitersPerMinuteKilogram: number } & WithOrigin>('Vo2Max', timeRangeFilter)) {
      metrics.push({ metric: 'vo2max', at: new Date(r.time), value: r.vo2MillilitersPerMinuteKilogram, device: deviceOf(r) });
    }
    // Skin temperature comes as deviations from the device's baseline: the night's average
    for (const r of await records<{ endTime: string; deltas: { delta: { inCelsius: number } }[] } & WithOrigin>('SkinTemperature', timeRangeFilter)) {
      if (!r.deltas?.length) continue;
      const avg = r.deltas.reduce((t, d) => t + d.delta.inCelsius, 0) / r.deltas.length;
      metrics.push({ metric: 'sleep_temp_deviation', at: new Date(r.endTime), value: avg, device: deviceOf(r) });
    }

    if (opts?.cycle) {
      // Flow: 0 unknown, 1 light, 2 medium, 3 heavy, matching GRIT's levels
      for (const r of await records<{ time: string; flow?: number }>('MenstruationFlow', timeRangeFilter)) {
        metrics.push({ metric: 'menstrual_flow', at: new Date(r.time), value: r.flow ?? 0 });
      }
      // Period days without a flow record count as flow with no level
      for (const r of await records<{ startTime?: string; endTime?: string; time?: string }>('MenstruationPeriod', timeRangeFilter)) {
        const start = new Date(r.startTime ?? r.time!);
        const end = new Date(r.endTime ?? r.time!);
        for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86_400_000)) {
          metrics.push({ metric: 'menstrual_flow', at: d, value: 0 });
        }
      }
    }

    return { workouts, steps, sleep, weights, metrics };
  },
  writeFood: async (food) => {
    const at = new Date(food.loggedAt).toISOString();
    const g = (value: number) => ({ unit: 'grams', value: Math.max(0, value) });
    await insertRecords([
      {
        recordType: 'Nutrition',
        startTime: at,
        endTime: at,
        name: food.name.slice(0, 100),
        mealType: MEAL_TYPES[food.mealType ?? ''] ?? 0,
        energy: { unit: 'kilocalories', value: Math.max(0, food.calories) },
        protein: g(food.proteinG),
        totalCarbohydrate: g(food.carbsG),
        totalFat: g(food.fatG),
        ...(food.caffeineMg ? { caffeine: { unit: 'milligrams', value: food.caffeineMg } } : {}),
        // Keyed on GRIT's log, so writing it again replaces it
        metadata: { clientRecordId: food.id, clientRecordVersion: Date.now() },
      },
    ] as never);
  },
  deleteFood: async (id) => {
    await deleteRecordsByUuids('Nutrition', [], [id]).catch(() => undefined);
  },
};
