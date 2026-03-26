import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type FeedItemType = 'food_log' | 'activity_log' | 'habit_log';

export interface FeedUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  username: string;
}

export interface FeedItem {
  id: string;
  type: FeedItemType;
  loggedAt: string;
  user: FeedUser;
  data: Record<string, unknown>;
}

export interface LeaderboardEntry {
  user: FeedUser;
  activeMinutes: number;
  steps: number;
  isMe: boolean;
}

export interface PublicProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  primaryGoal: string;
  createdAt: string;
  _count: { following: number; followers: number };
}

export function useFeed() {
  return useQuery<FeedItem[]>({
    queryKey: ['feed'],
    queryFn: () => api.get('/feed').then((r) => r.data),
  });
}

export function useWeeklyLeaderboard() {
  return useQuery<LeaderboardEntry[]>({
    queryKey: ['leaderboard-weekly'],
    queryFn: () => api.get('/leaderboard/weekly').then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });
}

export function usePublicProfile(userId: string) {
  return useQuery<PublicProfile>({
    queryKey: ['profile', userId],
    queryFn: () => api.get(`/users/${userId}/profile`).then((r) => r.data),
    enabled: !!userId,
  });
}

export function useFollowing() {
  return useQuery({
    queryKey: ['following'],
    queryFn: () => api.get('/users/me/following').then((r) => r.data),
  });
}

export function useFollow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.post(`/follow/${userId}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['following'] });
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['leaderboard-weekly'] });
    },
  });
}

export function useUnfollow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.delete(`/follow/${userId}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['following'] });
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['leaderboard-weekly'] });
    },
  });
}
