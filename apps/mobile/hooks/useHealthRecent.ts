import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface HealthRecent {
  days: { date: string; steps: number | null; sleepMinutes: number | null; source: string }[];
  importedWorkouts: number;
  lastSyncedAt: string | null;
}

/** The last week of synced steps and sleep. */
export function useHealthRecent() {
  return useQuery<HealthRecent>({
    queryKey: ['health-recent'],
    queryFn: () => api.get('/health/recent').then((r) => r.data),
  });
}
