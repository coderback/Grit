import React, { useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useLogHabit } from '@/hooks/useHabits';
import { Colors } from '@/constants/colors';
import type { Habit } from '@/hooks/useHabits';

interface HabitCheckInProps {
  habit: Habit;
  completedToday: boolean;
  streakCount: number;
}

export function HabitCheckIn({ habit, completedToday, streakCount }: HabitCheckInProps) {
  const { mutate: logHabit, isPending } = useLogHabit();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    if (completedToday || isPending) return;

    // Pop animation
    scale.value = withSequence(
      withSpring(0.92, { duration: 80 }),
      withSpring(1.06, { duration: 100 }),
      withSpring(1, { duration: 120 }),
    );

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    logHabit(habit.id);
  }, [completedToday, isPending, habit.id, logHabit, scale]);

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: Colors.surface,
          borderRadius: 16,
          padding: 16,
          gap: 14,
          opacity: pressed && !completedToday ? 0.85 : 1,
          borderWidth: 1.5,
          borderColor: completedToday ? Colors.teal : Colors.border,
        })}
      >
        {/* Emoji + check indicator */}
        <View style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: completedToday ? Colors.teal : Colors.surface2,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Text style={{ fontSize: completedToday ? 20 : 22 }}>
            {completedToday ? '✓' : habit.emoji}
          </Text>
        </View>

        {/* Name + streak */}
        <View style={{ flex: 1 }}>
          <Text style={{
            color: Colors.text,
            fontFamily: 'DMSans-Medium',
            fontSize: 15,
          }}>
            {habit.name}
          </Text>
          {streakCount > 0 && (
            <Text style={{
              color: completedToday ? Colors.teal : Colors.muted,
              fontFamily: 'DMSans-Regular',
              fontSize: 12,
              marginTop: 2,
            }}>
              🔥 {streakCount} day streak
            </Text>
          )}
        </View>

        {/* Tap target hint */}
        {!completedToday && (
          <View style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            borderWidth: 2,
            borderColor: Colors.border,
          }} />
        )}
      </Pressable>
    </Animated.View>
  );
}
