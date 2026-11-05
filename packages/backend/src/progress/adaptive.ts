/**
 * Adaptive calorie targets: estimate what someone actually burns from what
 * they logged eating and how their weight trend moved, then suggest a target
 * for their goal. Pure functions; the service feeds them daily data.
 */

export const KCAL_PER_KG = 7700;
const TREND_ALPHA = 0.1; // smoothing for the weight trend (about a 10-day memory)
export const MIN_SPAN_DAYS = 14;
export const MIN_LOGGED_DAYS = 10;
export const MIN_WEIGH_INS = 4;
const MAX_STEP_KCAL = 200; // the most a single check-in moves the target
const MIN_CHANGE_KCAL = 50; // smaller changes aren't worth suggesting
/** Used when no floor is passed; see common/safety for floors by sex. */
export const FLOOR_KCAL = 1200;

export interface AdaptiveDay {
  date: string;
  /** Calories logged, or null if the day wasn't logged fully enough to trust */
  intake: number | null;
  /** A weigh-in that day, if any */
  weightKg: number | null;
}

export interface Estimate {
  /** Estimated daily expenditure, kcal */
  tdee: number;
  confidence: 'low' | 'medium' | 'high';
  loggedDays: number;
  weighIns: number;
  spanDays: number;
  /** Weight trend change, kg per week (negative = losing) */
  trendKgPerWeek: number;
  /** Average logged intake on logged days */
  avgIntake: number;
}

/** Whether a day's food log looks complete enough to use. */
export function isLoggedDay(calories: number, entries: number, goal: number) {
  return entries >= 2 && calories >= goal * 0.4;
}

/**
 * An exponentially smoothed weight trend over every day from the first
 * weigh-in, carrying the trend through days without one.
 */
export function weightTrend(days: AdaptiveDay[]): (number | null)[] {
  let trend: number | null = null;
  return days.map((d) => {
    if (d.weightKg != null) {
      trend =
        trend == null ? d.weightKg : trend + TREND_ALPHA * (d.weightKg - trend);
    }
    return trend;
  });
}

