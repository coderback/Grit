import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ChallengeParticipant {
  id: string;
  userId: string;
  currentValue: number;
  user: { id: string; displayName: string; avatarUrl: string | null; username: string };
}

export type ChallengeType = 'steps' | 'active_minutes' | 'workouts';

export interface Challenge {
  id: string;
  title: string;
  type: ChallengeType | 'group_steps';
  goalValue: number;
  durationDays: number;
  startDate: string;
  endDate: string;
  inviteCode: string;
  /** The group reached the goal; the challenge may still be running */
  isComplete: boolean;
  /** Set once the end date passed and results went out */
  endedAt: string | null;
  createdAt: string;
  /** Only on the detail endpoint */
  isCreator?: boolean;
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
    mutationFn: (data: { title: string; type: ChallengeType; goalValue: number; durationDays: number }): Promise<Challenge> =>
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

export function useLeaveChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (challengeId: string) => api.delete(`/challenges/${challengeId}/participants/me`).then((r) => r.data),
    meta: { errorMessage: "Couldn't leave the challenge. Check your connection." },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['challenges'] }),
  });
}

/** Creator only; removes it for everyone. */
export function useDeleteChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (challengeId: string) => api.delete(`/challenges/${challengeId}`).then((r) => r.data),
    meta: { errorMessage: "Couldn't delete the challenge. Check your connection." },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['challenges'] }),
  });
}
