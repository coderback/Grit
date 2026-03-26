import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  useHabits,
  useHabitStreak,
  useDeleteHabit,
  type Habit,
} from '@/hooks/useHabits';
import { HabitCheckIn } from '@/components/habits/HabitCheckIn';
import { HabitStreak } from '@/components/habits/HabitStreak';
import { CreateHabitSheet } from '@/components/habits/CreateHabitSheet';
import { Colors } from '@/constants/colors';

/** Single habit card — loads its own streak, shows grid on expand */
function HabitCard({ habit }: { habit: Habit }) {
  const [expanded, setExpanded] = useState(false);
  const { data: streakData } = useHabitStreak(habit.id);
  const { mutate: deleteHabit } = useDeleteHabit();

  const completedToday = streakData?.grid.at(-1)?.completed ?? false;
  const streakCount = streakData?.streakCount ?? 0;

  return (
    <View style={{
      backgroundColor: Colors.surface,
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 1.5,
      borderColor: completedToday ? Colors.teal : Colors.border,
    }}>
      <HabitCheckIn
        habit={habit}
        completedToday={completedToday}
        streakCount={streakCount}
      />

      {/* Expand toggle */}
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingBottom: expanded ? 0 : 12,
          paddingTop: 4,
        }}
      >
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12 }}>
          {expanded ? 'Hide history' : 'View history'}
        </Text>
        <Text style={{ color: Colors.muted, fontSize: 14 }}>
          {expanded ? '▲' : '▼'}
        </Text>
      </Pressable>

      {/* Streak grid (expanded) */}
      {expanded && streakData && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8, gap: 12 }}>
          <HabitStreak grid={streakData.grid} streakCount={streakData.streakCount} />

          <Pressable
            onPress={() => {
              Alert.alert(
                'Remove habit',
                `Remove "${habit.name}"? Your history will be kept.`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () => deleteHabit(habit.id),
                  },
                ],
              );
            }}
          >
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13 }}>
              Remove habit
            </Text>
          </Pressable>
        </View>
      )}
    </View>
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

  const canAddMore = (habits?.length ?? 0) < 5;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 100 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 24 }}>
              Habits
            </Text>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13, marginTop: 2 }}>
              {habits?.length ?? 0} / 5 active
            </Text>
          </View>
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
              <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 14 }}>
                + Add
              </Text>
            </Pressable>
          )}
        </View>

        {/* Habit cards */}
        {habits && habits.length > 0 ? (
          <View style={{ gap: 12 }}>
            {habits.map((habit) => (
              <HabitCard key={habit.id} habit={habit} />
            ))}
          </View>
        ) : !isLoading ? (
          <View style={{
            backgroundColor: Colors.surface,
            borderRadius: 20,
            padding: 32,
            alignItems: 'center',
            gap: 12,
            borderWidth: 1,
            borderColor: Colors.border,
          }}>
            <Text style={{ fontSize: 40 }}>🌱</Text>
            <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 17 }}>
              No habits yet
            </Text>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14, textAlign: 'center' }}>
              Add up to 5 habits to track. Start tiny — one habit beats zero.
            </Text>
            <Pressable
              onPress={() => setShowCreate(true)}
              style={{
                backgroundColor: Colors.orange,
                borderRadius: 999,
                paddingHorizontal: 20,
                paddingVertical: 12,
                marginTop: 4,
              }}
            >
              <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 15 }}>
                Add your first habit
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Free tier cap note */}
        {!canAddMore && (
          <View style={{
            backgroundColor: Colors.surface2,
            borderRadius: 16,
            padding: 14,
            flexDirection: 'row',
            gap: 10,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: Colors.border,
          }}>
            <Text style={{ fontSize: 18 }}>💡</Text>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13, flex: 1 }}>
              Free tier supports 5 habits. Remove one to add another.
            </Text>
          </View>
        )}
      </ScrollView>

      {showCreate && (
        <CreateHabitSheet onClose={() => setShowCreate(false)} />
      )}
    </SafeAreaView>
  );
}
