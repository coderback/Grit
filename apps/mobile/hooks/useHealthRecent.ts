import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface HealthRecent {
  days: { date: string; steps: number | null; sleepMinutes: number | null; source: string }[];
  importedWorkouts: number;
  lastSyncedAt: string | null;
  /** Each recovery metric's latest value and 30-day average; never cycle data */
  recovery?: { metric: string; type: string | null; unit: string; latest: number; latestDate: string; average: number; days: number }[];
}

/** Whether cycle data is on, and how many days of it are stored. */
export function useCycleSummary() {
  return useQuery<{ consent: boolean; days: number }>({
    queryKey: ['health-cycle'],
    queryFn: () => api.get('/health/cycle').then((r) => r.data),
  });
}

/** The last week of synced steps and sleep. */
export function useHealthRecent() {
  return useQuery<HealthRecent>({
    queryKey: ['health-recent'],
    queryFn: () => api.get('/health/recent').then((r) => r.data),
  });
}
