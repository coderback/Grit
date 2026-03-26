import React from 'react';
import {
  View, Text, ScrollView, Pressable, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NudgeCard } from '@/components/coach/NudgeCard';
import { useFoodLogsForDate } from '@/hooks/useFoodLog';
import { useWeeklySummary } from '@/hooks/useActivityLog';
import { useHabits, useTodayCompletions } from '@/hooks/useHabits';
import { api } from '@/lib/api';
import { Colors } from '@/constants/colors';

interface BackendUser {
  id: string;
  displayName: string;
  calorieGoal: number;
  primaryGoal: string;
}

function useMe() {
  return useQuery<BackendUser>({
    queryKey: ['me'],
    queryFn: () => api.get('/users/me').then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function CalorieCard({ calories, goal }: { calories: number; goal: number }) {
  const pct = Math.min(calories / goal, 1);
  const remaining = goal - calories;

  return (
    <View style={{
      backgroundColor: Colors.surface,
      borderRadius: 20,
      padding: 20,
      gap: 14,
      borderWidth: 1,
      borderColor: Colors.border,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Calories today
        </Text>
        <Pressable onPress={() => router.push('/(tabs)/food')}>
          <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Medium', fontSize: 13 }}>
            Log food →
          </Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
        <Text style={{
          color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 42, letterSpacing: -1,
        }}>
          {Math.round(calories).toLocaleString()}
        </Text>
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 15 }}>
          / {goal.toLocaleString()} kcal
        </Text>
      </View>
      <View style={{ height: 6, backgroundColor: Colors.surface2, borderRadius: 999, overflow: 'hidden' }}>
        <View style={{
          height: '100%',
          width: `${pct * 100}%`,
          backgroundColor: Colors.orange,
          borderRadius: 999,
        }} />
      </View>
      <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13 }}>
        {remaining >= 0
          ? `${Math.round(remaining).toLocaleString()} kcal remaining`
          : `${Math.round(Math.abs(remaining)).toLocaleString()} kcal over goal`}
      </Text>
    </View>
  );
}

function StatMiniCard({
  emoji, label, value, sub, onPress,
}: { emoji: string; label: string; value: string; sub?: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        opacity: pressed ? 0.8 : 1,
        backgroundColor: Colors.surface,
        borderRadius: 20,
        padding: 18,
        gap: 8,
        borderWidth: 1,
        borderColor: Colors.border,
      })}
    >
      <Text style={{ fontSize: 24 }}>{emoji}</Text>
      <Text style={{
        color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 26, letterSpacing: -0.5,
      }}>
        {value}
      </Text>
      <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {label}
      </Text>
      {sub && (
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12 }}>
          {sub}
        </Text>
      )}
    </Pressable>
  );
}

export default function HomeScreen() {
  const qc = useQueryClient();
  const today = todayStr();

  const { data: me } = useMe();
  const { data: foodLogs } = useFoodLogsForDate(today);
  const { data: weeklySummary } = useWeeklySummary();
  const { data: habits } = useHabits();
  const { data: todayDone } = useTodayCompletions(habits ?? []);

  const totalCalories = foodLogs?.totals.calories ?? 0;
  const calorieGoal = me?.calorieGoal ?? 2000;

  const todayActivity = weeklySummary?.days.find((d) => d.date === today);
  const activeMinutes = todayActivity?.activeMinutes ?? 0;

  const habitCount = habits?.length ?? 0;
  const doneCount = todayDone?.size ?? 0;

  function refresh() {
    qc.invalidateQueries({ queryKey: ['me'] });
    qc.invalidateQueries({ queryKey: ['food-logs', today] });
    qc.invalidateQueries({ queryKey: ['activity-week'] });
    qc.invalidateQueries({ queryKey: ['habits'] });
    qc.invalidateQueries({ queryKey: ['ai-nudge'] });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 110 }}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refresh} tintColor={Colors.orange} />
        }
      >
        {/* Greeting */}
        <View style={{ gap: 2, paddingVertical: 8 }}>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14 }}>
            {greeting()},
          </Text>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 30, letterSpacing: -0.5 }}>
            {me?.displayName ?? '…'} 👊
          </Text>
        </View>

        {/* AI nudge */}
        <NudgeCard />

        {/* Calories */}
        <CalorieCard calories={totalCalories} goal={calorieGoal} />

        {/* Activity + Habits row */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <StatMiniCard
            emoji="🔥"
            label="Active mins"
            value={String(activeMinutes)}
            sub="today"
            onPress={() => router.push('/(tabs)/activity')}
          />
          <StatMiniCard
            emoji="🎯"
            label="Habits"
            value={habitCount > 0 ? `${doneCount}/${habitCount}` : '—'}
            sub="done today"
            onPress={() => router.push('/(tabs)/habits')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
