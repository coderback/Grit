import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** The signed-in user's own profile row from the backend. */
export interface Me {
  id: string; // backend user ID, not the Supabase auth ID
  username: string;
  displayName: string;
  calorieGoal: number;
  weightKg: number | null;
  primaryGoal: string | null;
}

export function useMe() {
  return useQuery<Me>({
    queryKey: ['me'],
    queryFn: () => api.get('/users/me').then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });
}
