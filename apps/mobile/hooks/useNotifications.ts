import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { FeedUser } from '@/hooks/useSocialFeed';

export type NotificationType =
  | 'follow'
  | 'follow_request'
  | 'follow_accepted'
  | 'kudos'
  | 'challenge_joined'
  | 'challenge_ended'
  | 'streak_at_risk'
  | 'weekly_progress';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: { userId?: string; challengeId?: string; activityLogId?: string; screen?: string };
  readAt: string | null;
  createdAt: string;
  actor: FeedUser | null;
}

interface Page {
  items: AppNotification[];
  unread: number;
}

/** The inbox, newest first, 50 at a time. */
export function useNotifications() {
  return useInfiniteQuery<Page>({
    queryKey: ['notifications'],
    queryFn: ({ pageParam }) =>
      api.get('/notifications', { params: { before: pageParam || undefined } }).then((r) => r.data),
    initialPageParam: '',
    getNextPageParam: (last) => (last.items.length === 50 ? last.items[last.items.length - 1].id : undefined),
  });
}

/** For the bell badge; checks again every minute while the app is open. */
export function useUnreadCount(enabled = true) {
  return useQuery<{ unread: number }>({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api.get('/notifications/unread-count').then((r) => r.data),
    refetchInterval: 60_000,
    enabled,
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/notifications/read', {}).then((r) => r.data),
    onSuccess: () => {
      qc.setQueryData(['notifications', 'unread'], { unread: 0 });
    },
  });
}
