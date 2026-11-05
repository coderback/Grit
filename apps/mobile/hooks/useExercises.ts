import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Exercise {
  id: string;
  name: string;
  primary: string[];
  secondary: string[];
  equipment: string[];
  mechanics: string | null;
  level: string | null;
  category: string | null;
  pattern: string | null;
  stresses: string[];
  instructions: string | null;
  imageUrl: string | null;
}

export function useExerciseSearch(q: string, filters: { muscle?: string; equipment?: string } = {}) {
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  if (filters.muscle) params.set('muscle', filters.muscle);
  if (filters.equipment) params.set('equipment', filters.equipment);
  return useQuery<Exercise[]>({
    queryKey: ['exercises', q.trim(), filters.muscle ?? '', filters.equipment ?? ''],
    queryFn: () => api.get(`/exercises?${params.toString()}`).then((r) => r.data),
    staleTime: 1000 * 60 * 60,
  });
}

export function useExercise(id: string | null) {
  return useQuery<Exercise>({
    queryKey: ['exercise', id],
    queryFn: () => api.get(`/exercises/${encodeURIComponent(id!)}`).then((r) => r.data),
    enabled: !!id,
    staleTime: 1000 * 60 * 60,
  });
}
