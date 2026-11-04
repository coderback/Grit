import React from 'react';
import { ScrollView, Text, ActivityIndicator, RefreshControl } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { ScreenHeader } from '@/components/settings/SettingsUI';
import { PersonRow } from '@/components/social/PersonRow';
import { ErrorNotice } from '@/components/ui/QueryStatus';
import { useConnections } from '@/hooks/useSocialFeed';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

/** Someone's followers or the people they follow. */
export default function ConnectionsScreen() {
  const { id, which, name } = useLocalSearchParams<{ id: string; which: 'followers' | 'following'; name?: string }>();
  const kind = which === 'following' ? 'following' : 'followers';
  const { data, isLoading, isError, refetch } = useConnections(id, kind);
  const { refreshing, onRefresh } = usePullToRefresh([['connections', id, kind]]);
  const title = kind === 'followers' ? 'Followers' : 'Following';

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}>
      <ScreenHeader title={name ? `${name} · ${title}` : title} />
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.orange} />}
      >
        {isLoading ? (
          <ActivityIndicator color={Colors.orange} style={{ marginTop: 24 }} />
        ) : isError ? (
          <ErrorNotice what={title.toLowerCase()} onRetry={() => refetch()} />
        ) : (data ?? []).length === 0 ? (
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14, textAlign: 'center', marginTop: 24 }}>
            {kind === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
          </Text>
        ) : (
          data!.map((p) => <PersonRow key={p.id} user={p} relationship={p.relationship} isMe={p.isMe} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
