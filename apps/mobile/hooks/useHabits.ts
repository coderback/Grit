import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

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
      // Also invalidate the today-completed set used in the tab
      qc.invalidateQueries({ queryKey: ['habits-today'] });
    },
  });
}

export function useMaxHabitStreak(habits: Habit[]) {
  return useQuery<number>({
    queryKey: ['habits-max-streak', habits.map((h) => h.id).join(',')],
    queryFn: async () => {
      const results = await Promise.all(
        habits.map((h) => api.get<HabitStreak>(`/habits/${h.id}/streak`).then((r) => r.data.streakCount)),
      );
      return results.length > 0 ? Math.max(...results) : 0;
    },
    enabled: habits.length > 0,
  });
}

/** Returns the set of habit IDs completed today */
export function useTodayCompletions(habits: Habit[]) {
  return useQuery<Set<string>>({
    queryKey: ['habits-today', habits.map((h) => h.id).join(',')],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const results = await Promise.all(
        habits.map((h) =>
          api
            .get<HabitStreak>(`/habits/${h.id}/streak`)
            .then((r) => ({
              id: h.id,
              doneToday: r.data.grid.at(-1)?.completed ?? false,
            })),
        ),
      );
      return new Set(results.filter((r) => r.doneToday).map((r) => r.id));
    },
    enabled: habits.length > 0,
  });
}
