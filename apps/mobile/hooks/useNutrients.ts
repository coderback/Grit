import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { NutrientDay, NutrientWeek } from '@/lib/nutrients';

export type { DayNutrient, NutrientDay, NutrientWeek, OftenLowNutrient } from '@/lib/nutrients';

/** Vitamins, minerals, fibre, sodium and saturated fat for a day (YYYY-MM-DD), against targets. */
export function useNutrientsDay(date: string) {
  return useQuery<NutrientDay>({
    queryKey: ['nutrients-day', date],
    queryFn: () => api.get('/nutrients/day', { params: { date } }).then((r) => r.data),
  });
}

/** Nutrients that were low on most judged days of the week containing `date` (default: this week). */
export function useNutrientsWeek(date?: string) {
  return useQuery<NutrientWeek>({
    queryKey: ['nutrients-week', date ?? 'current'],
    queryFn: () => api.get('/nutrients/week', { params: { date } }).then((r) => r.data),
  });
}
