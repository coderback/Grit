import {
  aggregateGroupByPeriod,
  getSdkStatus,
  initialize,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import { localDateStr } from '@/lib/date';
import { androidExerciseType } from './transform';
import type { HealthSource, SleepInterval } from './types';

// Sleep stage types that are awake time inside a session
const AWAKE_STAGES = new Set([1, 3]);

const PERMISSIONS = [
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'Weight' },
  { accessType: 'read', recordType: 'SleepSession' },
] as const;

let initialized = false;
async function ready() {
  if (!initialized) initialized = await initialize();
  return initialized;
}

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
  requestAccess: async () => {
    if (!(await ready())) return false;
    const granted = await requestPermission([...PERMISSIONS] as never);
    return granted.length > 0;
  },
  read: async (since, until) => {
    await ready();
    const timeRangeFilter = { operator: 'between' as const, startTime: since.toISOString(), endTime: until.toISOString() };

    const sessions = await readRecords('ExerciseSession', { timeRangeFilter });
    const workouts = sessions.records.map((r) => ({
      id: `hc:${r.metadata?.id ?? `${r.startTime}-${r.exerciseType}`}`,
      activityType: androidExerciseType(r.exerciseType),
      start: new Date(r.startTime),
      end: new Date(r.endTime),
    }));

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

    const weightRecords = await readRecords('Weight', { timeRangeFilter });
    const weights = weightRecords.records.map((w) => ({ at: new Date(w.time), kg: w.weight.inKilograms }));

    const sleepRecords = await readRecords('SleepSession', { timeRangeFilter });
    const sleep: SleepInterval[] = [];
    for (const s of sleepRecords.records) {
      sleep.push({ start: new Date(s.startTime), end: new Date(s.endTime), asleep: true });
      for (const stage of s.stages ?? []) {
        if (AWAKE_STAGES.has(stage.stage)) {
          sleep.push({ start: new Date(stage.startTime), end: new Date(stage.endTime), asleep: false });
        }
      }
    }

    return { workouts, steps, sleep, weights };
  },
};
