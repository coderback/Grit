import {
  isHealthDataAvailable,
  queryCategorySamples,
  queryQuantitySamples,
  queryStatisticsCollectionForQuantity,
  queryWorkoutSamples,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import { localDateStr } from '@/lib/date';
import { appleWorkoutType } from './transform';
import type { HealthSource, HealthWorkout, SleepInterval } from './types';

// Sleep analysis values that mean asleep (unspecified, core, deep, REM); 0 is
// in bed and 2 is awake
const ASLEEP = new Set([1, 3, 4, 5]);

const READ = [
  'HKWorkoutTypeIdentifier',
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierBodyMass',
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
] as const;

/** Apple Health, through @kingstinct/react-native-healthkit. */
export const healthSource: HealthSource = {
  id: 'healthkit',
  name: 'Apple Health',
  isAvailable: async () => {
    try {
      return isHealthDataAvailable();
    } catch {
      return false;
    }
  },
  requestAccess: async () => {
    // iOS never says what was granted, only that it asked
    await requestAuthorization({ toRead: READ as never });
    return true;
  },
  read: async (since, until) => {
    const filter = { date: { startDate: since, endDate: until } };

    const rawWorkouts = (await queryWorkoutSamples({ limit: 0, filter } as never)) as unknown as {
      uuid: string;
      workoutActivityType: number;
      startDate: Date;
      endDate: Date;
      totalEnergyBurned?: { quantity: number; unit: string };
    }[];
    const workouts: HealthWorkout[] = rawWorkouts.map((w) => ({
      id: `hk:${w.uuid}`,
      activityType: appleWorkoutType(w.workoutActivityType),
      start: new Date(w.startDate),
      end: new Date(w.endDate),
      kcal: w.totalEnergyBurned?.unit === 'kcal' ? w.totalEnergyBurned.quantity : undefined,
    }));

    // Daily step totals, de-duplicated across iPhone and Watch by HealthKit
    const midnight = new Date(since);
    midnight.setHours(0, 0, 0, 0);
    const stepDays = await queryStatisticsCollectionForQuantity(
      'HKQuantityTypeIdentifierStepCount',
      ['cumulativeSum'],
      midnight,
      { day: 1 },
      { filter, unit: 'count' } as never,
    );
    const steps = stepDays
      .filter((d) => d.startDate && d.sumQuantity)
      .map((d) => ({ date: localDateStr(new Date(d.startDate!)), steps: d.sumQuantity!.quantity }));

    const weightSamples = (await queryQuantitySamples('HKQuantityTypeIdentifierBodyMass', {
      limit: 0,
      unit: 'kg',
      filter,
    } as never)) as unknown as { quantity: number; startDate: Date }[];
    const weights = weightSamples.map((w) => ({ at: new Date(w.startDate), kg: w.quantity }));

    const sleepSamples = (await queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
      limit: 0,
      filter,
    } as never)) as unknown as { value: number; startDate: Date; endDate: Date }[];
    const sleep: SleepInterval[] = sleepSamples
      .filter((s) => s.value !== 0) // "in bed" isn't sleep
      .map((s) => ({ start: new Date(s.startDate), end: new Date(s.endDate), asleep: ASLEEP.has(s.value) }));

    return { workouts, steps, sleep, weights };
  },
};
