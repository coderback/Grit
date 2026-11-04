/** Mifflin-St Jeor BMR */
export function calcBMR(
  gender: 'male' | 'female' | 'other',
  weightKg: number,
  heightCm: number,
  ageYears: number,
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  // 'other' uses the average of male (+5) and female (-161) offsets = -78
  if (gender === 'male') return base + 5;
  if (gender === 'female') return base - 161;
  return base - 78;
}

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  active: 1.55,
  very_active: 1.725,
};

export function calcTDEE(bmr: number, activityLevel: string): number {
  return Math.round(bmr * (ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.2));
}

const PACE_KG_PER_WEEK: Record<string, number> = {
  slow: 0.25,
  moderate: 0.5,
  aggressive: 1.0,
};

export function calcAdjustedCalories(
  tdee: number,
  goal: string,
  pace: string,
): number {
  const kgPerWeek = PACE_KG_PER_WEEK[pace] ?? 0.5;
  const dailyDelta = Math.round((7700 * kgPerWeek) / 7);

  if (goal === 'lose_weight') return Math.max(1200, tdee - dailyDelta);
  if (goal === 'build_muscle') return tdee + dailyDelta;
  return tdee; // maintain / recomp
}

// Share of calories from each macro by goal focus. Mirrors the backend's
// common/nutrition.ts, which is the source of truth once signed in.
const MACRO_SPLITS: Record<string, { protein: number; carbs: number; fat: number }> = {
  high_protein: { protein: 0.4, carbs: 0.3, fat: 0.3 },
  balanced: { protein: 0.3, carbs: 0.4, fat: 0.3 },
  low_carb: { protein: 0.3, carbs: 0.2, fat: 0.5 },
};

export function calcMacros(
  calories: number,
  goalFocus?: string | null,
): {
  proteinG: number;
  carbsG: number;
  fatG: number;
} {
  const split = MACRO_SPLITS[goalFocus ?? 'balanced'] ?? MACRO_SPLITS.balanced;
  return {
    proteinG: Math.round((calories * split.protein) / 4),
    carbsG: Math.round((calories * split.carbs) / 4),
    fatG: Math.round((calories * split.fat) / 9),
  };
}

/** Returns weeks to goal, or null if goal === current or no pace */
export function calcTimeline(
  currentKg: number,
  desiredKg: number,
  pace: string,
): number | null {
  const kgPerWeek = PACE_KG_PER_WEEK[pace];
  if (!kgPerWeek || Math.abs(currentKg - desiredKg) < 0.1) return null;
  return Math.ceil(Math.abs(currentKg - desiredKg) / kgPerWeek);
}

export function ageFromDOB(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}
