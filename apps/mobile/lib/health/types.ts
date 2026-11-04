/** What GRIT reads from Apple Health or Health Connect, before sending it to the backend. */

export interface HealthWorkout {
  /** The health app's own ID, so syncing again updates instead of duplicating */
  id: string;
  /** One of GRIT's activity types */
  activityType: string;
  start: Date;
  end: Date;
  kcal?: number;
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
}

/** One phone's health store. */
export interface HealthSource {
  /** 'healthkit' or 'health_connect'; null where there's none (web) */
  id: 'healthkit' | 'health_connect' | null;
  /** "Apple Health" or "Health Connect" */
  name: string;
  isAvailable(): Promise<boolean>;
  /** Asks for read access; true if granted (iOS never says, so true once asked) */
  requestAccess(): Promise<boolean>;
  read(since: Date, until: Date): Promise<HealthData>;
}
