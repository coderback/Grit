import { create } from 'zustand';

interface OnboardingState {
  // Step 1 — basics
  gender: 'male' | 'female' | null;
  dateOfBirth: string | null; // ISO date string YYYY-MM-DD
  heightCm: number | null;
  weightKg: number | null;
  // Step 2 — activity
  activityLevel: 'sedentary' | 'lightly_active' | 'active' | 'very_active' | null;
  // Step 3 — goal
  primaryGoal: 'lose_weight' | 'build_muscle' | 'maintain' | 'recomp' | null;
  desiredWeightKg: number | null;
  // Step 4 — pace
  pace: 'slow' | 'moderate' | 'aggressive' | null;
  // Step 5 — friction
  friction: string | null;
  // Step 6 — nutrition
  dietType: string | null;
  goalFocus: string | null;
  accomplishment: string | null;
  // Step 7 — advanced
  earnbackCalories: boolean;
  rolloverCalories: boolean;
  // Step 8 — notifications
  notifWorkout: boolean;
  notifMeal: boolean;
  notifProgress: boolean;
  notifStreak: boolean;
  notifOffTrackOnly: boolean;
  // Actions
  set: (partial: Partial<Omit<OnboardingState, 'set'>>) => void;
  reset: () => void;
}

const defaults = {
  gender: null,
  dateOfBirth: null,
  heightCm: null,
  weightKg: null,
  activityLevel: null,
  primaryGoal: null,
  desiredWeightKg: null,
  pace: null,
  friction: null,
  dietType: null,
  goalFocus: null,
  accomplishment: null,
  earnbackCalories: false,
  rolloverCalories: false,
  notifWorkout: true,
  notifMeal: false,
  notifProgress: true,
  notifStreak: true,
  notifOffTrackOnly: false,
} as const;

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...defaults,
  set: (partial) => set(partial),
  reset: () => set(defaults),
}));
