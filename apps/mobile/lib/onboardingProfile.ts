import { api } from './api';
import { calcAdjustedCalories, calcBMR, calcTDEE, ageFromDOB } from './tdee';
import { useOnboardingStore } from '@/stores/onboardingStore';

/**
 * Saves the answers collected during onboarding to the user's profile, then
 * clears them. Does nothing if there are no pending answers. Throws if the
 * save fails, leaving the answers in place to retry at the next login.
 */
export async function syncOnboardingProfile(): Promise<void> {
  const s = useOnboardingStore.getState();
  if (!s.gender || !s.dateOfBirth || !s.heightCm || !s.weightKg) return;

  const calorieGoal =
    s.activityLevel && s.primaryGoal && s.pace
      ? calcAdjustedCalories(
          calcTDEE(calcBMR(s.gender, s.weightKg, s.heightCm, ageFromDOB(s.dateOfBirth)), s.activityLevel),
          s.primaryGoal,
          s.pace,
        )
      : undefined;

  await api.put('/users/me', {
    gender: s.gender,
    dateOfBirth: s.dateOfBirth,
    heightCm: s.heightCm,
    weightKg: s.weightKg,
    activityLevel: s.activityLevel ?? undefined,
    primaryGoal: s.primaryGoal ?? undefined,
    calorieGoal,
  });
  s.reset();
}
