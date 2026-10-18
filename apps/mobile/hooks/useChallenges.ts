import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ChallengeParticipant {
  id: string;
  userId: string;
  currentValue: number;
  user: { id: string; displayName: string; avatarUrl: string | null; username: string };
}

export interface Challenge {
  id: string;
  title: string;
  type: string;
  goalValue: number;
  durationDays: number;
  startDate: string;
  endDate: string;
  inviteCode: string;
  isComplete: boolean;
  createdAt: string;
  totalProgress?: number;
  participants: ChallengeParticipant[];
}

export function useChallenges() {
  return useQuery<Challenge[]>({
    queryKey: ['challenges'],
    queryFn: () => api.get('/challenges').then((r) => r.data),
  });
}

export function useChallenge(id: string) {
  return useQuery<Challenge>({
    queryKey: ['challenge', id],
    queryFn: () => api.get(`/challenges/${id}`).then((r) => r.data),
    enabled: !!id,
    // Keeps the leaderboard current while the screen is open. Supabase
    // Realtime can't be used: the tables are behind row level security and
    // only the API reads them.
    refetchInterval: 15_000,
  });
}

export function useCreateChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; goalValue: number; durationDays: number }): Promise<Challenge> =>
      api.post('/challenges', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['challenges'] }),
  });
}

export function useJoinChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteCode: string): Promise<{ challengeId: string }> =>
      api.post(`/challenges/join/${encodeURIComponent(inviteCode)}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['challenges'] }),
  });
}

export function useUpdateChallengeProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ challengeId, steps }: { challengeId: string; steps: number }) =>
      api.put(`/challenges/${challengeId}/progress`, { steps }).then((r) => r.data),
    onSuccess: (_data, { challengeId }) => {
      qc.invalidateQueries({ queryKey: ['challenge', challengeId] });
      qc.invalidateQueries({ queryKey: ['challenges'] });
    },
  });
}
