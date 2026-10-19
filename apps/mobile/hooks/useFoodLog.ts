import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface FoodLog {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  mealType: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  servingQty: number;
  servingUnit: string;
  loggedAt: string;
}

export interface MacroTotals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** The day's calorie budget: the goal plus earnback and rollover, if enabled. */
export interface CalorieBudget {
  goal: number;
  earnback: number;
  rollover: number;
  total: number;
}

export interface MacroTargets {
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface NormalizedFood {
  offId: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  servingQty: number;
  servingUnit: string;
  imageUrl: string | null;
}

export function useFoodLogsForDate(date: string) {
  return useQuery<DayLog>({
    queryKey: ['food-logs', date],
    queryFn: () => api.get(`/food-logs?date=${date}`).then((r) => r.data),
  });
}

export interface FoodWeekDay extends MacroTotals {
  date: string;
  entries: number;
}

/** Calories and macros per day for the week containing `date` (default: this week). */
export function useFoodWeek(date?: string) {
  return useQuery<{ weekStart: string; weekEnd: string; days: FoodWeekDay[] }>({
    queryKey: ['food-week', date ?? 'current'],
    queryFn: () => api.get('/food-logs/week', { params: { date } }).then((r) => r.data),
  });
}

export function useFoodSearch(query: string) {
  return useQuery<NormalizedFood[]>({
    queryKey: ['food-search', query],
    queryFn: () =>
      api.get(`/food/search?q=${encodeURIComponent(query)}`).then((r) => r.data),
    enabled: query.length >= 2,
    staleTime: 1000 * 60 * 5,
  });
}

export function useFoodBarcode(barcode: string | null) {
  return useQuery<NormalizedFood>({
    queryKey: ['food-barcode', barcode],
    queryFn: () => api.get(`/food/barcode/${barcode}`).then((r) => r.data),
    enabled: !!barcode,
    retry: 1,
  });
}

export function useLogFood() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      brand?: string;
      barcode?: string;
      mealType: string;
      calories: number;
      proteinG?: number;
      carbsG?: number;
      fatG?: number;
      servingQty?: number;
      servingUnit?: string;
      /** For back-filling an earlier day; omitted for now */
      loggedAt?: string;
    }) => api.post('/food-logs', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['food-logs'] });
      qc.invalidateQueries({ queryKey: ['food-week'] });
    },
  });
}

type DayLog = { logs: FoodLog[]; totals: MacroTotals; budget: CalorieBudget; targets: MacroTargets };

/** Removes the entry from the screen straight away, putting it back if the request fails. */
export function useDeleteFoodLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/food-logs/${id}`).then((r) => r.data),
    meta: { errorMessage: "Couldn't delete that entry. Check your connection." },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['food-logs'] });
      const previous = qc.getQueriesData<DayLog>({ queryKey: ['food-logs'] });
      for (const [key, day] of previous) {
        const removed = day?.logs.find((l) => l.id === id);
        if (!day || !removed) continue;
        qc.setQueryData<DayLog>(key, {
          ...day,
          logs: day.logs.filter((l) => l.id !== id),
          totals: {
            calories: day.totals.calories - removed.calories,
            proteinG: day.totals.proteinG - removed.proteinG,
            carbsG: day.totals.carbsG - removed.carbsG,
            fatG: day.totals.fatG - removed.fatG,
          },
        });
      }
      return { previous };
    },
    onError: (_err, _id, context) => {
      for (const [key, day] of context?.previous ?? []) qc.setQueryData(key, day);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['food-logs'] });
      qc.invalidateQueries({ queryKey: ['food-week'] });
    },
  });
}

export type FoodLogUpdate = Partial<Pick<FoodLog, 'name' | 'mealType' | 'calories' | 'proteinG' | 'carbsG' | 'fatG' | 'servingQty' | 'servingUnit'>>;

export function useUpdateFoodLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: FoodLogUpdate & { id: string }) =>
      api.patch<FoodLog>(`/food-logs/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['food-logs'] });
      qc.invalidateQueries({ queryKey: ['food-week'] });
    },
  });
}
