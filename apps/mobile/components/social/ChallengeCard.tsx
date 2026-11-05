import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import type { Challenge } from '@/hooks/useChallenges';
import { amount, daysLeftLabel, hasEnded, measureName } from '@/lib/challenges';

interface ChallengeCardProps {
  challenge: Challenge;
  myUserId?: string;
}

export function ChallengeCard({ challenge, myUserId }: ChallengeCardProps) {
  const totalProgress = challenge.totalProgress ??
    challenge.participants.reduce((s, p) => s + p.currentValue, 0);
  const pct = Math.min(totalProgress / challenge.goalValue, 1);

  const ended = hasEnded(challenge);

  const myEntry = challenge.participants.find((p) => p.userId === myUserId);

  async function copyInviteLink() {
    const link = `grit://challenges/join/${challenge.inviteCode}`;
    await Clipboard.setStringAsync(link);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  return (
    <Pressable accessibilityRole="button"
      onPress={() => router.push(`/challenge/${challenge.id}` as never)}
      style={({ pressed }) => ({
        backgroundColor: Colors.surface,
        borderRadius: 20,
        padding: 16,
        gap: 14,
        opacity: pressed ? 0.9 : 1,
        borderWidth: 1.5,
        borderColor: challenge.isComplete ? Colors.teal : Colors.border,
      })}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 16 }}>
            {challenge.isComplete ? '🏆 ' : ''}{challenge.title}
          </Text>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12 }}>
            {challenge.participants.length} {challenge.participants.length === 1 ? 'participant' : 'participants'} · {daysLeftLabel(challenge.endDate)}
          </Text>
        </View>
        {!ended && (
          <Pressable
            onPress={copyInviteLink}
            accessibilityRole="button"
            accessibilityLabel="Copy invite link"
            hitSlop={8}
            style={{
              backgroundColor: Colors.surface2,
              borderRadius: 8,
              padding: 6,
            }}
          >
            <Text style={{ fontSize: 14 }}>🔗</Text>
          </Pressable>
        )}
      </View>

      {/* Progress bar */}
      <View style={{ gap: 6 }}>
        <View style={{
          height: 8,
          backgroundColor: Colors.surface2,
          borderRadius: 999,
          overflow: 'hidden',
        }}>
          <View style={{
            height: '100%',
            width: `${pct * 100}%`,
            backgroundColor: challenge.isComplete ? Colors.teal : Colors.orange,
            borderRadius: 999,
          }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: Colors.muted, fontFamily: 'JetBrainsMono-Regular', fontSize: 11 }}>
            {amount(challenge.type, totalProgress)}
          </Text>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 11 }}>
            goal: {amount(challenge.type, challenge.goalValue)}
          </Text>
        </View>
      </View>

      {/* My contribution */}
      {myEntry && (
        <View style={{
          backgroundColor: Colors.surface2,
          borderRadius: 12,
          padding: 10,
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13 }}>
            My {measureName(challenge.type)}
          </Text>
          <Text style={{ color: Colors.orange, fontFamily: 'JetBrainsMono-Regular', fontSize: 13 }}>
            {amount(challenge.type, myEntry.currentValue)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
