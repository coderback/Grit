import React, { useEffect, useRef } from 'react';
import {
  View, Text, Pressable, ScrollView, ActivityIndicator, Share,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withDelay,
} from 'react-native-reanimated';
import { useChallenge } from '@/hooks/useChallenges';
import { useAuthStore } from '@/stores/authStore';
import { Colors } from '@/constants/colors';

const MEDALS = ['🥇', '🥈', '🥉'];

function formatDaysLeft(endDate: string) {
  const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000);
  if (days < 0) return 'Ended';
  if (days === 0) return 'Ends today';
  return `${days}d left`;
}

export default function ChallengeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: challenge, isLoading } = useChallenge(id);
  const user = useAuthStore((s) => s.user);

  const wasComplete = useRef(false);
  const confettiOpacity = useSharedValue(0);

  const confettiStyle = useAnimatedStyle(() => ({
    opacity: confettiOpacity.value,
  }));

  useEffect(() => {
    if (challenge?.isComplete && !wasComplete.current) {
      wasComplete.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      confettiOpacity.value = withDelay(300, withSpring(1));
    }
  }, [challenge?.isComplete]);

  async function shareInvite() {
    if (!challenge) return;
    await Share.share({
      message: `Join my GRIT challenge "${challenge.title}"! Use invite code: ${challenge.inviteCode}`,
      url: `grit://challenges/join/${challenge.inviteCode}`,
    });
  }

  if (isLoading || !challenge) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.orange} />
      </SafeAreaView>
    );
  }

  const totalProgress = challenge.totalProgress ??
    challenge.participants.reduce((s, p) => s + p.currentValue, 0);
  const pct = Math.min(totalProgress / challenge.goalValue, 1);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark }} edges={['top']}>
      {/* Completion banner */}
      {challenge.isComplete && (
        <Animated.View style={[{
          backgroundColor: Colors.success,
          padding: 16,
          alignItems: 'center',
          gap: 4,
        }, confettiStyle]}>
          <Text style={{ fontSize: 28 }}>🎉</Text>
          <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 17 }}>
            Challenge complete!
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontFamily: 'DMSans-Regular', fontSize: 14 }}>
            You crushed it. GRIT delivered.
          </Text>
        </Animated.View>
      )}

      <ScrollView contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 60 }}>
        {/* Back */}
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 15 }}>
            ← Back
          </Text>
        </Pressable>

        {/* Header */}
        <View style={{ gap: 4 }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 24 }}>
            {challenge.title}
          </Text>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14 }}>
            {challenge.participants.length} / 8 participants · {formatDaysLeft(challenge.endDate)}
          </Text>
        </View>

        {/* Progress */}
        <View style={{ backgroundColor: Colors.surface, borderRadius: 20, padding: 20, gap: 14, borderWidth: 1, borderColor: Colors.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 16 }}>
              Group progress
            </Text>
            <Text style={{ color: Colors.muted, fontFamily: 'JetBrainsMono-Regular', fontSize: 13 }}>
              {Math.round(pct * 100)}%
            </Text>
          </View>
          <View style={{ height: 12, backgroundColor: Colors.surface2, borderRadius: 999, overflow: 'hidden' }}>
            <View style={{
              height: '100%',
              width: `${pct * 100}%`,
              backgroundColor: challenge.isComplete ? Colors.success : Colors.orange,
              borderRadius: 999,
            }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: Colors.text, fontFamily: 'JetBrainsMono-Regular', fontSize: 14 }}>
              {totalProgress.toLocaleString()} steps
            </Text>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13 }}>
              goal {challenge.goalValue.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Leaderboard */}
        <View style={{ gap: 10 }}>
          <Text style={{
            color: Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 12,
            textTransform: 'uppercase', letterSpacing: 1,
          }}>
            Leaderboard · live
          </Text>
          {challenge.participants.map((p, i) => (
            <View
              key={p.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: p.userId === user?.id ? `${Colors.orange}18` : Colors.surface,
                borderRadius: 16,
                padding: 14,
                gap: 12,
                borderWidth: 1.5,
                borderColor: p.userId === user?.id ? Colors.orange : Colors.border,
              }}
            >
              <Text style={{ fontSize: 18, width: 28, textAlign: 'center' }}>
                {i < 3 ? MEDALS[i] : `${i + 1}`}
              </Text>
              <View style={{
                width: 34, height: 34, borderRadius: 17,
                backgroundColor: Colors.surface2,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 14 }}>
                  {p.user.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={{
                flex: 1,
                color: p.userId === user?.id ? Colors.orange : Colors.text,
                fontFamily: p.userId === user?.id ? 'DMSans-Bold' : 'DMSans-Medium',
                fontSize: 14,
              }}>
                {p.userId === user?.id ? 'You' : p.user.displayName}
              </Text>
              <Text style={{ color: Colors.muted, fontFamily: 'JetBrainsMono-Regular', fontSize: 13 }}>
                {p.currentValue.toLocaleString()}
              </Text>
            </View>
          ))}
        </View>

        {/* Share invite */}
        {!challenge.isComplete && (
          <Pressable
            onPress={shareInvite}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              backgroundColor: Colors.surface,
              borderRadius: 999,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              borderWidth: 1.5,
              borderColor: Colors.border,
            })}
          >
            <Text style={{ fontSize: 18 }}>🔗</Text>
            <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 15 }}>
              Invite friends
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
