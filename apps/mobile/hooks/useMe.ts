import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** The signed-in user's own profile row from the backend. */
export interface Me {
  id: string; // backend user ID, not the Supabase auth ID
  username: string;
  displayName: string;
  avatarUrl: string | null;
  calorieGoal: number;
  weightKg: number | null;
  heightCm: number | null;
  gender: 'male' | 'female' | 'other' | null;
  dateOfBirth: string | null;
  activityLevel: 'sedentary' | 'lightly_active' | 'active' | 'very_active' | null;
  primaryGoal: string | null;
  goalWeightKg: number | null;
  pace: 'slow' | 'moderate' | 'aggressive' | null;
  goalFocus: 'high_protein' | 'balanced' | 'low_carb';
  dietType: string | null;
  aim: string | null;
  friction: string | null;
  activeMinutesGoal: number;
  earnbackCalories: boolean;
  rolloverCalories: boolean;
  weightUnit: 'kg' | 'lb';
  heightUnit: 'cm' | 'ft';
  notifWorkout: boolean;
  notifMeal: boolean;
  notifProgress: boolean;
  notifStreak: boolean;
  notifOffTrackOnly: boolean;
  /** Push alerts for follows, requests, kudos and challenges */
  notifSocial: boolean;
  /** Followers need approval; only they see your activity */
  isPrivate: boolean;
  /** When the user allowed meals and chats to go to Azure OpenAI; null = no AI features */
  aiConsentAt: string | null;
  /** The eating-disorder question: "yes" turns off weight-loss targets */
  edScreen: 'no' | 'yes' | 'prefer_not' | null;
  consentFoodData: boolean;
  consentHealthTraining: boolean;
  consentWorkoutTraining: boolean;
  consentOffSharing: boolean;
  /** Reading menstrual data from the health app: its own consent */
  consentCycleData: boolean;
}

/** Fields the signed-in user can change with PUT /users/me. */
export type MeUpdate = Partial<Omit<Me, 'id' | 'username' | 'aiConsentAt'>>;

export function useMe() {
  return useQuery<Me>({
    queryKey: ['me'],
    queryFn: () => api.get('/users/me').then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });
}

/** Saves profile fields and refreshes everything derived from them. */
export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (update: MeUpdate) => api.put<Me>('/users/me', update).then((r) => r.data),
    onSuccess: (me) => {
      qc.setQueryData(['me'], me);
      // Goals feed the day's budget, macro targets and the coach's context
      qc.invalidateQueries({ queryKey: ['food-logs'] });
      qc.invalidateQueries({ queryKey: ['ai-nudge'] });
      // Age, sex and the calorie goal set the nutrient targets
      qc.invalidateQueries({ queryKey: ['nutrients-day'] });
      qc.invalidateQueries({ queryKey: ['nutrients-week'] });
      // A weight change is also today's weigh-in; goals move the chart lines
      qc.invalidateQueries({ queryKey: ['weight'] });
      qc.invalidateQueries({ queryKey: ['trends'] });
    },
  });
}
