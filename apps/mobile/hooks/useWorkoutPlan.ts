import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_NAMES: Record<Weekday, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};

export interface PlanExercise {
  /** The exercise library's id, for plans built from the library */
  exerciseId?: string;
  name: string;
  detail: string;
}

export interface PlanDay {
  day: Weekday;
  rest: boolean;
  title: string;
  activityType: string;
  durationMin: number;
  exercises: PlanExercise[];
}

export interface WorkoutPlan {
  id: string;
  summary: string;
  daysPerWeek: number;
  location: 'home' | 'gym';
  days: PlanDay[];
  /** The training session (1, 2, 3…) that comes next; plans run in order */
  nextSession: number;
  updatedAt: string;
}

/** The plan's training days in order, as sessions 1, 2, 3… */
export function planSessions(plan: WorkoutPlan) {
  return plan.days.filter((d) => !d.rest).map((day, i) => ({ number: i + 1, day }));
}

/** The session that's next, whatever day it is. */
export function nextUp(plan: WorkoutPlan | null | undefined) {
  if (!plan) return null;
  const sessions = planSessions(plan);
  if (!sessions.length) return null;
  const n = Math.min(Math.max(plan.nextSession ?? 1, 1), sessions.length);
  return { ...sessions[n - 1], total: sessions.length };
}

/** Whether the session is set by set (it has library exercises) rather than a run or class. */
export function isLiftingDay(day: PlanDay) {
  return day.exercises.some((e) => e.exerciseId) && !['running', 'cycling', 'walking', 'swimming', 'hiking', 'rowing', 'elliptical'].includes(day.activityType);
}

/** Today's weekday key on the device's clock. */
export function todayWeekday(d: Date = new Date()): Weekday {
  return WEEKDAYS[(d.getDay() + 6) % 7];
}

/** The user's plan, or null before one has been built. */
export function useWorkoutPlan() {
  return useQuery<WorkoutPlan | null>({
    queryKey: ['workout-plan'],
    // An empty body means no plan yet
    queryFn: () => api.get('/workout-plan').then((r) => r.data || null),
  });
}

export function useGeneratePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: { daysPerWeek?: number; location?: 'home' | 'gym'; feedback?: string }) =>
      api.post<WorkoutPlan>('/workout-plan/generate', opts, { timeout: 90_000 }).then((r) => r.data),
    onSuccess: (plan) => qc.setQueryData(['workout-plan'], plan),
  });
}

export function useUpdatePlanDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ day, ...content }: PlanDay) =>
      api.put<WorkoutPlan>(`/workout-plan/days/${day}`, content).then((r) => r.data),
    onSuccess: (plan) => qc.setQueryData(['workout-plan'], plan),
  });
}
