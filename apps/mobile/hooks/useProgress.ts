import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type TrendRange = 7 | 30 | 90;

export interface TrendDay {
  date: string;
  calories: number;
  proteinG: number;
  foodEntries: number;
  activeMinutes: number;
  caloriesBurned: number;
  workouts: number;
  weightKg: number | null;
}

export interface Trends {
  days: TrendDay[];
  goals: { calories: number; proteinG: number; activeMinutes: number; weightKg: number | null };
  weightUnit: 'kg' | 'lb';
}

export interface WeightEntry {
  id: string;
  date: string;
  weightKg: number;
}

export interface WeightHistory {
  entries: WeightEntry[];
  latest: number | null;
  /** Latest minus the first entry in the range */
  change: number | null;
  goalWeightKg: number | null;
  /** Goal minus latest: negative means weight still to lose */
  toGoal: number | null;
}

export function useTrends(days: TrendRange) {
  return useQuery<Trends>({
    queryKey: ['trends', days],
    queryFn: () => api.get('/stats/trends', { params: { days } }).then((r) => r.data),
  });
}

export function useWeightHistory(days: 30 | 90 | 365 = 90) {
  return useQuery<WeightHistory>({
    queryKey: ['weight', days],
    queryFn: () => api.get('/weight', { params: { days } }).then((r) => r.data),
  });
}

/** Everything a weigh-in changes: the history, charts and profile weight. */
function invalidateWeight(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['weight'] });
  qc.invalidateQueries({ queryKey: ['trends'] });
  qc.invalidateQueries({ queryKey: ['me'] });
}

export function useLogWeight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { weightKg: number; date?: string }) => api.post<WeightEntry>('/weight', data).then((r) => r.data),
    onSuccess: () => invalidateWeight(qc),
  });
}

export function useDeleteWeight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/weight/${id}`).then((r) => r.data),
    meta: { errorMessage: "Couldn't delete that weigh-in. Check your connection." },
    onSuccess: () => invalidateWeight(qc),
  });
}
