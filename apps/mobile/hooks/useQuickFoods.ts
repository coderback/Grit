import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { NormalizedFood } from '@/hooks/useFoodLog';

/** A saved portion: the amounts are for the whole portion, not per 100 g. */
export interface QuickFood {
  name: string;
  brand: string | null;
  barcode: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  servingQty: number;
  servingUnit: string;
}

export interface RecentFood extends QuickFood {
  key: string;
  timesLogged: number;
  lastMealType: string;
  favoriteId: string | null;
}

export interface FavoriteFood extends QuickFood {
  id: string;
  key: string;
}

/** Matches the server's: same name and brand, ignoring case and spacing. */
export function foodKey(name: string, brand?: string | null) {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  return `${norm(name)}|${norm(brand ?? '')}`;
}

/** A saved portion in the shape the log sheet takes. */
export function portionAsFood(f: QuickFood): NormalizedFood {
  return {
    offId: '',
    portion: true,
    name: f.name,
    brand: f.brand,
    barcode: f.barcode,
    calories: f.calories,
    proteinG: f.proteinG,
    carbsG: f.carbsG,
    fatG: f.fatG,
    servingQty: f.servingQty,
    servingUnit: f.servingUnit,
    imageUrl: null,
  };
}

/** "150 g" or "2 servings" */
export function portionLabel(f: Pick<QuickFood, 'servingQty' | 'servingUnit'>) {
  const qty = Math.round(f.servingQty * 10) / 10;
  return f.servingUnit === 'serving' ? `${qty} ${qty === 1 ? 'serving' : 'servings'}` : `${qty} ${f.servingUnit}`;
}

export function useRecentFoods() {
  return useQuery<RecentFood[]>({
    queryKey: ['food-recent'],
    queryFn: () => api.get('/food/recent').then((r) => r.data),
  });
}

export function useFavoriteFoods() {
  return useQuery<FavoriteFood[]>({
    queryKey: ['food-favorites'],
    queryFn: () => api.get('/food/favorites').then((r) => r.data),
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['food-favorites'] });
  qc.invalidateQueries({ queryKey: ['food-recent'] });
}

export function useSaveFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (f: QuickFood) =>
      api.post<FavoriteFood>('/food/favorites', {
        ...f,
        brand: f.brand ?? undefined,
        barcode: f.barcode ?? undefined,
      }).then((r) => r.data),
    meta: { errorMessage: "Couldn't save that favourite. Check your connection." },
    onSuccess: () => invalidate(qc),
  });
}

export function useRemoveFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/food/favorites/${id}`).then((r) => r.data),
    meta: { errorMessage: "Couldn't remove that favourite. Check your connection." },
    onSuccess: () => invalidate(qc),
  });
}
