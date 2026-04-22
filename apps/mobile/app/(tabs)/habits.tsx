import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Alert, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';
import {
  useHabits,
  useHabitStreak,
  useDeleteHabit,
  type Habit,
} from '@/hooks/useHabits';
import { HabitCheckIn } from '@/components/habits/HabitCheckIn';
import { CreateHabitSheet } from '@/components/habits/CreateHabitSheet';
import { Colors } from '@/constants/colors';

function HabitCard({ habit, totalHabits, completedCount }: { habit: Habit; totalHabits: number; completedCount: number }) {
  const { data: streakData } = useHabitStreak(habit.id);
  const { mutate: deleteHabit } = useDeleteHabit();
  const [expanded, setExpanded] = useState(false);
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const completedToday = streakData?.grid.at(-1)?.completed ?? false;
  const streakCount = streakData?.streakCount ?? 0;

  function handlePress() {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <View style={{
        backgroundColor: completedToday ? 'rgba(0,200,160,0.06)' : Colors.surface,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: completedToday ? Colors.teal : Colors.border,
        overflow: 'hidden',
      }}>
        <HabitCheckIn
          habit={habit}
          completedToday={completedToday}
          streakCount={streakCount}
        />

        {completedToday && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 18, paddingBottom: 14 }}>
            {Array.from({ length: 7 }, (_, i) => (
              <View
                key={i}
                style={{
                  width: 8, height: 8, borderRadius: 4,
                  backgroundColor: i < (streakCount % 7) + 1 ? Colors.teal : `${Colors.teal}28`,
                }}
              />
            ))}
            <Text style={{ fontSize: 10, color: Colors.teal, fontFamily: 'DMSans-Regular', marginLeft: 4 }}>
              {streakCount}d
            </Text>
          </View>
        )}

        <Pressable
          onPress={() => setExpanded(v => !v)}
          style={{ paddingHorizontal: 16, paddingBottom: expanded ? 0 : 12, paddingTop: completedToday ? 0 : 4 }}
        >
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12 }}>
            {expanded ? 'Hide history ▲' : 'View history ▼'}
          </Text>
        </Pressable>

        {expanded && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8 }}>
            <Pressable
              onPress={() => {
                Alert.alert(
                  'Remove habit',
                  `Remove "${habit.name}"? Your history will be kept.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => deleteHabit(habit.id) },
                  ],
                );
              }}
            >
              <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13 }}>Remove habit</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

export default function HabitsScreen() {
  const { data: habits, isLoading } = useHabits();
  const [showCreate, setShowCreate] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      return () => setShowCreate(false);
    }, [])
  );

  const total = habits?.length ?? 0;
  const canAddMore = total < 5;

  // Estimate completed count from habits (rough — actual count from streakData per card)
  const completedCount = 0;
  const ringR = 28, ringCIRC = 2 * Math.PI * ringR;
  const ringPct = total > 0 ? completedCount / total : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6 }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 28, letterSpacing: -0.5 }}>Habits</Text>
          {canAddMore && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowCreate(true);
              }}
              style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1,
                backgroundColor: Colors.orange,
                borderRadius: 999,
                paddingHorizontal: 18,
                paddingVertical: 10,
              })}
            >
              <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 14 }}>+ Add</Text>
            </Pressable>
          )}
        </View>

        {/* Completion ring header */}
        {total > 0 && (
          <View style={{ backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 18 }}>
            <Svg width={72} height={72} viewBox="0 0 72 72">
              <Circle cx={36} cy={36} r={ringR} fill="none" stroke={Colors.surface2} strokeWidth={7} />
              <Circle
                cx={36} cy={36} r={ringR}
                fill="none"
                stroke={Colors.teal}
                strokeWidth={7}
                strokeLinecap="round"
                strokeDasharray={`${ringPct * ringCIRC} ${ringCIRC}`}
                rotation={-90}
                originX={36}
                originY={36}
              />
            </Svg>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontFamily: 'DMSans-Bold', color: Colors.text, marginBottom: 4 }}>
                {total} habits tracked
              </Text>
              <Text style={{ fontSize: 13, color: Colors.muted, fontFamily: 'DMSans-Regular', lineHeight: 18 }}>
                Start tiny — one habit beats zero.
              </Text>
            </View>
          </View>
        )}

        {/* Habit cards */}
        {habits && habits.length > 0 ? (
          <View style={{ gap: 12 }}>
            {habits.map(habit => (
              <HabitCard key={habit.id} habit={habit} totalHabits={total} completedCount={completedCount} />
            ))}
          </View>
        ) : !isLoading ? (
          <View style={{ backgroundColor: Colors.surface, borderRadius: 20, padding: 32, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: Colors.border }}>
            <Text style={{ fontSize: 40 }}>🌱</Text>
            <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 17 }}>No habits yet</Text>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14, textAlign: 'center' }}>
              Add up to 5 habits to track. Start tiny — one habit beats zero.
            </Text>
            <Pressable
              onPress={() => setShowCreate(true)}
              style={{ backgroundColor: Colors.orange, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 12, marginTop: 4 }}
            >
              <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 15 }}>Add your first habit</Text>
            </Pressable>
          </View>
        ) : null}

        {!canAddMore && (
          <View style={{ backgroundColor: Colors.surface2, borderRadius: 16, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center', borderWidth: 1, borderColor: Colors.border }}>
            <Text style={{ fontSize: 18 }}>💡</Text>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13, flex: 1 }}>
              Free tier supports 5 habits. Remove one to add another.
            </Text>
          </View>
        )}
      </ScrollView>

      {showCreate && <CreateHabitSheet onClose={() => setShowCreate(false)} />}
    </SafeAreaView>
  );
}
