import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useFeed, useWeeklyLeaderboard } from '@/hooks/useSocialFeed';
import { useChallenges } from '@/hooks/useChallenges';
import { useAuthStore } from '@/stores/authStore';
import { ActivityFeedItem } from '@/components/social/ActivityFeedItem';
import { ChallengeCard } from '@/components/social/ChallengeCard';
import { Leaderboard } from '@/components/social/Leaderboard';
import { CreateChallengeSheet } from '@/components/social/CreateChallengeSheet';
import { Colors } from '@/constants/colors';
import { useQueryClient } from '@tanstack/react-query';

type Tab = 'feed' | 'challenges' | 'leaderboard';

function SectionHeader({ title }: { title: string }) {
  return (
    <Text style={{
      color: Colors.muted,
      fontFamily: 'DMSans-Bold',
      fontSize: 12,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 8,
    }}>
      {title}
    </Text>
  );
}

export default function SocialScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('feed');
  const [showCreateChallenge, setShowCreateChallenge] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      return () => setShowCreateChallenge(false);
    }, [])
  );

  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  const { data: feedItems, isLoading: feedLoading } = useFeed();
  const { data: leaderboard } = useWeeklyLeaderboard();
  const { data: challenges } = useChallenges();

  const activeChallenges = (challenges ?? []).filter((c) => !c.isComplete);
  const pastChallenges = (challenges ?? []).filter((c) => c.isComplete);

  function refresh() {
    qc.invalidateQueries({ queryKey: ['feed'] });
    qc.invalidateQueries({ queryKey: ['challenges'] });
    qc.invalidateQueries({ queryKey: ['leaderboard-weekly'] });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark }} edges={['top']}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 24 }}>
            Social
          </Text>
          {activeTab === 'challenges' && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowCreateChallenge(true);
              }}
              style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1,
                backgroundColor: Colors.orange,
                borderRadius: 999,
                paddingHorizontal: 16,
                paddingVertical: 8,
              })}
            >
              <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 14 }}>
                + New
              </Text>
            </Pressable>
          )}
        </View>

        {/* Tab switcher — pill segment control */}
        <View style={{
          flexDirection: 'row',
          backgroundColor: Colors.surface2,
          borderRadius: 999,
          padding: 3,
          gap: 2,
        }}>
          {(['feed', 'challenges', 'leaderboard'] as Tab[]).map((t) => (
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
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={Colors.orange} />}
      >
        {/* FEED */}
        {activeTab === 'feed' && (
          feedItems && feedItems.length > 0 ? (
            feedItems.map((item) => <ActivityFeedItem key={`${item.type}-${item.id}`} item={item} />)
          ) : !feedLoading ? (
            <View style={{
              backgroundColor: Colors.surface, borderRadius: 16,
              padding: 32, alignItems: 'center', gap: 12,
            }}>
              <Text style={{ fontSize: 40 }}>👋</Text>
              <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 17 }}>
                Nothing here yet
              </Text>
              <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14, textAlign: 'center' }}>
                Follow friends to see their activity here.
              </Text>
            </View>
          ) : null
        )}

        {/* CHALLENGES */}
        {activeTab === 'challenges' && (
          <>
            {activeChallenges.length > 0 && (
              <View style={{ gap: 10 }}>
                <SectionHeader title="Active" />
                {activeChallenges.map((c) => (
                  <ChallengeCard key={c.id} challenge={c} myUserId={user?.id} />
                ))}
              </View>
            )}
            {pastChallenges.length > 0 && (
              <View style={{ gap: 10, marginTop: 8 }}>
                <SectionHeader title="Completed" />
                {pastChallenges.map((c) => (
                  <ChallengeCard key={c.id} challenge={c} myUserId={user?.id} />
                ))}
              </View>
            )}
            {challenges?.length === 0 && (
              <View style={{
                backgroundColor: Colors.surface, borderRadius: 20,
                padding: 32, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: Colors.border,
              }}>
                <Text style={{ fontSize: 40 }}>🏆</Text>
                <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 17 }}>
                  No challenges yet
                </Text>
                <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14, textAlign: 'center' }}>
                  Create one or get an invite link from a friend.
                </Text>
                <Pressable
                  onPress={() => setShowCreateChallenge(true)}
                  style={{ backgroundColor: Colors.orange, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 12, marginTop: 4 }}
                >
                  <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 15 }}>
                    Create challenge
                  </Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        {/* LEADERBOARD */}
        {activeTab === 'leaderboard' && (
          <>
            <SectionHeader title={`This week — active minutes`} />
            {leaderboard && leaderboard.length > 0 ? (
              <Leaderboard entries={leaderboard} />
            ) : (
              <View style={{
                backgroundColor: Colors.surface, borderRadius: 20,
                padding: 32, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: Colors.border,
              }}>
                <Text style={{ fontSize: 40 }}>📊</Text>
                <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14, textAlign: 'center' }}>
                  Follow friends to see them on the leaderboard.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {showCreateChallenge && (
        <CreateChallengeSheet onClose={() => setShowCreateChallenge(false)} />
      )}
    </SafeAreaView>
  );
}
