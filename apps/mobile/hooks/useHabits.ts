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

export function useHabitStreak(habitId: string) {
  return useQuery<HabitStreak>({
    queryKey: ['habit-streak', habitId],
    queryFn: () => api.get(`/habits/${habitId}/streak`).then((r) => r.data),
  });
}

export function useCreateHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; emoji?: string; presetKey?: string }) =>
      api.post('/habits', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['habits'] }),
  });
}

export function useDeleteHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/habits/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['habits'] }),
  });
}

export function useLogHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (habitId: string) =>
      api.post(`/habits/${habitId}/log`).then((r) => r.data),
    onSuccess: (_data, habitId) => {
      qc.invalidateQueries({ queryKey: ['habit-streak', habitId] });
      qc.invalidateQueries({ queryKey: ['habit-summary'] });
    },
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

/** One pass over every habit's streak, shared by Home, Habits, Profile and Stats. */
export function useHabitSummary(habits: Habit[]) {
  return useQuery<HabitSummary>({
    queryKey: ['habit-summary', habits.map((h) => h.id).join(',')],
    queryFn: async () => {
      const streaks = await Promise.all(
        habits.map((h) => api.get<HabitStreak>(`/habits/${h.id}/streak`).then((r) => r.data)),
      );
      const todayDone = new Set(
        streaks.filter((s) => s.grid.at(-1)?.completed).map((s) => s.habit.id),
      );
      const maxStreak = streaks.reduce((m, s) => Math.max(m, s.streakCount), 0);
      const days = (streaks[0]?.grid ?? []).map((d, i) => ({
        date: d.date,
        completed: streaks.filter((s) => s.grid[i]?.completed).length,
      }));
      return { todayDone, maxStreak, days };
    },
    enabled: habits.length > 0,
  });
}
