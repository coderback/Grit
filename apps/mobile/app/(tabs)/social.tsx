import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useFeed, useWeeklyLeaderboard } from '@/hooks/useSocialFeed';
import { useChallenges, useJoinChallenge } from '@/hooks/useChallenges';
import { useMe } from '@/hooks/useMe';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { ActivityFeedItem } from '@/components/social/ActivityFeedItem';
import { Leaderboard } from '@/components/social/Leaderboard';
import { ChallengeCard } from '@/components/social/ChallengeCard';
import { CreateChallengeSheet } from '@/components/social/CreateChallengeSheet';
import { Colors } from '@/constants/colors';
import { router } from 'expo-router';

type Tab = 'feed' | 'challenges' | 'leaderboard';

export default function SocialScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('challenges');
  const [showCreateChallenge, setShowCreateChallenge] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      return () => setShowCreateChallenge(false);
    }, [])
  );

  const { data: me } = useMe();
  const { mutateAsync: joinChallenge, isPending: joining } = useJoinChallenge();
  const [inviteCode, setInviteCode] = useState('');

  async function handleJoin() {
    const code = inviteCode.trim();
    if (!code) return;
    try {
      const participant = await joinChallenge(code);
      setInviteCode('');
      router.push(`/challenge/${participant.challengeId}`);
    } catch (err: any) {
      Alert.alert("Couldn't join", err?.response?.data?.message ?? 'Check the invite code and try again.');
    }
  }

  const { data: feedItems, isLoading: feedLoading } = useFeed();
  const { data: leaderboard } = useWeeklyLeaderboard();
  const { data: challenges } = useChallenges();

  const activeChallenges = (challenges ?? []).filter((c) => !c.isComplete);
  const pastChallenges = (challenges ?? []).filter((c) => c.isComplete);

  const { refreshing, onRefresh } = usePullToRefresh([
    ['feed'],
    ['challenges'],
    ['leaderboard-weekly'],
  ]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark }} edges={['top']}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 28, letterSpacing: -0.5 }}>Social</Text>
          {activeTab === 'challenges' && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowCreateChallenge(true);
              }}
              style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1,
                backgroundColor: 'transparent',
                borderRadius: 999,
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderWidth: 1.5,
                borderColor: Colors.orange,
              })}
            >
              <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 14 }}>+ New</Text>
            </Pressable>
          )}
        </View>

        {/* Tab switcher */}
        <View style={{ flexDirection: 'row', backgroundColor: Colors.surface2, borderRadius: 999, padding: 3, gap: 2 }}>
          {(['feed', 'challenges', 'leaderboard'] as Tab[]).map(t => (
            <Pressable
              key={t}
              onPress={() => setActiveTab(t)}
              style={{
                flex: 1,
                paddingVertical: 9,
                borderRadius: 999,
                alignItems: 'center',
                backgroundColor: activeTab === t ? Colors.surface3 : 'transparent',
              }}
            >
              <Text style={{
                color: activeTab === t ? Colors.text : Colors.muted,
                fontFamily: activeTab === t ? 'DMSans-Bold' : 'DMSans-Regular',
                fontSize: 13,
                textTransform: 'capitalize',
              }}>
                {t}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.orange} />}
        showsVerticalScrollIndicator={false}
      >
        {/* FEED */}
        {activeTab === 'feed' && (
          feedItems && feedItems.length > 0 ? (
            feedItems.map((item) => <ActivityFeedItem key={`${item.type}-${item.id}`} item={item} />)
          ) : !feedLoading ? (
            <View style={{ backgroundColor: Colors.surface, borderRadius: 20, padding: 32, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: Colors.border }}>
              <Text style={{ fontSize: 40 }}>👋</Text>
              <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 17 }}>Nothing here yet</Text>
              <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14, textAlign: 'center' }}>
                Follow friends to see their activity here.
              </Text>
            </View>
          ) : null
        )}

        {/* CHALLENGES */}
        {activeTab === 'challenges' && (
          <>
            {/* Join with an invite code */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                value={inviteCode}
                onChangeText={setInviteCode}
                placeholder="Have an invite code?"
                placeholderTextColor={Colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  flex: 1, backgroundColor: Colors.surface, borderRadius: 999,
                  borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 16,
                  paddingVertical: 10, color: Colors.text, fontFamily: 'DMSans-Regular', fontSize: 14,
                }}
              />
              <Pressable
                onPress={handleJoin}
                disabled={!inviteCode.trim() || joining}
                style={{
                  backgroundColor: Colors.orange, borderRadius: 999, paddingHorizontal: 18,
                  justifyContent: 'center', opacity: !inviteCode.trim() || joining ? 0.5 : 1,
                }}
              >
                <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 14 }}>Join</Text>
              </Pressable>
            </View>

            {activeChallenges.length > 0 && (
              <View style={{ gap: 12 }}>
                <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Active challenges
                </Text>
                {activeChallenges.map((c) => (
                  <ChallengeCard key={c.id} challenge={c} myUserId={me?.id} />
                ))}
              </View>
            )}
            {pastChallenges.length > 0 && (
              <View style={{ gap: 12, marginTop: 8 }}>
                <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Completed
                </Text>
                {pastChallenges.map((c) => (
                  <ChallengeCard key={c.id} challenge={c} myUserId={me?.id} />
                ))}
              </View>
            )}
            {challenges?.length === 0 && (
              <View style={{ backgroundColor: Colors.surface, borderRadius: 20, padding: 32, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: Colors.border }}>
                <Text style={{ fontSize: 40 }}>🏆</Text>
                <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 17 }}>No challenges yet</Text>
                <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14, textAlign: 'center' }}>
                  Create one or get an invite link from a friend.
                </Text>
                <Pressable
                  onPress={() => setShowCreateChallenge(true)}
                  style={{ backgroundColor: Colors.orange, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 12, marginTop: 4 }}
                >
                  <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 15 }}>Create challenge</Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        {/* LEADERBOARD */}
        {activeTab === 'leaderboard' && (
          <>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              This week — active minutes
            </Text>
            {leaderboard && leaderboard.length > 0 ? (
              <Leaderboard entries={leaderboard} />
            ) : (
              <View style={{ backgroundColor: Colors.surface, borderRadius: 20, padding: 32, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: Colors.border }}>
                <Text style={{ fontSize: 40 }}>📊</Text>
                <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14, textAlign: 'center' }}>
                  Follow friends to see them on the leaderboard.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {showCreateChallenge && <CreateChallengeSheet onClose={() => setShowCreateChallenge(false)} />}
    </SafeAreaView>
  );
}
