import {
  ComparisonPredicateOperator,
  deleteObjects,
  isHealthDataAvailable,
  isObjectTypeAvailable,
  queryCategorySamples,
  queryQuantitySamples,
  queryStatisticsCollectionForQuantity,
  queryWorkoutSamples,
  requestAuthorization,
  saveQuantitySample,
} from '@kingstinct/react-native-healthkit';
import { localDateStr } from '@/lib/date';
import { appleWorkoutType, temperatureDeviations, toMetres } from './transform';
import type { AccessOptions, FoodEntry, HealthSource, HealthWorkout, MetricSample, SleepInterval } from './types';

// Sleep analysis values that mean asleep (unspecified, core, deep, REM); 0 is
// in bed and 2 is awake
const ASLEEP = new Set([1, 3, 4, 5]);

// Menstrual flow: 1 unspecified, 2 light, 3 medium, 4 heavy, 5 none →
// GRIT's 0 (flow, no level), 1, 2, 3; "none" isn't kept
const FLOW: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3 };

const RMSSD = 'HKQuantityTypeIdentifierHeartRateVariabilityRMSSD';

const READ = [
  'HKWorkoutTypeIdentifier',
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierBodyMass',
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierRespiratoryRate',
  'HKQuantityTypeIdentifierAppleSleepingWristTemperature',
  'HKQuantityTypeIdentifierVO2Max',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
] as const;
const CYCLE = 'HKCategoryTypeIdentifierMenstrualFlow';

// What GRIT writes for a logged meal, and the unit for each
const FOOD_TYPES = [
  ['HKQuantityTypeIdentifierDietaryEnergyConsumed', 'kcal', (f: FoodEntry) => f.calories],
  ['HKQuantityTypeIdentifierDietaryProtein', 'g', (f: FoodEntry) => f.proteinG],
  ['HKQuantityTypeIdentifierDietaryCarbohydrates', 'g', (f: FoodEntry) => f.carbsG],
  ['HKQuantityTypeIdentifierDietaryFatTotal', 'g', (f: FoodEntry) => f.fatG],
  ['HKQuantityTypeIdentifierDietaryCaffeine', 'mg', (f: FoodEntry) => f.caffeineMg ?? 0],
] as const;
const FOOD_KEY = 'GRITFoodLogId';

/** RMSSD arrives in newer iOS versions; ask for it only where it exists. */
function hasRmssd() {
  try {
    return isObjectTypeAvailable(RMSSD as never);
  } catch {
    return false;
  }
}

type Sample = { quantity: number; startDate: Date; sourceRevision?: { source?: { name?: string } }; device?: { name?: string } };
const deviceOf = (s: Sample) => s.device?.name ?? s.sourceRevision?.source?.name;

