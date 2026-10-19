import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';
import {
  useHabits,
  useHabitStreak,
  useHabitSummary,
  useDeleteHabit,
  useLogHabit,
  useUnlogHabit,
  type Habit,
} from '@/hooks/useHabits';
import { confirmAction } from '@/lib/confirm';
import { dayLabel } from '@/lib/date';
import { HabitCheckIn } from '@/components/habits/HabitCheckIn';
import { CreateHabitSheet } from '@/components/habits/CreateHabitSheet';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { Colors } from '@/constants/colors';

function HabitCard({ habit, onEdit }: { habit: Habit; onEdit: (habit: Habit) => void }) {
  const { data: streakData } = useHabitStreak(habit.id);
  const { mutate: deleteHabit } = useDeleteHabit();
  const { mutate: logHabit } = useLogHabit();
  const { mutate: unlogHabit } = useUnlogHabit();
  const [expanded, setExpanded] = useState(false);

  const completedToday = streakData?.completedToday ?? false;
  const streakCount = streakData?.streakCount ?? 0;
  const grid = streakData?.grid ?? [];

  // Tap a day in the history to add or clear a check-in (up to 30 days back)
  function toggleDay(date: string, completed: boolean) {
    Haptics.selectionAsync();
    if (completed) unlogHabit({ habitId: habit.id, date });
    else logHabit({ habitId: habit.id, date });
  }

  async function handleRemove() {
    const ok = await confirmAction({
      title: 'Remove habit',
      message: `Remove "${habit.name}"? Your history will be kept.`,
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (ok) deleteHabit(habit.id);
  }

  return (
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

      {!expanded && grid.length > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 18, paddingBottom: 6 }}>
          {/* Last 7 days, oldest first */}
          {grid.slice(-7).map((day) => (
            <View
              key={day.date}
              style={{
                width: 8, height: 8, borderRadius: 4,
                backgroundColor: day.completed ? Colors.teal : `${Colors.teal}28`,
              }}
            />
          ))}
        </View>
      )}

      <Pressable
        onPress={() => setExpanded(v => !v)}
        accessibilityRole="button"
        style={{ paddingHorizontal: 16, paddingBottom: expanded ? 0 : 12, paddingTop: 6 }}
      >
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12 }}>
          {expanded ? 'Hide history ▲' : 'History & edit ▼'}
        </Text>
      </Pressable>

      {expanded && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 10, gap: 14 }}>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12 }}>
            Last 30 days. Tap a day to add or clear a check-in.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {grid.map((day) => (
              <Pressable
                key={day.date}
                onPress={() => toggleDay(day.date, day.completed)}
                accessibilityRole="checkbox"
                aria-checked={day.completed}
                accessibilityLabel={`${habit.name}, ${dayLabel(day.date)}`}
                style={{
                  width: 30, height: 30, borderRadius: 8,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: day.completed ? Colors.teal : Colors.surface2,
                  borderWidth: 1,
                  borderColor: day.completed ? Colors.teal : Colors.border,
                }}
              >
                <Text style={{ fontSize: 11, fontFamily: 'JetBrainsMono-Regular', color: day.completed ? '#0F0F0F' : Colors.muted }}>
                  {Number(day.date.slice(8))}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 20 }}>
            <Pressable onPress={() => onEdit(habit)} accessibilityRole="button" hitSlop={8}>
              <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 13 }}>Edit habit</Text>
            </Pressable>
            <Pressable onPress={handleRemove} accessibilityRole="button" hitSlop={8}>
              <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13 }}>Remove habit</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

export default function HabitsScreen() {
  const { data: habits, isLoading } = useHabits();
  const [showCreate, setShowCreate] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const { refreshing, onRefresh } = usePullToRefresh([['habits'], ['habit-streaks']]);

  useFocusEffect(
    React.useCallback(() => {
      return () => {
        setShowCreate(false);
        setEditingHabit(null);
      };
    }, [])
  );

  const total = habits?.length ?? 0;
  // Mirrors the backend's MAX_ACTIVE_HABITS
  const canAddMore = total < 20;

  const { data: summary } = useHabitSummary();
  const completedCount = summary?.todayDone.size ?? 0;
  const ringR = 28, ringCIRC = 2 * Math.PI * ringR;
  const ringPct = total > 0 ? completedCount / total : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 120 }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.orange} />}>
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
                {completedCount} of {total} done today
              </Text>
              <Text style={{ fontSize: 13, color: Colors.muted, fontFamily: 'DMSans-Regular', lineHeight: 18 }}>
                {completedCount === 0 ? 'Start tiny — one habit beats zero.' : completedCount >= total ? 'All done for today! 🎉' : 'Keep the momentum going.'}
              </Text>
            </View>
          </View>
        )}

        {/* Habit cards */}
        {habits && habits.length > 0 ? (
          <View style={{ gap: 12 }}>
            {habits.map(habit => (
              <HabitCard key={habit.id} habit={habit} onEdit={setEditingHabit} />
            ))}
          </View>
        ) : !isLoading ? (
          <View style={{ backgroundColor: Colors.surface, borderRadius: 20, padding: 32, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: Colors.border }}>
            <Text style={{ fontSize: 40 }}>🌱</Text>
            <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 17 }}>No habits yet</Text>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14, textAlign: 'center' }}>
              Start tiny — one habit beats zero.
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
              You're tracking 20 habits, the most at once. Remove one to add another.
            </Text>
          </View>
        )}
      </ScrollView>

      {showCreate && <CreateHabitSheet onClose={() => setShowCreate(false)} />}
      {editingHabit && <CreateHabitSheet key={editingHabit.id} editing={editingHabit} onClose={() => setEditingHabit(null)} />}
    </SafeAreaView>
  );
}
