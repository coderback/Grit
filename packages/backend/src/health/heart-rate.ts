/**
 * Calories from a workout's average heart rate: Keytel et al. (2005),
 * "Prediction of energy expenditure from heart rate monitoring during
 * submaximal exercise", J Sports Sci 23(3). Separate equations for men and
 * women; the average of the two otherwise. Validated for heart rates of
 * about 90–150 bpm, so outside 90–200 the MET estimate is used instead.
 */

export interface Person {
  ageYears: number | null;
  weightKg: number | null;
  gender: string | null;
}

export const MIN_HR = 90;
export const MAX_HR = 200;

/** Kilocalories for the workout, or null when the equation doesn't apply. */
export function heartRateKcal(
  avgHeartRate: number,
  durationMin: number,
  p: Person,
): number | null {
  if (
    !p.ageYears ||
    !p.weightKg ||
    durationMin <= 0 ||
    avgHeartRate < MIN_HR ||
    avgHeartRate > MAX_HR
  ) {
    return null;
  }
  const hr = avgHeartRate;
  const male =
    (-55.0969 + 0.6309 * hr + 0.1988 * p.weightKg + 0.2017 * p.ageYears) /
    4.184;
  const female =
    (-20.4022 + 0.4472 * hr - 0.1263 * p.weightKg + 0.074 * p.ageYears) / 4.184;
  const perMin =
    p.gender === 'male'
      ? male
      : p.gender === 'female'
        ? female
        : (male + female) / 2;
  return perMin > 0 ? Math.round(perMin * durationMin) : null;
}

// The metrics GRIT keeps, with their units and believable ranges
export const METRICS = {
  hrv: { unit: 'ms', min: 1, max: 300 },
  resting_hr: { unit: 'bpm', min: 25, max: 150 },
  respiratory_rate: { unit: 'breaths_min', min: 4, max: 40 },
  sleep_temp_deviation: { unit: 'degC', min: -5, max: 5 },
  vo2max: { unit: 'ml_kg_min', min: 10, max: 100 },
  // 0 flow recorded without a level, 1 light, 2 medium, 3 heavy
  menstrual_flow: { unit: 'level', min: 0, max: 3 },
} as const;
export type MetricName = keyof typeof METRICS;
export const METRIC_NAMES = Object.keys(METRICS) as MetricName[];

// Cycle data: own consent, never in the feed, challenges or coach memory
export const CYCLE_METRICS = new Set<string>(['menstrual_flow']);
