import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { deleteFoodFromHealth, updateFoodInHealth, writeFoodsToHealth } from '@/lib/health/sync';
import { deviceLocale } from '@/lib/searchEvents';
import type { NutrientCode } from '@/lib/nutrients';

/** Everything a logged, edited or removed food entry changes. */
const FOOD_LOG_QUERIES = ['food-logs', 'food-recent', 'food-week', 'trends', 'adaptive', 'nutrients-day', 'nutrients-week'];

export function invalidateFoodLogQueries(qc: ReturnType<typeof useQueryClient>) {
  for (const key of FOOD_LOG_QUERIES) qc.invalidateQueries({ queryKey: [key] });
}

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
  caffeineMg: number | null;
  alcoholG: number | null;
  /** The database food it came from (Phase 7) */
  foodId?: string | null;
  /** Grams eaten, when known */
  grams?: number | null;
}

export interface MacroTotals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  caffeineMg?: number;
  alcoholG?: number;
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

/** A named serving of a database food. `label` has no grams in it: "1 slice". */
export interface FoodServing {
  label: string;
  grams: number;
  /** The usual serving, which the app starts on */
  typical: boolean;
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
  /** A saved portion (recent or favourite): amounts are for the whole portion */
  portion?: boolean;
  /** Caffeine, mg per 100 g (or for the whole portion) */
  caffeineMg?: number;
  /** Alcohol, g per 100 g (or for the whole portion) */
  alcoholG?: number;
  /** A food from GRIT's database (absent on live Open Food Facts results) */
  foodId?: string;
  kind?: 'generic' | 'branded' | 'dish' | 'user';
  /** fdc, off, cofid, cnf, ciqual, fineli or memory */
  source?: string;
  /** From a government table or the manufacturer's own data */
  verified?: boolean;
  basis?: 'measured' | 'label';
  servings?: FoodServing[];
  /** Per 100 g; only from a barcode or item lookup, not from search */
  nutrients?: Partial<Record<NutrientCode, number>>;
  /** The user has logged it, or Smart log remembers it */
  mine?: boolean;
  /** App only: the grams in one saved portion, when known */
  portionGrams?: number;
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

/** The server answers from 3 characters; shorter queries aren't sent. */
export const MIN_SEARCH_LENGTH = 3;

/** Food search, ranked for the phone's country and language. */
export function useFoodSearch(query: string) {
  const q = query.trim();
  const { country, lang } = deviceLocale();
  return useQuery<NormalizedFood[]>({
    queryKey: ['food-search', q, country ?? '', lang ?? ''],
    queryFn: () => api.get('/food/search', { params: { q, country, lang } }).then((r) => r.data),
    enabled: q.length >= MIN_SEARCH_LENGTH,
    staleTime: 1000 * 60 * 5,
  });
}

export function useFoodBarcode(barcode: string | null) {
  const { country } = deviceLocale();
  return useQuery<NormalizedFood>({
    queryKey: ['food-barcode', barcode, country ?? ''],
    queryFn: () =>
      api.get(`/food/barcode/${encodeURIComponent(barcode ?? '')}`, { params: { country } }).then((r) => r.data),
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
      caffeineMg?: number;
      alcoholG?: number;
      /** The database food it came from */
      foodId?: string;
      /** Grams eaten (with foodId, the server saves the amount's nutrients) */
      grams?: number;
      /** For back-filling an earlier day; omitted for now */
      loggedAt?: string;
    }) => api.post('/food-logs', data).then((r) => r.data),
    onSuccess: (log) => {
      // To Apple Health / Health Connect, if the user turned that on
      writeFoodsToHealth([log]);
      invalidateFoodLogQueries(qc);
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
    onSuccess: (_res, id) => {
      deleteFoodFromHealth(id);
    },
    onSettled: () => {
      invalidateFoodLogQueries(qc);
    },
  });
}

export type FoodLogUpdate = Partial<Pick<FoodLog, 'name' | 'mealType' | 'calories' | 'proteinG' | 'carbsG' | 'fatG' | 'servingQty' | 'servingUnit'>>;

export function useUpdateFoodLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: FoodLogUpdate & { id: string }) =>
      api.patch<FoodLog>(`/food-logs/${id}`, data).then((r) => r.data),
    onSuccess: (log) => {
      updateFoodInHealth(log);
      invalidateFoodLogQueries(qc);
    },
  });
}
