import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { localDateStr } from '@/lib/date';

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  isPreset: boolean;
  presetKey: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface PresetHabit {
  key: string;
  name: string;
  emoji: string;
}

export interface StreakDay {
  date: string;
  completed: boolean;
}

export interface HabitStreak {
  habit: Habit;
  streakCount: number;
  grid: StreakDay[];
}

export function useHabits() {
  return useQuery<Habit[]>({
    queryKey: ['habits'],
    queryFn: () => api.get('/habits').then((r) => r.data),
  });
}

export function useHabitPresets() {
  return useQuery<PresetHabit[]>({
    queryKey: ['habit-presets'],
    queryFn: () => api.get('/habits/presets').then((r) => r.data),
    staleTime: Infinity,
  });
}

export interface HabitStreakSummary {
  habitId: string;
  streakCount: number;
  completedToday: boolean;
  /** Last 30 days, oldest first */
  grid: StreakDay[];
}

interface StreaksResponse {
  streaks: HabitStreakSummary[];
  todayDone: number;
  maxStreak: number;
}

const STREAKS_KEY = ['habit-streaks'];

/** Streaks for every active habit, from one request. */
export function useHabitStreaks() {
  return useQuery<StreaksResponse>({
    queryKey: STREAKS_KEY,
    queryFn: () => api.get('/habits/streaks').then((r) => r.data),
  });
}

/** One habit's streak and 30-day grid, from the shared streaks query. */
export function useHabitStreak(habitId: string) {
  const query = useHabitStreaks();
  return { ...query, data: query.data?.streaks.find((s) => s.habitId === habitId) };
}

export function useCreateHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; emoji?: string; presetKey?: string }) =>
      api.post('/habits', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['habits'] });
      qc.invalidateQueries({ queryKey: STREAKS_KEY });
    },
  });
}

export function useDeleteHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/habits/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['habits'] });
      qc.invalidateQueries({ queryKey: STREAKS_KEY });
    },
  });
}

/** Marks one day's grid cell, keeping today's flag and counts in step. */
function setDay(data: StreaksResponse, habitId: string, date: string, completed: boolean): StreaksResponse {
  const today = localDateStr();
  const streaks = data.streaks.map((s) =>
    s.habitId !== habitId
      ? s
      : {
          ...s,
          grid: s.grid.map((d) => (d.date === date ? { ...d, completed } : d)),
          completedToday: date === today ? completed : s.completedToday,
        },
  );
  return { ...data, streaks, todayDone: streaks.filter((s) => s.completedToday).length };
}

/**
 * Checks a habit off (or clears it) for today or an earlier day. The screen
 * updates straight away; the streak count follows from the server, and a
 * failed request puts things back.
 */
function useSetHabitDay(completed: boolean) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ habitId, date }: { habitId: string; date?: string }) => {
      const query = date ? `?date=${date}` : '';
      return completed
        ? api.post(`/habits/${habitId}/log${query}`).then((r) => r.data)
        : api.delete(`/habits/${habitId}/log${query}`).then((r) => r.data);
    },
    onMutate: async ({ habitId, date }) => {
      await qc.cancelQueries({ queryKey: STREAKS_KEY });
      const previous = qc.getQueryData<StreaksResponse>(STREAKS_KEY);
      if (previous) qc.setQueryData(STREAKS_KEY, setDay(previous, habitId, date ?? localDateStr(), completed));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(STREAKS_KEY, context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: STREAKS_KEY }),
  });
}

export function useLogHabit() {
  return useSetHabitDay(true);
}

export function useUnlogHabit() {
  return useSetHabitDay(false);
}

export function useUpdateHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; emoji?: string }) =>
      api.put(`/habits/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['habits'] }),
  });
}

export interface HabitSummary {
  /** IDs of habits completed today */
  todayDone: Set<string>;
  /** Longest current streak across all habits */
  maxStreak: number;
  /** Last 30 days, oldest first, with how many habits were completed */
  days: { date: string; completed: number }[];
}

/** Totals across every habit, shared by Home, Habits, Profile and Stats. */
export function useHabitSummary() {
  const query = useHabitStreaks();
  const streaks = query.data?.streaks ?? [];
  const data: HabitSummary | undefined = query.data && {
    todayDone: new Set(streaks.filter((s) => s.completedToday).map((s) => s.habitId)),
    maxStreak: query.data.maxStreak,
    days: (streaks[0]?.grid ?? []).map((d, i) => ({
      date: d.date,
      completed: streaks.filter((s) => s.grid[i]?.completed).length,
    })),
  };
  return { ...query, data };
}
