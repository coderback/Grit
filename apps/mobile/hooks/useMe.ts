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
}

/** Fields the signed-in user can change with PUT /users/me. */
export type MeUpdate = Partial<Omit<Me, 'id' | 'username'>>;

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
    },
  });
}
