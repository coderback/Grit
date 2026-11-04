import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  usePublicProfile, useAcceptRequest, useDeclineRequest, useBlock, useUnblock, useRemoveFollower,
} from '@/hooks/useSocialFeed';
import { ErrorNotice } from '@/components/ui/QueryStatus';
import { ScreenHeader } from '@/components/settings/SettingsUI';
import { Avatar } from '@/components/ui/Avatar';
import { FollowButton } from '@/components/social/FollowButton';
import { ActivityFeedItem } from '@/components/social/ActivityFeedItem';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { confirmAction } from '@/lib/confirm';
import { Colors } from '@/constants/colors';

const GOAL_LABELS: Record<string, string> = {
  lose_weight: 'Lose weight',
  build_muscle: 'Build muscle',
  maintain: 'Maintain',
  recomp: 'Recomp',
  build_strength: 'Build strength',
  build_habits: 'Build habits',
  just_track: 'Just tracking',
};

const card = {
  backgroundColor: Colors.surface,
  borderRadius: 20,
  padding: 16,
  borderWidth: 1,
  borderColor: Colors.border,
} as const;

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: profile, isLoading, isError, refetch } = usePublicProfile(id);
  const { mutate: accept, isPending: accepting } = useAcceptRequest();
  const { mutate: decline, isPending: declining } = useDeclineRequest();
  const { mutate: block } = useBlock();
  const { mutate: unblock, isPending: unblocking } = useUnblock();
  const { mutate: removeFollower } = useRemoveFollower();
  const { refreshing, onRefresh } = usePullToRefresh([['profile', id]]);
  const [menuOpen, setMenuOpen] = useState(false);

  // Without this the spinner below would spin forever on a failed request
  if (isError && !profile) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark }}>
        <ScreenHeader title="" />
        <View style={{ padding: 20 }}>
          <ErrorNotice what="this profile" onRetry={() => refetch()} />
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading || !profile) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.orange} />
      </SafeAreaView>
    );
  }

  const rel = profile.relationship;
  const name = profile.displayName;

  async function handleBlock() {
    setMenuOpen(false);
    const ok = await confirmAction({
      title: `Block ${name}?`,
      message: "They won't be able to find you, follow you or see your activity, and you'll stop following each other. They won't be told.",
      confirmLabel: 'Block',
      destructive: true,
    });
    if (ok) block(profile!.id);
  }

  async function handleRemoveFollower() {
    setMenuOpen(false);
    const ok = await confirmAction({
      title: `Remove ${name}?`,
      message: "They won't be told, and won't see your activity unless they follow you again.",
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (ok) removeFollower(profile!.id);
  }

  const menu = !profile.isMe && rel && !rel.blocked ? (
    <Pressable
      onPress={() => setMenuOpen((o) => !o)}
      accessibilityRole="button"
      accessibilityLabel="More options"
      hitSlop={8}
      style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ color: Colors.text, fontSize: 18, marginTop: -6 }}>…</Text>
    </Pressable>
  ) : undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark }} edges={['top']}>
      <ScreenHeader title="" right={menu} />
      {menuOpen && (
        <View style={{ position: 'absolute', top: 100, right: 20, zIndex: 10, ...card, padding: 6, minWidth: 200 }}>
          {rel?.followsYou === 'accepted' && (
            <Pressable onPress={handleRemoveFollower} accessibilityRole="button" style={{ padding: 12 }}>
              <Text style={{ color: Colors.text, fontFamily: 'DMSans-Medium', fontSize: 15 }}>Remove follower</Text>
            </Pressable>
          )}
          <Pressable onPress={handleBlock} accessibilityRole="button" style={{ padding: 12 }}>
            <Text style={{ color: Colors.error, fontFamily: 'DMSans-Medium', fontSize: 15 }}>Block {name}</Text>
          </Pressable>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 20, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.orange} />}
      >
        {/* Photo + name */}
        <View style={{ alignItems: 'center', gap: 12 }}>
          <Avatar name={name} url={profile.avatarUrl} size={88} ring={Colors.orange} />
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 22 }}>{name}</Text>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14 }}>
              @{profile.username}{profile.isPrivate ? '  ·  🔒 Private' : ''}
            </Text>
            {!!profile.primaryGoal && profile.canView && (
              <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13 }}>
                🎯 {GOAL_LABELS[profile.primaryGoal] ?? profile.primaryGoal}
              </Text>
            )}
          </View>
        </View>

        {rel?.blocked ? (
          <View style={{ ...card, alignItems: 'center', gap: 12 }}>
            <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 16 }}>You blocked {name}</Text>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13, textAlign: 'center' }}>
              Unblock them to see their profile again. You'll need to follow each other again.
            </Text>
            <Pressable
              onPress={() => unblock(profile.id)}
              disabled={unblocking}
              accessibilityRole="button"
              style={{ backgroundColor: Colors.surface2, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 10, borderWidth: 1.5, borderColor: Colors.border }}
            >
              <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 14 }}>Unblock</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Counts */}
            <View style={{ ...card, flexDirection: 'row', justifyContent: 'space-around' }}>
              {([
                { label: 'Followers', value: profile._count.followers, which: 'followers' },
                { label: 'Following', value: profile._count.following, which: 'following' },
              ] as const).map((s) => (
                <Pressable
                  key={s.label}
                  disabled={!profile.canView}
                  onPress={() => router.push({ pathname: '/connections', params: { id: profile.id, which: s.which, name } })}
                  accessibilityRole="button"
                  accessibilityLabel={`${s.value} ${s.label}`}
                  style={{ alignItems: 'center', gap: 4, paddingHorizontal: 16 }}
                >
                  <Text style={{ color: Colors.text, fontFamily: 'JetBrainsMono-Regular', fontSize: 22 }}>{s.value}</Text>
                  <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13 }}>{s.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* They asked to follow you */}
            {rel?.followsYou === 'pending' && (
              <View style={{ ...card, gap: 12, borderColor: `${Colors.orange}60` }}>
                <Text style={{ color: Colors.text, fontFamily: 'DMSans-Medium', fontSize: 14 }}>{name} wants to follow you.</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable onPress={() => accept(profile.id)} disabled={accepting} accessibilityRole="button" style={{ flex: 1, backgroundColor: Colors.orange, borderRadius: 999, paddingVertical: 10, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 14 }}>Accept</Text>
                  </Pressable>
                  <Pressable onPress={() => decline(profile.id)} disabled={declining} accessibilityRole="button" style={{ flex: 1, backgroundColor: Colors.surface2, borderRadius: 999, paddingVertical: 10, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border }}>
                    <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 14 }}>Decline</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {profile.isMe ? (
              <View style={{ backgroundColor: Colors.surface2, borderRadius: 16, padding: 14, alignItems: 'center' }}>
                <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13 }}>
                  This is how others see your profile.
                </Text>
              </View>
            ) : rel && (
              <FollowButton userId={profile.id} name={name} relationship={rel} large />
            )}

            {!profile.canView ? (
              <View style={{ ...card, alignItems: 'center', gap: 8, paddingVertical: 28 }}>
                <Text style={{ fontSize: 32 }}>🔒</Text>
                <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 16 }}>This account is private</Text>
                <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13, textAlign: 'center' }}>
                  {rel?.following === 'pending'
                    ? `Once ${name} accepts your request you'll see their activity.`
                    : `Follow ${name} to see their workouts and progress.`}
                </Text>
              </View>
            ) : (
              <>
                {profile.week && (
                  <View style={{ ...card, flexDirection: 'row', justifyContent: 'space-around' }}>
                    {[
                      { label: 'Active min', value: profile.week.activeMinutes },
                      { label: 'Workouts', value: profile.week.workouts },
                    ].map((s) => (
                      <View key={s.label} style={{ alignItems: 'center', gap: 4 }}>
                        <Text style={{ color: Colors.teal, fontFamily: 'JetBrainsMono-Regular', fontSize: 22 }}>{s.value}</Text>
                        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12 }}>{s.label} this week</Text>
                      </View>
                    ))}
                  </View>
                )}
                <View style={{ gap: 10 }}>
                  <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Recent activity
                  </Text>
                  {profile.recent.length === 0 ? (
                    <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13 }}>Nothing in the last 7 days.</Text>
                  ) : (
                    profile.recent.map((item) => <ActivityFeedItem key={`${item.type}-${item.id}`} item={item} showKudos={!profile.isMe} />)
                  )}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
