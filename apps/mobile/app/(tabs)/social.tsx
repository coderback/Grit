import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useFeed, useWeeklyLeaderboard } from '@/hooks/useSocialFeed';
import { useChallenges } from '@/hooks/useChallenges';
import { useAuthStore } from '@/stores/authStore';
import { ActivityFeedItem } from '@/components/social/ActivityFeedItem';
import { Leaderboard } from '@/components/social/Leaderboard';
import { CreateChallengeSheet } from '@/components/social/CreateChallengeSheet';
import { Colors } from '@/constants/colors';
import { useQueryClient } from '@tanstack/react-query';

type Tab = 'feed' | 'challenges' | 'leaderboard';

const CHALLENGE_COLORS: Record<string, string> = {};

function getColor(index: number) {
  const pool = [Colors.orange, Colors.teal, Colors.blue];
  return pool[index % pool.length];
}

function ChallengeCardRedesign({ challenge, index }: { challenge: any; index: number }) {
  const color = getColor(index);
  const pct = challenge.total > 0 ? challenge.progress / challenge.total : 0;
  const emoji = challenge.emoji ?? ['💪', '🧘', '🚶', '🏆', '🔥'][index % 5];

  return (
    <View style={{ backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, padding: 18 }}>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: `${color}18`, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Text style={{ fontSize: 24 }}>{emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontFamily: 'DMSans-Bold', color: Colors.text }}>{challenge.title}</Text>
          {challenge.description && (
            <Text style={{ fontSize: 13, color: Colors.muted, fontFamily: 'DMSans-Regular', marginTop: 2 }}>{challenge.description}</Text>
          )}
          {challenge.participantCount != null && (
            <Text style={{ fontSize: 11, color: Colors.muted, fontFamily: 'DMSans-Regular', marginTop: 4 }}>
              {challenge.participantCount.toLocaleString()} participants
            </Text>
          )}
        </View>
        {challenge.progress != null && (
          <View style={{ backgroundColor: `${color}18`, borderWidth: 1, borderColor: `${color}40`, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 0 }}>
            <Text style={{ fontSize: 11, fontFamily: 'DMSans-Bold', color }}> Day {challenge.progress}</Text>
          </View>
        )}
      </View>
      {challenge.total > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1, height: 6, backgroundColor: Colors.surface2, borderRadius: 999, overflow: 'hidden' }}>
            <View style={{ height: '100%', width: `${pct * 100}%`, backgroundColor: color, borderRadius: 999 }} />
          </View>
          <Text style={{ fontSize: 12, fontFamily: 'JetBrainsMono-Regular', color: Colors.muted }}>
            {challenge.progress}/{challenge.total}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function SocialScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('challenges');
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

  const activeChallenges = (challenges ?? []).filter((c: any) => !c.isComplete);
  const pastChallenges = (challenges ?? []).filter((c: any) => c.isComplete);

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
              <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 14 }}>Explore</Text>
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
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={Colors.orange} />}
        showsVerticalScrollIndicator={false}
      >
        {/* FEED */}
        {activeTab === 'feed' && (
          feedItems && feedItems.length > 0 ? (
            feedItems.map((item: any) => <ActivityFeedItem key={`${item.type}-${item.id}`} item={item} />)
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
            {activeChallenges.length > 0 && (
              <View style={{ gap: 12 }}>
                <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Active challenges
                </Text>
                {activeChallenges.map((c: any, i: number) => (
                  <ChallengeCardRedesign key={c.id} challenge={c} index={i} />
                ))}
              </View>
            )}
            {pastChallenges.length > 0 && (
              <View style={{ gap: 12, marginTop: 8 }}>
                <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Completed
                </Text>
                {pastChallenges.map((c: any, i: number) => (
                  <ChallengeCardRedesign key={c.id} challenge={c} index={i} />
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
