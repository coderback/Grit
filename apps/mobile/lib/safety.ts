/**
 * Safety rules, mirroring the backend's common/safety.ts (the backend
 * enforces them; the app uses them so screens never offer what it refuses).
 */
export const FLOOR_FEMALE_KCAL = 1200;
export const FLOOR_MALE_KCAL = 1500;
export const MAX_WEEKLY_LOSS_FRACTION = 0.01;
export const MIN_AGE = 18;

/** The lowest daily target for this person. Without a known sex, the lower one. */
export function calorieFloor(gender: string | null | undefined): number {
  return gender === 'male' ? FLOOR_MALE_KCAL : FLOOR_FEMALE_KCAL;
}

/** The largest daily deficit planned for this body weight (1% a week), or none if unknown. */
export function maxDailyDeficit(weightKg: number | null | undefined): number {
  if (!weightKg || weightKg <= 0) return Infinity;
  return Math.round((weightKg * MAX_WEEKLY_LOSS_FRACTION * 7700) / 7);
}

/** Someone who said they have (or had) an eating disorder gets no weight-loss targets. */
export function weightLossAllowed(edScreen: string | null | undefined) {
  return edScreen !== 'yes';
}
