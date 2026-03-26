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
  return useQuery<{ logs: FoodLog[]; totals: MacroTotals }>({
    queryKey: ['food-logs', date],
    queryFn: () => api.get(`/food-logs?date=${date}`).then((r) => r.data),
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
    }) => api.post('/food-logs', data).then((r) => r.data),
    onSuccess: () => {
      const today = new Date().toISOString().split('T')[0];
      qc.invalidateQueries({ queryKey: ['food-logs', today] });
    },
  });
}

export function useDeleteFoodLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/food-logs/${id}`).then((r) => r.data),
    onSuccess: () => {
      const today = new Date().toISOString().split('T')[0];
      qc.invalidateQueries({ queryKey: ['food-logs', today] });
    },
  });
}
