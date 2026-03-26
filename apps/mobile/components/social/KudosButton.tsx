import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useGiveKudos } from '@/hooks/useActivityLog';
import { Colors } from '@/constants/colors';

interface KudosButtonProps {
  logId: string;
  initialCount: number;
}

export function KudosButton({ logId, initialCount }: KudosButtonProps) {
  const { mutate: giveKudos } = useGiveKudos();
  const [count, setCount] = useState(initialCount);
  const [given, setGiven] = useState(false);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handlePress() {
    if (given) return;
    scale.value = withSequence(
      withSpring(1.4, { duration: 120 }),
      withSpring(1, { duration: 150 }),
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCount((c) => c + 1);
    setGiven(true);
    giveKudos(logId);
  }

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: given ? `${Colors.blue}22` : Colors.surface2,
          borderWidth: 1.5,
          borderColor: given ? Colors.blue : Colors.border,
        }}
      >
        <Text style={{ fontSize: 14 }}>👊</Text>
        {count > 0 && (
          <Text style={{
            color: given ? Colors.blue : Colors.muted,
            fontFamily: 'DMSans-Bold',
            fontSize: 13,
          }}>
            {count}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}
