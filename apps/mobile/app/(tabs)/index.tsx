import React from 'react';
import {
  View, Text, ScrollView, Pressable, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Svg, {
  Circle, Defs, LinearGradient, Stop, Line, G,
} from 'react-native-svg';
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

// ── CalorieRing ──────────────────────────────────────────────────────────────

function CalorieRing({ eaten, goal, burned = 0 }: { eaten: number; goal: number; burned?: number }) {
  const net = eaten - burned;
  const remaining = Math.max(0, goal - net);
  const pct = Math.min(1, net / Math.max(goal, 1));
  const isOver = net > goal;

  const R = 88, CX = 110, CY = 110;
  const CIRC = 2 * Math.PI * R;
  const filled = pct * CIRC;

  const angle = (-90 + pct * 360) * (Math.PI / 180);
  const dotX = CX + R * Math.cos(angle);
  const dotY = CY + R * Math.sin(angle);

  const tickAngles = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

  return (
    <View style={{ width: 220, height: 220, flexShrink: 0, position: 'relative' }}>
      <Svg width={220} height={220} viewBox="0 0 220 220" style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={isOver ? Colors.error : Colors.orange} />
            <Stop offset="100%" stopColor={isOver ? '#FF8A80' : '#FF8C5A'} />
          </LinearGradient>
        </Defs>
        {/* Track */}
        <Circle cx={CX} cy={CY} r={R} fill="none" stroke={Colors.surface2} strokeWidth={13} />
        {/* Tick marks */}
        {tickAngles.map((deg) => {
          const rad = (deg - 90) * Math.PI / 180;
          const x1 = CX + (R - 8) * Math.cos(rad);
          const y1 = CY + (R - 8) * Math.sin(rad);
          const x2 = CX + (R + 2) * Math.cos(rad);
          const y2 = CY + (R + 2) * Math.sin(rad);
          return <Line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke={Colors.surface3} strokeWidth={1} />;
        })}
        {/* Progress arc */}
        <Circle
          cx={CX} cy={CY} r={R}
          fill="none"
          stroke={`url(#ringGrad)`}
          strokeWidth={13}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${CIRC}`}
          rotation={-90}
          originX={CX}
          originY={CY}
        />
        {/* Dot at progress head */}
        {pct > 0.01 && pct < 0.99 && (
          <Circle
            cx={dotX} cy={dotY} r={7}
            fill={isOver ? Colors.error : Colors.orange}
            stroke={Colors.dark}
            strokeWidth={2.5}
          />
        )}
      </Svg>
      {/* Center text */}
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        alignItems: 'center', justifyContent: 'center', gap: 2,
      }}>
        <Text style={{
          fontSize: 11, color: Colors.muted,
          fontFamily: 'DMSans-Medium',
          letterSpacing: 0.8, textTransform: 'uppercase',
        }}>
          {isOver ? 'over goal' : 'remaining'}
        </Text>
        <Text style={{
          fontSize: remaining >= 1000 ? 36 : 42,
          fontFamily: 'JetBrainsMono-Regular',
          color: isOver ? Colors.error : Colors.text,
          lineHeight: remaining >= 1000 ? 42 : 48,
          letterSpacing: -2,
        }}>
          {Math.round(remaining).toLocaleString()}
        </Text>
        <Text style={{ fontSize: 13, color: Colors.muted, fontFamily: 'DMSans-Regular' }}>kcal</Text>
      </View>
    </View>
  );
}

// ── MacroBar ─────────────────────────────────────────────────────────────────

function MacroBar({ value, goal, color }: { value: number; goal: number; color: string }) {
  const pct = Math.min(1, value / Math.max(goal, 1));
  return (
    <View style={{ height: 5, backgroundColor: Colors.surface2, borderRadius: 999, overflow: 'hidden', marginTop: 6 }}>
      <View style={{ height: '100%', width: `${pct * 100}%`, backgroundColor: color, borderRadius: 999 }} />
    </View>
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

  const eaten = foodLogs?.totals.calories ?? 0;
  const proteinG = foodLogs?.totals.proteinG ?? 0;
  const carbsG = foodLogs?.totals.carbsG ?? 0;
  const fatG = foodLogs?.totals.fatG ?? 0;
  const calorieGoal = me?.calorieGoal ?? 2000;

  const todayActivity = weeklySummary?.days.find((d) => d.date === today);
  const activeMinutes = todayActivity?.activeMinutes ?? 0;
  const activePct = Math.min(1, activeMinutes / 60);

  const habitCount = habits?.length ?? 0;
  const doneCount = todayDone?.size ?? 0;

  // Macro goals derived from calorie goal (30/40/30 split)
  const proteinGoal = Math.round((calorieGoal * 0.30) / 4);
  const carbsGoal = Math.round((calorieGoal * 0.40) / 4);
  const fatGoal = Math.round((calorieGoal * 0.30) / 9);

  const macros = [
    { label: 'Protein', val: Math.round(proteinG), goal: proteinGoal, color: Colors.blue },
    { label: 'Carbs', val: Math.round(carbsG), goal: carbsGoal, color: Colors.orange },
    { label: 'Fat', val: Math.round(fatG), goal: fatGoal, color: Colors.teal },
  ];

  const recentLogs = (foodLogs?.logs ?? []).slice(0, 3);

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
        contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 110 }}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refresh} tintColor={Colors.orange} />
        }
      >
        {/* Greeting */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6 }}>
          <View>
            <Text style={{ fontSize: 14, color: Colors.muted, fontFamily: 'DMSans-Regular' }}>
              {greeting()},
            </Text>
            <Text style={{ fontSize: 28, fontFamily: 'DMSans-Bold', color: Colors.text, letterSpacing: -0.5, lineHeight: 34 }}>
              {me?.displayName ?? '…'} 👊
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <View style={{
              width: 40, height: 40, borderRadius: 12,
              backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Line x1="3" y1="12" x2="21" y2="12" stroke={Colors.text} strokeWidth="1.8" strokeLinecap="round" />
                <Line x1="3" y1="6" x2="21" y2="6" stroke={Colors.text} strokeWidth="1.8" strokeLinecap="round" />
                <Line x1="3" y1="18" x2="21" y2="18" stroke={Colors.text} strokeWidth="1.8" strokeLinecap="round" />
              </Svg>
            </View>
          </View>
        </View>

        {/* AI Nudge */}
        <NudgeCard />

        {/* Hero calorie card */}
        <View style={{ backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, padding: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <Text style={{ fontSize: 12, fontFamily: 'DMSans-Medium', color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Calories today
            </Text>
            <Pressable onPress={() => router.push('/(tabs)/food')}>
              <Text style={{ fontSize: 13, fontFamily: 'DMSans-Medium', color: Colors.orange }}>Log food →</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <CalorieRing eaten={eaten} goal={calorieGoal} />
            <View style={{ flex: 1, gap: 12 }}>
              {[
                { label: 'Goal', val: calorieGoal.toLocaleString(), color: Colors.muted },
                { label: 'Eaten', val: Math.round(eaten).toLocaleString(), color: Colors.text },
                { label: 'Burned', val: '0', color: Colors.teal },
              ].map((row) => (
                <View key={row.label}>
                  <Text style={{ fontSize: 11, color: Colors.muted, letterSpacing: 0.7, textTransform: 'uppercase', fontFamily: 'DMSans-Medium', marginBottom: 1 }}>
                    {row.label}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                    <Text style={{ fontSize: 18, fontFamily: 'JetBrainsMono-Regular', color: row.color }}>{row.val}</Text>
                    <Text style={{ fontSize: 11, color: Colors.muted, fontFamily: 'DMSans-Regular' }}>kcal</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Macro row */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {macros.map((m) => (
            <View key={m.label} style={{
              flex: 1, backgroundColor: Colors.surface, borderRadius: 16,
              borderWidth: 1, borderColor: Colors.border, padding: 14,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2, marginBottom: 2 }}>
                <Text style={{ fontSize: 22, fontFamily: 'JetBrainsMono-Regular', color: m.color, lineHeight: 26 }}>{m.val}</Text>
                <Text style={{ fontSize: 11, color: m.color, fontFamily: 'DMSans-Regular' }}>g</Text>
              </View>
              <Text style={{ fontSize: 12, fontFamily: 'DMSans-Medium', color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                {m.label}
              </Text>
              <MacroBar value={m.val} goal={m.goal} color={m.color} />
              <Text style={{ fontSize: 10, color: `${Colors.muted}80`, fontFamily: 'DMSans-Regular', marginTop: 4 }}>
                {m.goal}g goal
              </Text>
            </View>
          ))}
        </View>

        {/* Stats bento */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            onPress={() => router.push('/(tabs)/activity')}
            style={({ pressed }) => ({
              flex: 1, backgroundColor: Colors.surface, borderRadius: 20,
              borderWidth: 1, borderColor: Colors.border, padding: 16,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ fontSize: 11, color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.7, fontFamily: 'DMSans-Medium', marginBottom: 6 }}>
              Active mins
            </Text>
            <Text style={{ fontSize: 32, fontFamily: 'JetBrainsMono-Regular', color: Colors.text, lineHeight: 38, marginBottom: 6 }}>
              {activeMinutes}
            </Text>
            <View style={{ height: 5, backgroundColor: Colors.surface2, borderRadius: 999, overflow: 'hidden' }}>
              <View style={{ height: '100%', width: `${activePct * 100}%`, backgroundColor: Colors.orange, borderRadius: 999 }} />
            </View>
            <Text style={{ fontSize: 11, color: Colors.muted, fontFamily: 'DMSans-Regular', marginTop: 4 }}>Goal: 60 min</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/(tabs)/habits')}
            style={({ pressed }) => ({
              flex: 1, backgroundColor: Colors.surface, borderRadius: 20,
              borderWidth: 1, borderColor: Colors.border, padding: 16,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ fontSize: 11, color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.7, fontFamily: 'DMSans-Medium', marginBottom: 6 }}>
              Habits
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 1, marginBottom: 8 }}>
              <Text style={{ fontSize: 32, fontFamily: 'JetBrainsMono-Regular', color: Colors.text, lineHeight: 38 }}>{doneCount}</Text>
              <Text style={{ fontSize: 18, fontFamily: 'JetBrainsMono-Regular', color: Colors.muted }}>/{habitCount}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {Array.from({ length: Math.min(habitCount, 4) }, (_, i) => (
                <View key={i} style={{
                  width: 10, height: 10, borderRadius: 5,
                  backgroundColor: i < doneCount ? Colors.teal : Colors.surface3,
                }} />
              ))}
            </View>
            <Text style={{ fontSize: 11, color: Colors.teal, fontFamily: 'DMSans-Regular', marginTop: 4 }}>
              {doneCount === habitCount && habitCount > 0 ? 'All done! 🔥' : 'Keep going'}
            </Text>
          </Pressable>
        </View>

        {/* Meals preview */}
        {(recentLogs.length > 0 || true) && (
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ fontSize: 12, fontFamily: 'DMSans-Medium', color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Today's meals
              </Text>
              <Pressable onPress={() => router.push('/(tabs)/food')}>
                <Text style={{ fontSize: 13, color: Colors.orange, fontFamily: 'DMSans-Medium' }}>See all →</Text>
              </Pressable>
            </View>
            <View style={{ gap: 8 }}>
              {recentLogs.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => router.push('/(tabs)/food')}
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? Colors.surface2 : Colors.surface,
                    borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
                    padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
                  })}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontFamily: 'DMSans-Bold', color: Colors.text }}>{item.name}</Text>
                    {item.brand && (
                      <Text style={{ fontSize: 12, color: Colors.muted, fontFamily: 'DMSans-Regular', marginTop: 2 }}>{item.brand}</Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 16, fontFamily: 'JetBrainsMono-Regular', color: Colors.text }}>{Math.round(item.calories)}</Text>
                    <Text style={{ fontSize: 10, color: Colors.muted, fontFamily: 'DMSans-Regular' }}>kcal</Text>
                  </View>
                  <Svg width={8} height={14} viewBox="0 0 8 14">
                    <Line x1="1" y1="1" x2="7" y2="7" stroke={Colors.muted} strokeWidth="1.8" strokeLinecap="round" />
                    <Line x1="7" y1="7" x2="1" y2="13" stroke={Colors.muted} strokeWidth="1.8" strokeLinecap="round" />
                  </Svg>
                </Pressable>
              ))}
              {/* Log dinner prompt */}
              <Pressable
                onPress={() => router.push('/(tabs)/food')}
                style={({ pressed }) => ({
                  backgroundColor: 'transparent', borderRadius: 14,
                  borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed',
                  padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 8, opacity: pressed ? 0.7 : 1,
                })}
              >
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Line x1="12" y1="5" x2="12" y2="19" stroke={Colors.orange} strokeWidth="2" strokeLinecap="round" />
                  <Line x1="5" y1="12" x2="19" y2="12" stroke={Colors.orange} strokeWidth="2" strokeLinecap="round" />
                </Svg>
                <Text style={{ fontSize: 14, color: Colors.orange, fontFamily: 'DMSans-Medium' }}>Log a meal</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
