import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';

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
  const qc = useQueryClient();

  const query = useQuery<Challenge>({
    queryKey: ['challenge', id],
    queryFn: () => api.get(`/challenges/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  // Supabase Realtime — revalidate when any participant row changes
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`challenge:${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'challenge_participants',
          filter: `challenge_id=eq.${id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['challenge', id] });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, qc]);

  return query;
}

export function useCreateChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; goalValue: number; durationDays: number }) =>
      api.post('/challenges', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['challenges'] }),
  });
}

export function useJoinChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteCode: string) =>
      api.post(`/challenges/join/${inviteCode}`).then((r) => r.data),
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
