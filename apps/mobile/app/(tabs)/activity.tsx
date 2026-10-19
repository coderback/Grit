import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle, Line, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import { useWeeklySummary, type ActivityLog } from '@/hooks/useActivityLog';
import { useFoodWeek } from '@/hooks/useFoodLog';
import { useHabits, useHabitSummary } from '@/hooks/useHabits';
import { useMe } from '@/hooks/useMe';
import { ACTIVITY_LABELS, LogActivitySheet } from '@/components/activity/LogActivitySheet';
import { DateNavigator } from '@/components/ui/DateNavigator';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { Colors } from '@/constants/colors';
import { addDaysStr, dayLabel, localDateStr, weekLabel, weekStartStr } from '@/lib/date';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function LineChart({
  data,
  goalVal,
  color,
  gradId,
}: {
  data: { label: string; v: number; today?: boolean }[];
  goalVal: number;
  color: string;
  gradId: string;
}) {
  const W = 300, H = 90;
  const vals = data.map(d => d.v);
  const maxV = Math.max(goalVal * 1.15, ...vals);
  const minV = 0;
  const toX = (i: number) => (i / (data.length - 1)) * W;
  const toY = (v: number) => H - ((v - minV) / (maxV - minV)) * H;

  const pts = data.map((d, i) => ({ x: toX(i), y: toY(d.v) }));
  const goalY = toY(goalVal);

  let linePath = '';
  pts.forEach((pt, i) => {
    if (i === 0) { linePath = `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`; return; }
    const prev = pts[i - 1];
    const cpx = (prev.x + pt.x) / 2;
    linePath += ` C ${cpx.toFixed(1)} ${prev.y.toFixed(1)}, ${cpx.toFixed(1)} ${pt.y.toFixed(1)}, ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  });
  const areaPath = `${linePath} L ${W} ${H} L 0 ${H} Z`;

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <Stop offset="85%" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Line x1="0" y1={goalY} x2={W} y2={goalY} stroke={Colors.muted} strokeWidth="1" strokeDasharray="4,4" opacity={0.5} />
      <Path d={areaPath} fill={`url(#${gradId})`} />
      <Path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((pt, i) => {
        const isToday = data[i]?.today;
        return (
          <G key={i}>
            <Circle
              cx={pt.x} cy={pt.y}
              r={isToday ? 5 : 3.5}
              fill={isToday ? color : Colors.surface}
              stroke={color}
              strokeWidth={isToday ? 0 : 2}
            />
            {isToday && <Circle cx={pt.x} cy={pt.y} r={9} fill={color} opacity={0.18} />}
          </G>
        );
      })}
    </Svg>
  );
}

export default function ActivityScreen() {
  const today = localDateStr();
  const thisWeek = weekStartStr(today);
  const [week, setWeek] = useState(thisWeek);
  const isThisWeek = week === thisWeek;
  const { data: weekly } = useWeeklySummary(isThisWeek ? undefined : week);
  const { data: foodWeek } = useFoodWeek(isThisWeek ? undefined : week);
  const [editingWorkout, setEditingWorkout] = useState<ActivityLog | null>(null);
  const { data: me } = useMe();
  const { data: habits } = useHabits();
  const { data: habitSummary } = useHabitSummary();
  const [showSheet, setShowSheet] = useState(false);
  const { refreshing, onRefresh } = usePullToRefresh([['activity-week'], ['food-week'], ['me'], ['habits'], ['habit-streaks']]);

  useFocusEffect(
    React.useCallback(() => {
      return () => {
        setShowSheet(false);
        setEditingWorkout(null);
      };
    }, [])
  );

  const actData = (weekly?.days ?? []).map((d, i) => ({
    label: DAY_LABELS[i],
    v: d.activeMinutes,
    today: d.date === today,
  }));
  // Bars scale to the daily active-minutes goal, or to the longest day if that's more
  const barScale = Math.max(me?.activeMinutesGoal ?? 60, ...actData.map(d => d.v));
  const totalMins = weekly?.totals.activeMinutes ?? 0;
  const activeDays = actData.filter(d => d.v > 0).length;

  // Calories this week, averaged over the days that have any food logged
  const calorieGoal = me?.calorieGoal ?? 2000;
  const calData = (foodWeek?.days ?? []).map((d, i) => ({
    label: DAY_LABELS[i],
    v: Math.round(d.calories),
    today: d.date === today,
  }));
  const loggedDays = (foodWeek?.days ?? []).filter(d => d.entries > 0);
  const avgCalories = loggedDays.length
    ? Math.round(loggedDays.reduce((s, d) => s + d.calories, 0) / loggedDays.length)
    : 0;
  // Negative means eaten under goal (a deficit)
  const weeklyBalance = Math.round(loggedDays.reduce((s, d) => s + d.calories - calorieGoal, 0));
  const balancePct = loggedDays.length
    ? Math.round((Math.abs(weeklyBalance) / (calorieGoal * loggedDays.length)) * 100)
    : 0;

  // Habit history: last 30 days, padded so columns line up Mon–Sun
  const habitCount = habits?.length ?? 0;
  const streak = habitSummary?.maxStreak ?? 0;
  const historyDays = habitSummary?.days ?? [];
  const leadingBlanks = historyDays.length
    ? (new Date(`${historyDays[0].date}T00:00:00Z`).getUTCDay() + 6) % 7
    : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.orange} />}>

        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingTop: 6 }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 28, letterSpacing: -0.5 }}>
            Analytics
          </Text>
        </View>

        {/* Week picker */}
        <View style={{ marginBottom: 16 }}>
          <DateNavigator
            label={isThisWeek ? 'This week' : weekLabel(week)}
            onPrev={() => setWeek((w) => addDaysStr(w, -7))}
            onNext={() => setWeek((w) => addDaysStr(w, 7))}
            canGoNext={!isThisWeek}
            onReset={isThisWeek ? undefined : () => setWeek(thisWeek)}
          />
        </View>

        {/* Calorie trend card */}
        <View style={{ backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, padding: 18, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
            <View>
              <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 16, marginBottom: 2 }}>
                Weekly calories
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <Text style={{ fontSize: 28, fontFamily: 'JetBrainsMono-Regular', color: Colors.text, letterSpacing: -1 }}>{avgCalories.toLocaleString()}</Text>
                <Text style={{ fontSize: 12, color: Colors.muted, fontFamily: 'DMSans-Regular' }}>avg / day</Text>
              </View>
            </View>
            {loggedDays.length > 0 && (
              <View style={{ backgroundColor: `${Colors.teal}20`, borderWidth: 1, borderColor: `${Colors.teal}50`, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontSize: 12, fontFamily: 'DMSans-Bold', color: Colors.teal }}>
                  {weeklyBalance <= 0 ? '▼' : '▲'} {balancePct}% {weeklyBalance <= 0 ? 'deficit' : 'surplus'}
                </Text>
              </View>
            )}
          </View>
          {calData.length > 0 && <LineChart data={calData} goalVal={calorieGoal} color={Colors.orange} gradId="calGrad" />}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            {calData.map(d => (
              <Text key={d.label} style={{ flex: 1, fontSize: 10, color: d.today ? Colors.orange : Colors.muted, fontFamily: d.today ? 'DMSans-Bold' : 'DMSans-Regular', textAlign: 'center' }}>
                {d.label}
              </Text>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 14, marginTop: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 20, height: 2, backgroundColor: Colors.orange, borderRadius: 1 }} />
              <Text style={{ fontSize: 11, color: Colors.muted, fontFamily: 'DMSans-Regular' }}>Actual</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 20, height: 1, backgroundColor: Colors.muted, borderRadius: 1 }} />
              <Text style={{ fontSize: 11, color: Colors.muted, fontFamily: 'DMSans-Regular' }}>Goal {calorieGoal.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {/* Activity bar chart */}
        <View style={{ backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, padding: 18, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
            <View>
              <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 16, marginBottom: 2 }}>Activity</Text>
              <Text style={{ fontSize: 12, color: Colors.muted, fontFamily: 'DMSans-Regular' }}>minutes per day</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
              <Text style={{ fontSize: 22, fontFamily: 'JetBrainsMono-Regular', color: Colors.teal }}>{totalMins}</Text>
              <Text style={{ fontSize: 11, color: Colors.muted, fontFamily: 'DMSans-Regular' }}>min total</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end', height: 80 }}>
            {actData.map((d, i) => {
              const hPct = d.v > 0 ? Math.max(0.08, d.v / barScale) : 0.04;
              const barH = Math.round(hPct * 65);
              return (
                <View key={i} style={{ flex: 1, alignItems: 'center', gap: 5, height: '100%', justifyContent: 'flex-end' }}>
                  <View style={{ position: 'relative', width: '100%', alignItems: 'center' }}>
                    {d.v > 0 && (
                      <Text style={{ fontSize: 9, color: d.today ? Colors.orange : Colors.muted, fontFamily: 'JetBrainsMono-Regular', marginBottom: 3 }}>
                        {d.v}
                      </Text>
                    )}
                    <View style={{
                      width: '100%',
                      height: barH,
                      backgroundColor: d.today ? Colors.orange : d.v > 0 ? `${Colors.orange}80` : Colors.surface2,
                      borderRadius: 6,
                    }} />
                  </View>
                  <Text style={{ fontSize: 10, color: d.today ? Colors.orange : Colors.muted, fontFamily: d.today ? 'DMSans-Bold' : 'DMSans-Regular' }}>
                    {d.label}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Log button */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowSheet(true);
            }}
            style={({ pressed }) => ({
              marginTop: 14,
              backgroundColor: pressed ? `${Colors.orange}CC` : Colors.orange,
              borderRadius: 999,
              paddingVertical: 11,
              alignItems: 'center',
            })}
          >
            <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 14 }}>+ Log workout</Text>
          </Pressable>
        </View>

        {/* Workouts logged this week: tap to edit or delete */}
        <View style={{ backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, padding: 18, marginBottom: 12, gap: 12 }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 16 }}>Workouts</Text>
          {(weekly?.logs ?? []).length === 0 ? (
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13 }}>
              {isThisWeek ? 'Nothing logged yet this week.' : 'No workouts that week.'}
            </Text>
          ) : (
            [...(weekly?.logs ?? [])].reverse().map((log) => (
              <Pressable
                key={log.id}
                onPress={() => setEditingWorkout(log)}
                accessibilityRole="button"
                accessibilityLabel={`${ACTIVITY_LABELS[log.activityType] ?? log.activityType}, ${log.durationMin} minutes`}
                accessibilityHint="Tap to edit"
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.6 : 1 })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: Colors.text, fontFamily: 'DMSans-Medium', fontSize: 14 }}>
                    {ACTIVITY_LABELS[log.activityType] ?? log.activityType}
                  </Text>
                  <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12, marginTop: 1 }}>
                    {dayLabel(localDateStr(new Date(log.loggedAt)), today)} · {log.durationMin} min
                  </Text>
                </View>
                <Text style={{ color: Colors.teal, fontFamily: 'JetBrainsMono-Regular', fontSize: 14 }}>
                  {Math.round(log.caloriesBurned ?? 0)} kcal
                </Text>
                <Text style={{ color: Colors.muted, fontSize: 16 }}>›</Text>
              </Pressable>
            ))
          )}
        </View>

        {/* Streak grid */}
        <View style={{ backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, padding: 18, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <View>
              <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 16, marginBottom: 2 }}>Habit streak</Text>
              <Text style={{ fontSize: 12, color: Colors.muted, fontFamily: 'DMSans-Regular' }}>Last 30 days</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 26, fontFamily: 'JetBrainsMono-Regular', color: Colors.orange }}>{streak}</Text>
              <View>
                <Text style={{ fontSize: 11, color: Colors.orange, fontFamily: 'DMSans-Bold' }}>day streak</Text>
                <Text style={{ fontSize: 10, color: Colors.muted, fontFamily: 'DMSans-Regular' }}>🔥 current best</Text>
              </View>
            </View>
          </View>
          {/* Day headers */}
          <View style={{ flexDirection: 'row', marginBottom: 4 }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 9, color: Colors.muted, fontFamily: 'DMSans-Regular' }}>{d}</Text>
              </View>
            ))}
          </View>
          {/* Grid */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {Array.from({ length: leadingBlanks }, (_, i) => (
              <View key={`pad-${i}`} style={{ width: `${100 / 7 - 1}%`, aspectRatio: 1 }} />
            ))}
            {historyDays.map((day) => {
              // Shade by the share of habits completed that day
              const share = habitCount > 0 ? day.completed / habitCount : 0;
              return (
                <View
                  key={day.date}
                  style={{
                    width: `${100 / 7 - 1}%`,
                    aspectRatio: 1,
                    borderRadius: 4,
                    backgroundColor: share >= 1 ? Colors.teal
                      : share >= 0.5 ? `${Colors.teal}BB`
                      : share > 0 ? `${Colors.teal}60`
                      : Colors.surface2,
                  }}
                />
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 10 }}>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {[`${Colors.teal}40`, `${Colors.teal}80`, Colors.teal].map((c, i) => (
                <View key={i} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: c }} />
              ))}
            </View>
            <Text style={{ fontSize: 10, color: Colors.muted, fontFamily: 'DMSans-Regular' }}>Less → More</Text>
          </View>
        </View>

        {/* Summary bento */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {[
            { label: 'Avg calories', val: avgCalories.toLocaleString(), unit: 'kcal/day', color: Colors.orange },
            {
              label: weeklyBalance <= 0 ? 'Weekly deficit' : 'Weekly surplus',
              val: Math.abs(weeklyBalance).toLocaleString(),
              unit: 'kcal vs goal',
              color: Colors.teal,
            },
            { label: 'Active days', val: String(activeDays), unit: isThisWeek ? 'this week' : 'that week', color: Colors.blue },
            { label: 'Habit streak', val: String(streak), unit: 'days', color: Colors.orange },
          ].map(s => (
            <View
              key={s.label}
              style={{
                width: '47.5%',
                backgroundColor: Colors.surface,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: Colors.border,
                padding: 16,
              }}
            >
              <Text style={{ fontSize: 12, color: Colors.muted, fontFamily: 'DMSans-Bold', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 }}>
                {s.label}
              </Text>
              <Text style={{ fontSize: 24, fontFamily: 'JetBrainsMono-Regular', color: s.color, letterSpacing: -0.5 }}>
                {s.val}
              </Text>
              <Text style={{ fontSize: 11, color: Colors.muted, fontFamily: 'DMSans-Regular', marginTop: 2 }}>
                {s.unit}
              </Text>
            </View>
          ))}
        </View>

      </ScrollView>

      {showSheet && <LogActivitySheet onClose={() => setShowSheet(false)} />}
      {editingWorkout && <LogActivitySheet key={editingWorkout.id} editing={editingWorkout} onClose={() => setEditingWorkout(null)} />}
    </SafeAreaView>
  );
}
