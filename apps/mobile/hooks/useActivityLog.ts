import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ActivityLog {
  id: string;
  activityType: string;
  durationMin: number;
  caloriesBurned: number | null;
  steps: number | null;
  source: string;
  loggedAt: string;
  kudosCount: number;
}

export interface WeekDay {
  date: string;
  activeMinutes: number;
  caloriesBurned: number;
  steps: number;
}

export interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  days: WeekDay[];
  totals: { activeMinutes: number; caloriesBurned: number; steps: number };
}

export function useActivityLogsForDate(date: string) {
  return useQuery<ActivityLog[]>({
    queryKey: ['activity-logs', date],
    queryFn: () =>
      api.get(`/activity-logs?date=${date}`).then((r) => r.data),
  });
}

export function useWeeklySummary() {
  return useQuery<WeeklySummary>({
    queryKey: ['activity-week'],
    queryFn: () => api.get('/activity-logs/week').then((r) => r.data),
  });
}

export function useLogActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      activityType: string;
      durationMin: number;
      caloriesBurned?: number;
      steps?: number;
      source?: string;
    }) => api.post('/activity-logs', data).then((r) => r.data),
    onSuccess: () => {
      const today = new Date().toISOString().split('T')[0];
      qc.invalidateQueries({ queryKey: ['activity-logs', today] });
      qc.invalidateQueries({ queryKey: ['activity-week'] });
    },
  });
}

export function useGiveKudos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (logId: string) =>
      api.post(`/activity-logs/${logId}/kudos`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

export function useActivityTypes() {
  return useQuery<string[]>({
    queryKey: ['activity-types'],
    queryFn: () => api.get('/activity-logs/types').then((r) => r.data),
    staleTime: Infinity,
  });
}
