import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle, Line, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import { useActivityLogsForDate, useWeeklySummary } from '@/hooks/useActivityLog';
import { LogActivitySheet } from '@/components/activity/LogActivitySheet';
import { Colors } from '@/constants/colors';

const MOCK_CAL_DATA = [
  { label: 'Mon', v: 1820 }, { label: 'Tue', v: 2180 }, { label: 'Wed', v: 1950 },
  { label: 'Thu', v: 2210 }, { label: 'Fri', v: 1680 }, { label: 'Sat', v: 2050 },
  { label: 'Sun', v: 1240, today: true },
];

const STREAK_DAYS = Array.from({ length: 42 }, (_, i) => {
  const seed = (i * 17 + 3) % 7;
  return { done: seed < 5, daysAgo: 41 - i };
});

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

const METRICS = [
  { id: 'calories', label: 'Calories' },
  { id: 'protein', label: 'Protein' },
  { id: 'activity', label: 'Activity' },
  { id: 'weight', label: 'Weight' },
];

const PERIODS = ['7D', '30D', '3M'];

export default function ActivityScreen() {
  const today = new Date().toISOString().split('T')[0];
  const { data: weekly } = useWeeklySummary();
  const [showSheet, setShowSheet] = useState(false);
  const [metric, setMetric] = useState('calories');
  const [period, setPeriod] = useState('7D');

  useFocusEffect(
    React.useCallback(() => {
      return () => setShowSheet(false);
    }, [])
  );

  const actData = weekly?.days?.map((d: any, i: number) => ({
    label: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i] ?? `D${i}`,
    v: d.activeMinutes ?? 0,
    today: i === (weekly.days.length - 1),
  })) ?? MOCK_CAL_DATA.map(d => ({ ...d, v: Math.floor(d.v / 40) }));

  const totalMins = weekly?.totals?.activeMinutes ?? 277;
  const activeDays = actData.filter(d => d.v > 0).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingTop: 6 }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 28, letterSpacing: -0.5 }}>
            Analytics
          </Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {PERIODS.map(p => (
              <Pressable
                key={p}
                onPress={() => setPeriod(p)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  borderRadius: 999,
                  backgroundColor: period === p ? `${Colors.orange}25` : Colors.surface2,
                  borderWidth: 1,
                  borderColor: period === p ? Colors.orange : Colors.border,
                }}
              >
                <Text style={{ fontSize: 12, fontFamily: 'DMSans-Bold', color: period === p ? Colors.orange : Colors.muted }}>
                  {p}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Metric tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 16 }}
          contentContainerStyle={{ gap: 8, paddingRight: 4 }}
        >
          {METRICS.map(m => (
            <Pressable
              key={m.id}
              onPress={() => setMetric(m.id)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: metric === m.id ? Colors.orange : Colors.surface,
                borderWidth: 1,
                borderColor: metric === m.id ? Colors.orange : Colors.border,
              }}
            >
              <Text style={{ fontSize: 13, fontFamily: 'DMSans-Bold', color: metric === m.id ? '#fff' : Colors.muted }}>
                {m.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Calorie trend card */}
        <View style={{ backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, padding: 18, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
            <View>
              <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 16, marginBottom: 2 }}>
                Weekly calories
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <Text style={{ fontSize: 28, fontFamily: 'JetBrainsMono-Regular', color: Colors.text, letterSpacing: -1 }}>1,876</Text>
                <Text style={{ fontSize: 12, color: Colors.muted, fontFamily: 'DMSans-Regular' }}>avg / day</Text>
              </View>
            </View>
            <View style={{ backgroundColor: `${Colors.teal}20`, borderWidth: 1, borderColor: `${Colors.teal}50`, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontSize: 12, fontFamily: 'DMSans-Bold', color: Colors.teal }}>▼ 8% deficit</Text>
            </View>
          </View>
          <LineChart data={MOCK_CAL_DATA} goalVal={2050} color={Colors.orange} gradId="calGrad" />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            {MOCK_CAL_DATA.map(d => (
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
              <Text style={{ fontSize: 11, color: Colors.muted, fontFamily: 'DMSans-Regular' }}>Goal 2,050</Text>
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
              const hPct = d.v > 0 ? Math.max(0.08, d.v / 60) : 0.04;
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

        {/* Streak grid */}
        <View style={{ backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, padding: 18, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <View>
              <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 16, marginBottom: 2 }}>Habit streak</Text>
              <Text style={{ fontSize: 12, color: Colors.muted, fontFamily: 'DMSans-Regular' }}>Last 6 weeks</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 26, fontFamily: 'JetBrainsMono-Regular', color: Colors.orange }}>21</Text>
              <View>
                <Text style={{ fontSize: 11, color: Colors.orange, fontFamily: 'DMSans-Bold' }}>day streak</Text>
                <Text style={{ fontSize: 10, color: Colors.muted, fontFamily: 'DMSans-Regular' }}>🔥 personal best</Text>
              </View>
            </View>
          </View>
          {/* Day headers */}
          <View style={{ flexDirection: 'row', marginBottom: 4 }}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 9, color: Colors.muted, fontFamily: 'DMSans-Regular' }}>{d}</Text>
              </View>
            ))}
          </View>
          {/* Grid */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {STREAK_DAYS.map((day, i) => (
              <View
                key={i}
                style={{
                  width: `${100 / 7 - 1}%`,
                  aspectRatio: 1,
                  borderRadius: 4,
                  backgroundColor: day.done
                    ? day.daysAgo < 7 ? Colors.teal
                    : day.daysAgo < 21 ? `${Colors.teal}BB`
                    : `${Colors.teal}60`
                    : Colors.surface2,
                }}
              />
            ))}
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
            { label: 'Avg calories', val: '1,876', unit: 'kcal/day', color: Colors.orange },
            { label: 'Weekly deficit', val: '−1,218', unit: 'kcal', color: Colors.teal },
            { label: 'Active days', val: String(activeDays), unit: 'this week', color: Colors.blue },
            { label: 'Best streak', val: '21', unit: 'days', color: Colors.orange },
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
    </SafeAreaView>
  );
}
