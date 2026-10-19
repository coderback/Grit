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
  /** Every workout in the week, oldest first */
  logs: ActivityLog[];
}

export function useActivityLogsForDate(date: string) {
  return useQuery<ActivityLog[]>({
    queryKey: ['activity-logs', date],
    queryFn: () =>
      api.get(`/activity-logs?date=${date}`).then((r) => r.data),
  });
}

/** Activity per day for the week containing `date` (default: this week). */
export function useWeeklySummary(date?: string) {
  return useQuery<WeeklySummary>({
    queryKey: ['activity-week', date ?? 'current'],
    queryFn: () => api.get('/activity-logs/week', { params: { date } }).then((r) => r.data),
  });
}

/** Everything that changes when a workout is added, edited or removed. */
function invalidateActivity(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['activity-logs'] });
  qc.invalidateQueries({ queryKey: ['activity-week'] });
  qc.invalidateQueries({ queryKey: ['leaderboard-weekly'] });
  // Burned calories feed the day's budget when earnback is on
  qc.invalidateQueries({ queryKey: ['food-logs'] });
}

export type ActivityUpdate = Partial<Pick<ActivityLog, 'activityType' | 'durationMin' | 'steps'>> & {
  caloriesBurned?: number;
};

export function useUpdateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: ActivityUpdate & { id: string }) =>
      api.patch<ActivityLog>(`/activity-logs/${id}`, data).then((r) => r.data),
    onSuccess: () => invalidateActivity(qc),
  });
}

export function useDeleteActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/activity-logs/${id}`).then((r) => r.data),
    onSuccess: () => invalidateActivity(qc),
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
      /** For back-filling an earlier day; omitted for now */
      loggedAt?: string;
    }) => api.post('/activity-logs', data).then((r) => r.data),
    onSuccess: () => invalidateActivity(qc),
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
