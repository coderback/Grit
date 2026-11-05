import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type ItemSource = 'memory' | 'database' | 'estimate';

export interface Per100 {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface ParsedItem {
  name: string;
  brand: string | null;
  portion: string;
  grams: number;
  per100: Per100;
  source: ItemSource;
  confidence: 'high' | 'medium' | 'low';
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface ParsedMeal {
  items: ParsedItem[];
  total: { calories: number; proteinG: number; carbsG: number; fatG: number };
  question: string | null;
}

export interface FoodMemory {
  id: string;
  name: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  usualGrams: number;
  uses: number;
}

/** Reads a described or photographed meal into items. Nothing is logged yet. */
export function useParseMeal() {
  return useMutation({
    mutationFn: (body: { text?: string; imageBase64?: string; imageType?: string }) =>
      api.post<ParsedMeal>('/food/parse', body, { timeout: 90_000 }).then((r) => r.data),
  });
}

export function useLogParsedMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      mealType: string;
      loggedAt?: string;
      items: {
        name: string;
        brand?: string;
        grams: number;
        kcalPer100g: number;
        proteinPer100g: number;
        carbsPer100g: number;
        fatPer100g: number;
        remember?: boolean;
      }[];
    }) => api.post<{ logged: number }>('/food/parse/log', body).then((r) => r.data),
    onSuccess: () => {
      for (const key of ['food-logs', 'food-recent', 'food-week', 'trends', 'adaptive', 'food-memories']) {
        qc.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

export function useFoodMemories() {
  return useQuery<FoodMemory[]>({
    queryKey: ['food-memories'],
    queryFn: () => api.get('/food/memories').then((r) => r.data),
  });
}

export function useForgetFood() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/food/memories/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['food-memories'] }),
  });
}