async function quantities(id: string, unit: string, filter: object): Promise<Sample[]> {
  try {
    return (await queryQuantitySamples(id as never, { limit: 0, unit, filter } as never)) as unknown as Sample[];
  } catch {
    // Not allowed, or not on this iOS: carry on without it
    return [];
  }
}

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
  requestAccess: async (opts?: AccessOptions) => {
    const toRead = [...READ, ...(hasRmssd() ? [RMSSD] : []), ...(opts?.cycle ? [CYCLE] : [])];
    const toShare = opts?.writeFood ? FOOD_TYPES.map(([id]) => id) : [];
    // iOS never says what was granted, only that it asked
    await requestAuthorization({ toRead: toRead as never, toShare: toShare as never });
    return true;
  },
  read: async (since, until, opts) => {
    const filter = { date: { startDate: since, endDate: until } };

    const rawWorkouts = (await queryWorkoutSamples({ limit: 0, filter } as never)) as unknown as {
      uuid: string;
      workoutActivityType: number;
      startDate: Date;
      endDate: Date;
      totalEnergyBurned?: { quantity: number; unit: string };
      totalDistance?: { quantity: number; unit: string };
      getStatistic?: (id: string, unit?: string) => Promise<{ averageQuantity?: { quantity: number } } | undefined>;
    }[];
    const workouts: HealthWorkout[] = [];
    for (const w of rawWorkouts) {
      let avgHeartRate: number | undefined;
      try {
        avgHeartRate = (await w.getStatistic?.('HKQuantityTypeIdentifierHeartRate', 'count/min'))?.averageQuantity?.quantity;
      } catch {
        avgHeartRate = undefined;
      }
      workouts.push({
        id: `hk:${w.uuid}`,
        activityType: appleWorkoutType(w.workoutActivityType),
        start: new Date(w.startDate),
        end: new Date(w.endDate),
        kcal: w.totalEnergyBurned?.unit === 'kcal' ? w.totalEnergyBurned.quantity : undefined,
        avgHeartRate,
        distanceM: toMetres(w.totalDistance),
      });
    }

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

    const weights = (await quantities('HKQuantityTypeIdentifierBodyMass', 'kg', filter)).map((w) => ({ at: new Date(w.startDate), kg: w.quantity }));

    const sleepSamples = (await queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
      limit: 0,
      filter,
    } as never)) as unknown as { value: number; startDate: Date; endDate: Date }[];
    const sleep: SleepInterval[] = sleepSamples
      .filter((s) => s.value !== 0) // "in bed" isn't sleep
      .map((s) => ({ start: new Date(s.startDate), end: new Date(s.endDate), asleep: ASLEEP.has(s.value) }));

    const metrics: MetricSample[] = [];
    const add = async (id: string, unit: string, metric: MetricSample['metric'], type?: 'sdnn' | 'rmssd') => {
      for (const s of await quantities(id, unit, filter)) {
        metrics.push({ metric, type, at: new Date(s.startDate), value: s.quantity, device: deviceOf(s) });
      }
    };
    await add('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', 'ms', 'hrv', 'sdnn');
    if (hasRmssd()) await add(RMSSD, 'ms', 'hrv', 'rmssd');
    await add('HKQuantityTypeIdentifierRestingHeartRate', 'count/min', 'resting_hr');
    await add('HKQuantityTypeIdentifierRespiratoryRate', 'count/min', 'respiratory_rate');
    await add('HKQuantityTypeIdentifierVO2Max', 'ml/(kg*min)', 'vo2max');
    // Temperature needs earlier nights for its baseline, so read five weeks of it
    const tempFrom = new Date(Math.min(since.getTime(), until.getTime() - 35 * 86_400_000));
    const temps = await quantities('HKQuantityTypeIdentifierAppleSleepingWristTemperature', 'degC', { date: { startDate: tempFrom, endDate: until } });
    metrics.push(
      ...temperatureDeviations(temps.map((t) => ({ at: new Date(t.startDate), celsius: t.quantity, device: deviceOf(t) }))).filter((m) => m.at >= since),
    );

    if (opts?.cycle) {
      try {
        const flow = (await queryCategorySamples(CYCLE as never, { limit: 0, filter } as never)) as unknown as { value: number; startDate: Date }[];
        for (const f of flow) {
          if (f.value in FLOW) metrics.push({ metric: 'menstrual_flow', at: new Date(f.startDate), value: FLOW[f.value] });
        }
      } catch {
        // Not allowed: nothing to import
      }
    }

    return { workouts, steps, sleep, weights, metrics };
  },
  writeFood: async (food) => {
    const at = new Date(food.loggedAt);
    for (const [id, unit, pick] of FOOD_TYPES) {
      const value = pick(food);
      if (!(value > 0)) continue;
      await saveQuantitySample(id as never, unit as never, value, at, at, { [FOOD_KEY]: food.id, HKFoodType: food.name.slice(0, 100) } as never);
    }
  },
  deleteFood: async (foodId) => {
    for (const [id] of FOOD_TYPES) {
      await deleteObjects(id as never, { metadata: { withMetadataKey: FOOD_KEY, operatorType: ComparisonPredicateOperator.equalTo, value: foodId } } as never).catch(() => 0);
    }
  },
};
