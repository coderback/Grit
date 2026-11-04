import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { ScreenHeader } from '@/components/settings/SettingsUI';
import { PersonRow } from '@/components/social/PersonRow';
import { FollowButton } from '@/components/social/FollowButton';
import { ErrorNotice } from '@/components/ui/QueryStatus';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { confirmAction } from '@/lib/confirm';
import {
  useAcceptRequest, useConnections, useDeclineRequest, useFollowRequests,
  useRemoveFollower, useSearchUsers, type PersonRow as Person,
} from '@/hooks/useSocialFeed';

type Tab = 'requests' | 'followers' | 'following';

function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 10, paddingVertical: 32 }}>
      <Text style={{ fontSize: 36 }}>{icon}</Text>
      <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14, textAlign: 'center', maxWidth: 280 }}>{text}</Text>
    </View>
  );
}

function SmallButton({ label, onPress, primary, disabled }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => ({
        backgroundColor: primary ? Colors.orange : Colors.surface2,
        borderColor: primary ? Colors.orange : Colors.border,
        borderWidth: 1.5,
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 7,
        opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ color: primary ? '#fff' : Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

/** Find people, answer follow requests and manage followers. */
export default function FriendsScreen() {
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>(params.tab ?? 'following');
  const searching = query.trim().replace(/^@/, '').length >= 2;

  const search = useSearchUsers(query);
  const requests = useFollowRequests();
  const followers = useConnections('me', 'followers', tab === 'followers');
  const following = useConnections('me', 'following', tab === 'following');
  const { mutate: accept, isPending: accepting } = useAcceptRequest();
  const { mutate: decline, isPending: declining } = useDeclineRequest();
  const { mutate: removeFollower } = useRemoveFollower();
  const { refreshing, onRefresh } = usePullToRefresh([['follow-requests'], ['connections'], ['search-users']]);

  const requestCount = requests.data?.length ?? 0;
  const list = tab === 'followers' ? followers : following;

  async function handleRemove(person: Person) {
    const ok = await confirmAction({
      title: `Remove ${person.displayName}?`,
      message: "They won't be told, and won't see your activity unless they follow you again.",
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (ok) removeFollower(person.id);
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}>
      <ScreenHeader title="Friends" />
      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name or @username"
          placeholderTextColor={Colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search people"
          style={{
            backgroundColor: Colors.surface, borderRadius: 999, borderWidth: 1, borderColor: Colors.border,
            paddingHorizontal: 18, paddingVertical: 12, color: Colors.text, fontFamily: 'DMSans-Regular', fontSize: 15,
          }}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 16, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.orange} />}
      >
        {searching ? (
          search.isLoading ? (
            <ActivityIndicator color={Colors.orange} style={{ marginTop: 24 }} />
          ) : search.isError ? (
            <ErrorNotice what="search results" onRetry={() => search.refetch()} />
          ) : (search.data ?? []).length === 0 ? (
            <Empty icon="🔍" text={`Nobody found for "${query.trim()}".`} />
          ) : (
            search.data!.map((p) => <PersonRow key={p.id} user={p} relationship={p.relationship} isMe={p.isMe} />)
          )
        ) : (
          <>
            <View style={{ flexDirection: 'row', backgroundColor: Colors.surface2, borderRadius: 999, padding: 3, gap: 2 }} accessibilityRole="tablist">
              {(['following', 'followers', 'requests'] as Tab[]).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setTab(t)}
                  accessibilityRole="tab"
                  aria-selected={tab === t}
                  style={{ flex: 1, paddingVertical: 9, borderRadius: 999, alignItems: 'center', backgroundColor: tab === t ? Colors.surface3 : 'transparent' }}
                >
                  <Text style={{ color: tab === t ? Colors.text : Colors.muted, fontFamily: tab === t ? 'DMSans-Bold' : 'DMSans-Regular', fontSize: 13, textTransform: 'capitalize' }}>
                    {t}{t === 'requests' && requestCount > 0 ? ` (${requestCount})` : ''}
                  </Text>
                </Pressable>
              ))}
            </View>

            {tab === 'requests' ? (
              requests.isLoading ? (
                <ActivityIndicator color={Colors.orange} style={{ marginTop: 24 }} />
              ) : requests.isError ? (
                <ErrorNotice what="follow requests" onRetry={() => requests.refetch()} />
              ) : requestCount === 0 ? (
                <Empty icon="📭" text="No follow requests. When someone asks to follow you, they'll appear here." />
              ) : (
                requests.data!.map((r) => (
                  <PersonRow
                    key={r.user.id}
                    user={r.user}
                    right={
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <SmallButton label="Accept" primary disabled={accepting} onPress={() => accept(r.user.id)} />
                        <SmallButton label="Decline" disabled={declining} onPress={() => decline(r.user.id)} />
                      </View>
                    }
                  />
                ))
              )
            ) : list.isLoading ? (
              <ActivityIndicator color={Colors.orange} style={{ marginTop: 24 }} />
            ) : list.isError ? (
              <ErrorNotice what={`your ${tab}`} onRetry={() => list.refetch()} />
            ) : (list.data ?? []).length === 0 ? (
              <Empty
                icon={tab === 'followers' ? '🫂' : '👋'}
                text={tab === 'followers'
                  ? 'No followers yet. Share your username so friends can find you.'
                  : 'You’re not following anyone yet. Search for friends above.'}
              />
            ) : (
              list.data!.map((p) => (
                <PersonRow
                  key={p.id}
                  user={p}
                  relationship={p.relationship}
                  isMe={p.isMe}
                  right={tab === 'followers' ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {p.relationship.following !== 'accepted' && (
                        <FollowButton userId={p.id} name={p.displayName} relationship={p.relationship} />
                      )}
                      <Pressable
                        onPress={() => handleRemove(p)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove follower ${p.displayName}`}
                        style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface2 }}
                      >
                        <Text style={{ color: Colors.muted, fontSize: 14 }}>✕</Text>
                      </Pressable>
                    </View>
                  ) : undefined}
                />
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
