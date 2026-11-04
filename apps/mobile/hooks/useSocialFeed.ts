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

export type FollowState = 'none' | 'pending' | 'accepted';

export interface Relationship {
  /** Your follow of them */
  following: FollowState;
  /** Their follow of you */
  followsYou: FollowState;
  /** You've blocked them */
  blocked: boolean;
}

/** Someone in search results or a followers list. */
export interface PersonRow extends FeedUser {
  isMe: boolean;
  relationship: Relationship;
}

export interface PublicProfile extends FeedUser {
  primaryGoal: string;
  createdAt: string;
  isPrivate: boolean;
  isMe: boolean;
  _count: { following: number; followers: number };
  /** Null on your own profile */
  relationship: Relationship | null;
  /** Whether you may see their activity: public, or you're an approved follower */
  canView: boolean;
  week: { activeMinutes: number; workouts: number } | null;
  recent: FeedItem[];
}

export interface FollowRequest {
  createdAt: string;
  user: FeedUser;
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

export function useSearchUsers(query: string) {
  const q = query.trim();
  return useQuery<PersonRow[]>({
    queryKey: ['search-users', q],
    queryFn: () => api.get('/search/users', { params: { q } }).then((r) => r.data),
    enabled: q.replace(/^@/, '').length >= 2,
    staleTime: 30_000,
  });
}

/** Approved followers or followings of a user (`me` for your own). */
export function useConnections(userId: string, which: 'followers' | 'following', enabled = true) {
  return useQuery<PersonRow[]>({
    queryKey: ['connections', userId, which],
    queryFn: () => api.get(`/users/${userId}/${which}`).then((r) => r.data),
    enabled: !!userId && enabled,
  });
}

export function useFollowRequests() {
  return useQuery<FollowRequest[]>({
    queryKey: ['follow-requests'],
    queryFn: () => api.get('/follow-requests').then((r) => r.data),
  });
}

export function useBlocked() {
  return useQuery<FollowRequest[]>({
    queryKey: ['blocked'],
    queryFn: () => api.get('/blocks').then((r) => r.data),
  });
}

/** Everything a change in who follows whom can affect. */
function invalidateSocial(qc: ReturnType<typeof useQueryClient>) {
  for (const key of ['profile', 'search-users', 'connections', 'follow-requests', 'blocked', 'feed', 'leaderboard-weekly', 'notifications']) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}

function socialMutation<T>(fn: (userId: string) => Promise<T>, errorMessage: string) {
  return () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: fn,
      meta: { errorMessage },
      onSuccess: () => invalidateSocial(qc),
    });
  };
}

/** Resolves to `accepted`, or `pending` when the account is private. */
export const useFollow = socialMutation<{ status: 'pending' | 'accepted' }>(
  (userId) => api.post(`/follow/${userId}`).then((r) => r.data),
  "Couldn't follow. Check your connection.",
);
/** Unfollows, or withdraws a pending request. */
export const useUnfollow = socialMutation(
  (userId) => api.delete(`/follow/${userId}`).then((r) => r.data),
  "Couldn't unfollow. Check your connection.",
);
export const useAcceptRequest = socialMutation(
  (userId) => api.post(`/follow-requests/${userId}/accept`).then((r) => r.data),
  "Couldn't accept the request. Check your connection.",
);
export const useDeclineRequest = socialMutation(
  (userId) => api.delete(`/follow-requests/${userId}`).then((r) => r.data),
  "Couldn't decline the request. Check your connection.",
);
export const useRemoveFollower = socialMutation(
  (userId) => api.delete(`/followers/${userId}`).then((r) => r.data),
  "Couldn't remove that follower. Check your connection.",
);
export const useBlock = socialMutation(
  (userId) => api.post(`/blocks/${userId}`).then((r) => r.data),
  "Couldn't block. Check your connection.",
);
export const useUnblock = socialMutation(
  (userId) => api.delete(`/blocks/${userId}`).then((r) => r.data),
  "Couldn't unblock. Check your connection.",
);