/** Least-squares slope of weight against day number, kg per day. */
export function weightSlopePerDay(days: AdaptiveDay[]): number {
  const points = days
    .map((d, i) => [i, d.weightKg] as const)
    .filter((p): p is readonly [number, number] => p[1] != null);
  const n = points.length;
  if (n < 2) return 0;
  const mx = points.reduce((s, [x]) => s + x, 0) / n;
  const my = points.reduce((s, [, y]) => s + y, 0) / n;
  let num = 0;
  let den = 0;
  for (const [x, y] of points) {
    num += (x - mx) * (y - my);
    den += (x - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

/**
 * Observed expenditure = average intake − energy stored in the weight change.
 * Blended toward the formula estimate (`prior`) when data is thin. Null until
 * there's enough data to say anything.
 */
export function estimateExpenditure(
  days: AdaptiveDay[],
  prior: number | null,
): Estimate | null {
  const firstWeigh = days.findIndex((d) => d.weightKg != null);
  if (firstWeigh < 0) return null;
  const window = days.slice(firstWeigh);
  const spanDays = window.length;
  const logged = window.filter((d) => d.intake != null);
  const weighIns = window.filter((d) => d.weightKg != null).length;
  if (
    spanDays < MIN_SPAN_DAYS ||
    logged.length < MIN_LOGGED_DAYS ||
    weighIns < MIN_WEIGH_INS
  ) {
    return null;
  }

  // The weight change over the window, from a straight-line fit through the
  // weigh-ins: steady against day-to-day water swings, and unlike a smoothed
  // trend it doesn't lag behind a steady loss or gain
  const change = weightSlopePerDay(window) * (spanDays - 1);
  const avgIntake =
    logged.reduce((s, d) => s + (d.intake as number), 0) / logged.length;
  const observed =
    avgIntake - (change * KCAL_PER_KG) / Math.max(1, spanDays - 1);

  // How much to trust the observation over the formula
  const weight = Math.min(1, logged.length / 21) * Math.min(1, weighIns / 8);
  const tdee =
    prior != null ? weight * observed + (1 - weight) * prior : observed;
  const confidence =
    logged.length >= 21 && weighIns >= 10
      ? 'high'
      : logged.length >= 14 && weighIns >= 6
        ? 'medium'
        : 'low';

  return {
    tdee: Math.round(tdee / 10) * 10,
    confidence,
    loggedDays: logged.length,
    weighIns,
    spanDays,
    trendKgPerWeek:
      Math.round((change / Math.max(1, spanDays - 1)) * 7 * 100) / 100,
    avgIntake: Math.round(avgIntake),
  };
}

const PACE_KG_PER_WEEK: Record<string, number> = {
  slow: 0.25,
  moderate: 0.5,
  aggressive: 1,
};

/**
 * The target for the goal at that expenditure, before limits. A loss
 * deficit is capped at `maxDeficit` (1% of body weight a week).
 */
export function idealTarget(
  tdee: number,
  goal: string,
  pace: string | null,
  maxDeficit = Infinity,
) {
  const kgPerWeek = PACE_KG_PER_WEEK[pace ?? 'moderate'] ?? 0.5;
  const daily = (KCAL_PER_KG * kgPerWeek) / 7;
  if (goal === 'lose_weight') return tdee - Math.min(daily, maxDeficit);
  // Lean gain: half the pace
  if (goal === 'build_muscle' || goal === 'build_strength')
    return tdee + daily / 2;
  return tdee;
}

export interface Suggestion {
  current: number;
  suggested: number;
  change: number;
  /** The goal's ideal target, which a single step may not reach */
  ideal: number;
  reason: string;
}

export interface TargetLimits {
  /** Lowest target, by sex (common/safety) */
  floor?: number;
  /** Largest daily deficit, from body weight (common/safety) */
  maxDeficit?: number;
}

/**
 * The next target: toward the ideal, at most 200 kcal per check-in, never
 * below the floor, and only when the change is worth making.
 */
export function suggestTarget(
  est: Estimate,
  current: number,
  goal: string,
  pace: string | null,
  limits: TargetLimits = {},
): Suggestion | null {
  const floor = limits.floor ?? FLOOR_KCAL;
  const ideal = Math.max(
    floor,
    Math.round(idealTarget(est.tdee, goal, pace, limits.maxDeficit) / 10) * 10,
  );
  const delta = Math.max(
    -MAX_STEP_KCAL,
    Math.min(MAX_STEP_KCAL, ideal - current),
  );
  const suggested = Math.max(floor, Math.round((current + delta) / 10) * 10);
  const change = suggested - current;
  if (Math.abs(change) < MIN_CHANGE_KCAL) return null;

  const trend = est.trendKgPerWeek;
  const moving =
    trend < -0.05
      ? `losing ${Math.abs(trend)} kg a week`
      : trend > 0.05
        ? `gaining ${trend} kg a week`
        : 'holding steady';
  const reason =
    `Over ${est.spanDays} days you ate about ${est.avgIntake.toLocaleString('en-US')} kcal a day and were ${moving}, ` +
    `so you burn roughly ${est.tdee.toLocaleString('en-US')} kcal a day.` +
    (suggested === ideal
      ? ''
      : ` Moving ${change > 0 ? 'up' : 'down'} in steps keeps the change manageable.`);
  return { current, suggested, change, ideal, reason };
}

const ACTIVITY = {
  sedentary: 1.2,
  lightly_active: 1.375,
  active: 1.55,
  very_active: 1.725,
} as Record<string, number>;

/** Mifflin-St Jeor × activity, from the profile; null if it's incomplete. */
export function formulaTdee(
  u: {
    gender: string | null;
    weightKg: number | null;
    heightCm: number | null;
    dateOfBirth: Date | null;
    activityLevel: string | null;
  },
  now = new Date(),
): number | null {
  if (!u.weightKg || !u.heightCm || !u.dateOfBirth) return null;
  const age = (now.getTime() - u.dateOfBirth.getTime()) / (365.25 * 86_400_000);
  const base = 10 * u.weightKg + 6.25 * u.heightCm - 5 * age;
  const bmr =
    u.gender === 'male'
      ? base + 5
      : u.gender === 'female'
        ? base - 161
        : base - 78;
  return Math.round(bmr * (ACTIVITY[u.activityLevel ?? ''] ?? 1.2));
}
