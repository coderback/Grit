/** What GRIT reads from Apple Health or Health Connect, before sending it to the backend. */

export interface HealthWorkout {
  /** The health app's own ID, so syncing again updates instead of duplicating */
  id: string;
  /** One of GRIT's activity types */
  activityType: string;
  start: Date;
  end: Date;
  kcal?: number;
  /** Average over the workout, from the watch */
  avgHeartRate?: number;
  distanceM?: number;
}

export type MetricName = 'hrv' | 'resting_hr' | 'respiratory_rate' | 'sleep_temp_deviation' | 'vo2max' | 'menstrual_flow';

/** One reading of a recovery or cycle metric. */
export interface MetricSample {
  metric: MetricName;
  /** HRV only: Apple gives SDNN, Health Connect RMSSD; they can't be compared */
  type?: 'sdnn' | 'rmssd';
  at: Date;
  value: number;
  /** The app or device that recorded it */
  device?: string;
}

/** A logged meal, written back to the health app when that's turned on. */
export interface FoodEntry {
  id: string;
  name: string;
  loggedAt: Date;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  caffeineMg?: number | null;
  mealType?: string | null;
}

export interface AccessOptions {
  /** Menstrual data: its own consent in GRIT */
  cycle: boolean;
  /** Write logged meals back */
  writeFood: boolean;
}

/** A stretch of sleep (or awake time inside a sleep session). */
export interface SleepInterval {
  start: Date;
  end: Date;
  asleep: boolean;
}

export interface DailySteps {
  /** Local YYYY-MM-DD */
  date: string;
  steps: number;
}

export interface WeightSample {
  at: Date;
  kg: number;
}

export interface HealthData {
  workouts: HealthWorkout[];
  steps: DailySteps[];
  sleep: SleepInterval[];
  weights: WeightSample[];
  metrics: MetricSample[];
}

/** One phone's health store. */
export interface HealthSource {
  /** 'healthkit' or 'health_connect'; null where there's none (web) */
  id: 'healthkit' | 'health_connect' | null;
  /** "Apple Health" or "Health Connect" */
  name: string;
  isAvailable(): Promise<boolean>;
  /** Asks for access; true if granted (iOS never says, so true once asked) */
  requestAccess(opts?: AccessOptions): Promise<boolean>;
  read(since: Date, until: Date, opts?: { cycle: boolean }): Promise<HealthData>;
  /** Writes a logged meal's energy, macros and caffeine */
  writeFood(food: FoodEntry): Promise<void>;
  /** Removes a meal GRIT wrote, when it's deleted in GRIT */
  deleteFood(id: string): Promise<void>;
}
