import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PrKind, Records } from '@/lib/strength';
import type { Exercise } from '@/hooks/useExercises';

export interface Suggestion {
  action: 'start' | 'increase' | 'reps' | 'hold' | 'deload';
  weightKg: number | null;
  sets: number;
  reps: number;
  repsLow: number;
  repsHigh: number;
  holds: ('deficit' | 'protein' | 'sleep')[];
  reasons: string[];
}

export interface PastSet {
  reps: number;
  weightKg: number | null;
  durationSec: number | null;
}

export interface PreparedExercise {
  exerciseId: string;
  name: string;
  equipment: string[];
  pattern: string | null;
  imageUrl: string | null;
  detail: string | null;
  timed: { sets: number; seconds: number } | null;
  last: { date: string; sets: PastSet[] } | null;
  /** Set when the history is borrowed from a similar exercise after a swap */
  historyFrom: { id: string; name: string } | null;
  records: Records;
  suggestion: Suggestion | null;
}

export interface SavedSet {
  id: string;
  exerciseId: string;
  exerciseName: string;
  reps: number;
  weightKg: number | null;
  durationSec: number | null;
  rpe: number | null;
  warmup: boolean;
  supersetId: string | null;
  pr: PrKind | null;
}

export interface SavedWorkout {
  id: string;
  clientId: string;
  title: string | null;
  planSession: number | null;
  startedAt: string;
  endedAt: string;
  setCount: number;
  volumeKg: number;
  prCount: number;
  activityLog: { id: string; caloriesBurned: number | null; durationMin: number };
  sets: SavedSet[];
}

/** Last time, records and today's targets for the exercises about to be done. */
export function usePrepareWorkout(exercises: { exerciseId: string; detail?: string | null }[]) {
  const body = { exercises: exercises.map((e) => ({ exerciseId: e.exerciseId, ...(e.detail ? { detail: e.detail } : {}) })) };
  return useQuery<{ today: string; exercises: PreparedExercise[] }>({
    queryKey: ['workout-prepare', body],
    queryFn: () => api.post('/workouts/prepare', body).then((r) => r.data),
    enabled: exercises.length > 0,
    staleTime: 10 * 60_000,
    // Offline, use what was fetched before rather than waiting
    networkMode: 'offlineFirst',
    // Keep showing the targets while an added exercise loads
    placeholderData: keepPreviousData,
  });
}

export function useWorkout(id: string | null) {
  return useQuery<SavedWorkout>({
    queryKey: ['workouts', 'detail', id],
    queryFn: () => api.get(`/workouts/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useDeleteWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/workouts/${id}`).then((r) => r.data),
    onSuccess: () => {
      for (const key of ['workouts', 'activity-logs', 'activity-week', 'workout-history', 'feed', 'challenges']) {
        qc.invalidateQueries({ queryKey: [key] });
      }
    },
    meta: { errorMessage: "Couldn't delete the workout" },
  });
}

export interface ExerciseHistory {
  exercise: Pick<Exercise, 'id' | 'name' | 'equipment' | 'pattern' | 'primary' | 'imageUrl'>;
  records: Records;
  sessions: {
    sessionId: string;
    date: string;
    sets: (PastSet & { warmup: boolean; pr: PrKind | null })[];
    bestE1rm: number | null;
    topWeightKg: number | null;
    bestReps: number | null;
  }[];
}

export function useExerciseHistory(exerciseId: string | null) {
  return useQuery<ExerciseHistory>({
    queryKey: ['workout-history', exerciseId],
    queryFn: () => api.get(`/workouts/exercises/${encodeURIComponent(exerciseId!)}/history`).then((r) => r.data),
    enabled: !!exerciseId,
  });
}

export interface SpokenSet {
  exerciseId: string;
  exerciseName: string;
  reps: number;
  weightKg: number | null;
  durationSec: number | null;
}

/** "bench 80 for 8, 8, 7" → sets */
export function useParseSets() {
  return useMutation({
    mutationFn: (body: { text: string; exerciseIds: string[] }) =>
      api.post<{ sets: SpokenSet[]; source: 'rules' | 'ai' }>('/workouts/parse', body, { timeout: 45_000 }).then((r) => r.data),
  });
}

/** Exercises on the same movement, for swapping. */
export function useAlternatives(pattern: string | null, q = '') {
  const params = new URLSearchParams();
  if (pattern) params.set('pattern', pattern);
  if (q.trim()) params.set('q', q.trim());
  return useQuery<Exercise[]>({
    queryKey: ['exercises', 'pattern', pattern, q.trim()],
    queryFn: () => api.get(`/exercises?${params.toString()}`).then((r) => r.data),
    enabled: !!pattern || q.trim().length > 1,
    staleTime: 60 * 60_000,
  });
}

/** Logs a plan day done without sets (a run, a class), moving the plan on. */
export function useLogPlanSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { clientId: string; planSession: number; title: string; activityType: string; startedAt: string; endedAt: string }) =>
      api.post<SavedWorkout>('/workouts', { ...body, sets: [] }).then((r) => r.data),
    onSuccess: () => {
      for (const key of ['workout-plan', 'activity-logs', 'activity-week', 'feed', 'challenges']) qc.invalidateQueries({ queryKey: [key] });
    },
  });
}
