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
    goalWeightKg: s.desiredWeightKg ?? undefined,
    pace: s.pace ?? undefined,
    goalFocus: s.goalFocus ?? undefined,
    dietType: s.dietType ?? undefined,
    aim: s.accomplishment ?? undefined,
    friction: s.friction ?? undefined,
    earnbackCalories: s.earnbackCalories,
    rolloverCalories: s.rolloverCalories,
    weightUnit: s.weightUnit,
    heightUnit: s.heightUnit,
    notifWorkout: s.notifWorkout,
    notifMeal: s.notifMeal,
    notifProgress: s.notifProgress,
    notifStreak: s.notifStreak,
    notifOffTrackOnly: s.notifOffTrackOnly,
  });
  s.reset();

  // The coach builds a first workout plan from these answers. It takes a few
  // seconds, so it runs in the background; the Plan screen can retry it.
  void api.post('/workout-plan/generate', {}, { timeout: 90_000 }).catch(() => {});
}
