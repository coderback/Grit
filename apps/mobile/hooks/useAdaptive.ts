import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface AdaptiveCheckIn {
  estimate: {
    tdee: number;
    confidence: 'low' | 'medium' | 'high';
    loggedDays: number;
    weighIns: number;
    spanDays: number;
    trendKgPerWeek: number;
    avgIntake: number;
  } | null;
  suggestion: { current: number; suggested: number; change: number; ideal: number; reason: string } | null;
  formulaTdee: number | null;
  progress: {
    loggedDays: number;
    weighIns: number;
    spanDays: number;
    needs: { loggedDays: number; weighIns: number; spanDays: number };
  };
  snoozedUntil: string | null;
}

/** Estimated burn from what you ate and how your weight moved, and a suggested target. */
export function useAdaptive() {
  return useQuery<AdaptiveCheckIn>({
    queryKey: ['adaptive'],
    queryFn: () => api.get('/targets/adaptive').then((r) => r.data),
    staleTime: 10 * 60_000,
  });
}

function refresh(qc: ReturnType<typeof useQueryClient>) {
  for (const key of ['adaptive', 'me', 'food-logs', 'trends', 'ai-nudge']) qc.invalidateQueries({ queryKey: [key] });
}

export function useApplyTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (calorieGoal: number) => api.post('/targets/adaptive/apply', { calorieGoal }).then((r) => r.data),
    meta: { errorMessage: "Couldn't update your target. Check your connection." },
    onSuccess: () => refresh(qc),
  });
}

export function useSnoozeTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/targets/adaptive/snooze').then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adaptive'] }),
  });
}
