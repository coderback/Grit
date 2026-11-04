import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_NAMES: Record<Weekday, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};

export interface PlanExercise {
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
  updatedAt: string;
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
