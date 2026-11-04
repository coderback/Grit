import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { QuickFood } from '@/lib/quickFoods';

export type { QuickFood } from '@/lib/quickFoods';
export { foodKey, portionAsFood, portionLabel } from '@/lib/quickFoods';

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
