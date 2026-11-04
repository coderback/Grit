import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { ScreenHeader } from '@/components/settings/SettingsUI';
import { Avatar } from '@/components/ui/Avatar';
import { ErrorNotice } from '@/components/ui/QueryStatus';
import { useMarkAllRead, useNotifications, type AppNotification } from '@/hooks/useNotifications';
import { useAcceptRequest, useDeclineRequest } from '@/hooks/useSocialFeed';
import { notificationRoute } from '@/lib/notificationRoute';

const ICONS: Record<string, string> = {
  challenge_ended: '🏁',
  challenge_joined: '🏆',
  streak_at_risk: '🔥',
  weekly_progress: '📊',
  coach_checkin: '🤖',
  kudos: '👏',
};

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return days < 7 ? `${days}d` : new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function Row({ n, unread }: { n: AppNotification; unread: boolean }) {
  const { mutate: accept, isPending: accepting } = useAcceptRequest();
  const { mutate: decline, isPending: declining } = useDeclineRequest();
  const isRequest = n.type === 'follow_request' && !!n.actor;

  return (
    <Pressable
      onPress={() => router.push(notificationRoute(n.type, n.data))}
      accessibilityRole="button"
      accessibilityLabel={`${n.title}. ${n.body}`}
      style={({ pressed }) => ({
        flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16,
        backgroundColor: unread ? `${Colors.orange}12` : Colors.surface,
        borderWidth: 1, borderColor: unread ? `${Colors.orange}40` : Colors.border,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {n.actor ? (
        <Avatar name={n.actor.displayName} url={n.actor.avatarUrl} size={40} />
      ) : (
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 18 }}>{ICONS[n.type] ?? '🔔'}</Text>
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Text style={{ flex: 1, color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 14 }}>{n.title}</Text>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12 }}>{timeAgo(n.createdAt)}</Text>
        </View>
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13, lineHeight: 18 }}>{n.body}</Text>
        {isRequest && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Pressable
              onPress={() => accept(n.actor!.id)}
              disabled={accepting}
              accessibilityRole="button"
              style={{ backgroundColor: Colors.orange, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7, opacity: accepting ? 0.5 : 1 }}
            >
              <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 13 }}>Accept</Text>
            </Pressable>
            <Pressable
              onPress={() => decline(n.actor!.id)}
              disabled={declining}
              accessibilityRole="button"
              style={{ backgroundColor: Colors.surface2, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7, borderWidth: 1, borderColor: Colors.border, opacity: declining ? 0.5 : 1 }}
            >
              <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 13 }}>Decline</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Pressable>
  );
}

/** Follows, requests, kudos, challenge results and progress alerts. */
export default function NotificationsScreen() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage, isRefetching } = useNotifications();
  const { mutate: markAllRead } = useMarkAllRead();
  const items = data?.pages.flatMap((p) => p.items) ?? [];

  // What was unread when the screen opened stays highlighted while it's open
  const unreadOnOpen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!data || unreadOnOpen.current) return;
    unreadOnOpen.current = new Set(items.filter((n) => !n.readAt).map((n) => n.id));
    if (unreadOnOpen.current.size > 0) markAllRead();
  }, [data]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}>
      <ScreenHeader title="Notifications" />
      {isLoading ? (
        <ActivityIndicator color={Colors.orange} style={{ marginTop: 40 }} />
      ) : isError ? (
        <View style={{ padding: 20 }}>
          <ErrorNotice what="your notifications" onRetry={() => refetch()} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 60 }}
          renderItem={({ item }) => <Row n={item} unread={!!unreadOnOpen.current?.has(item.id)} />}
          onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching && !isFetchingNextPage}
              onRefresh={() => { qc.invalidateQueries({ queryKey: ['notifications'] }); }}
              tintColor={Colors.orange}
            />
          }
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={Colors.orange} /> : null}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', gap: 10, paddingVertical: 48 }}>
              <Text style={{ fontSize: 40 }}>🔔</Text>
              <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 16 }}>You're all caught up</Text>
              <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13, textAlign: 'center', maxWidth: 280 }}>
                Follows, kudos, challenge results and streak reminders show up here.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
