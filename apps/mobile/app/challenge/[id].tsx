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
import { useChallenge, useDeleteChallenge, useLeaveChallenge } from '@/hooks/useChallenges';
import { amount, daysLeftLabel, hasEnded } from '@/lib/challenges';
import { confirmAction } from '@/lib/confirm';
import { useMe } from '@/hooks/useMe';
import { ErrorNotice } from '@/components/ui/QueryStatus';
import { ScreenHeader } from '@/components/settings/SettingsUI';
import { Colors } from '@/constants/colors';
import { Avatar } from '@/components/ui/Avatar';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function ChallengeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: challenge, isLoading, isError, refetch } = useChallenge(id);
  const { data: me } = useMe();
  const { mutateAsync: leave, isPending: leaving } = useLeaveChallenge();
  const { mutateAsync: remove, isPending: removing } = useDeleteChallenge();

  async function handleLeave() {
    if (!challenge) return;
    const ok = await confirmAction({
      title: 'Leave challenge?',
      message: `Your progress leaves ${challenge.title} and you'll need an invite to rejoin.`,
      confirmLabel: 'Leave',
      destructive: true,
    });
    if (!ok) return;
    await leave(challenge.id);
    router.back();
  }

  async function handleDelete() {
    if (!challenge) return;
    const ok = await confirmAction({
      title: 'Delete challenge?',
      message: `${challenge.title} will be removed for everyone taking part. This can't be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    await remove(challenge.id);
    router.back();
  }

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

  // Without this the spinner below would spin forever on a failed request
  if (isError && !challenge) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark }}>
        <ScreenHeader title="" />
        <View style={{ padding: 20 }}>
          <ErrorNotice what="this challenge" onRetry={() => refetch()} />
        </View>
      </SafeAreaView>
    );
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
  const ended = hasEnded(challenge);

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
            Goal reached!
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontFamily: 'DMSans-Regular', fontSize: 14 }}>
            {ended ? 'You crushed it. GRIT delivered.' : 'The group hit the goal. Keep stacking it up.'}
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
            {challenge.participants.length} / 8 participants · {daysLeftLabel(challenge.endDate)}
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
              {amount(challenge.type, totalProgress)}
            </Text>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13 }}>
              goal {amount(challenge.type, challenge.goalValue)}
            </Text>
          </View>
        </View>

        {/* Leaderboard */}
        <View style={{ gap: 10 }}>
          <Text style={{
            color: Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 12,
            textTransform: 'uppercase', letterSpacing: 1,
          }}>
            {ended ? 'Final standings' : 'Leaderboard · live'}
          </Text>
          {challenge.participants.map((p, i) => (
            <View
              key={p.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: p.userId === me?.id ? `${Colors.orange}18` : Colors.surface,
                borderRadius: 16,
                padding: 14,
                gap: 12,
                borderWidth: 1.5,
                borderColor: p.userId === me?.id ? Colors.orange : Colors.border,
              }}
            >
              <Text style={{ fontSize: 18, width: 28, textAlign: 'center' }}>
                {i < 3 ? MEDALS[i] : `${i + 1}`}
              </Text>
              <Avatar name={p.user.displayName} url={p.user.avatarUrl} size={34} />
              <Text style={{
                flex: 1,
                color: p.userId === me?.id ? Colors.orange : Colors.text,
                fontFamily: p.userId === me?.id ? 'DMSans-Bold' : 'DMSans-Medium',
                fontSize: 14,
              }}>
                {p.userId === me?.id ? 'You' : p.user.displayName}
              </Text>
              <Text style={{ color: Colors.muted, fontFamily: 'JetBrainsMono-Regular', fontSize: 13 }}>
                {amount(challenge.type, p.currentValue)}
              </Text>
            </View>
          ))}
        </View>

        {ended && (
          <View style={{ backgroundColor: Colors.surface2, borderRadius: 16, padding: 14 }}>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13, textAlign: 'center' }}>
              {challenge.isComplete
                ? 'This challenge has ended, and the group hit the goal.'
                : `This challenge has ended. The group reached ${Math.floor(pct * 100)}% of the goal.`}
            </Text>
          </View>
        )}

        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12, textAlign: 'center' }}>
          Progress comes from workouts logged between the start and end of the challenge.
        </Text>

        {/* Share invite */}
        {!ended && (
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
        {challenge.isCreator ? (
          <Pressable onPress={() => handleDelete().catch(() => {})} disabled={removing} accessibilityRole="button" style={{ alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ color: Colors.error, fontFamily: 'DMSans-Bold', fontSize: 14 }}>{removing ? 'Deleting…' : 'Delete challenge'}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => handleLeave().catch(() => {})} disabled={leaving} accessibilityRole="button" style={{ alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ color: Colors.error, fontFamily: 'DMSans-Bold', fontSize: 14 }}>{leaving ? 'Leaving…' : 'Leave challenge'}</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
