import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAINudge } from '@/hooks/useAICoach';
import { Colors } from '@/constants/colors';

export function NudgeCard() {
  const { data, isLoading } = useAINudge();

  return (
    <Pressable
      onPress={() => router.push('/coach')}
      style={({ pressed }) => ({
        opacity: pressed ? 0.85 : 1,
        backgroundColor: Colors.surface,
        borderRadius: 20,
        padding: 18,
        gap: 10,
        borderWidth: 1.5,
        borderColor: `${Colors.orange}40`,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 18 }}>🤖</Text>
        <Text style={{
          color: Colors.orange,
          fontFamily: 'DMSans-Bold',
          fontSize: 13,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
        }}>
          GRIT Coach
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={Colors.orange} size="small" />
      ) : (
        <Text style={{
          color: Colors.text,
          fontFamily: 'DMSans-Regular',
          fontSize: 14,
          lineHeight: 21,
        }}>
          {data?.nudge ?? 'Tap to chat with your AI coach.'}
        </Text>
      )}

      <Text style={{
        color: Colors.muted,
        fontFamily: 'DMSans-Medium',
        fontSize: 13,
      }}>
        Ask anything →
      </Text>
    </Pressable>
  );
}
