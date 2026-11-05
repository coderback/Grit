import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { useDeleteWeight, useTrends, useWeightHistory, type TrendDay, type TrendRange } from '@/hooks/useProgress';
import { ErrorNotice } from '@/components/ui/QueryStatus';
import { kgToUnit, type WeightUnit } from '@/lib/units';
import { confirmAction } from '@/lib/confirm';

type Metric = 'calories' | 'protein' | 'activity' | 'weight';

const RANGES: { value: TrendRange; label: string }[] = [
  { value: 7, label: '7D' },
  { value: 30, label: '30D' },
  { value: 90, label: '3M' },
];
const METRICS: { value: Metric; label: string; color: 'orange' | 'blue' | 'teal' }[] = [
  { value: 'calories', label: 'Calories', color: 'orange' },
  { value: 'protein', label: 'Protein', color: 'blue' },
  { value: 'activity', label: 'Activity', color: 'teal' },
  { value: 'weight', label: 'Weight', color: 'orange' },
];

const CHART_H = 120;

function shortDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

interface Bar {
  label: string;
  value: number;
  /** No data: drawn as a stub, left out of averages */
  empty: boolean;
}

/**
 * One bar per day, or per week for 3 months. Weekly bars show the daily
 * average over the days that have data.
 */
function toBars(days: TrendDay[], pick: (d: TrendDay) => number, hasData: (d: TrendDay) => boolean, weekly: boolean): Bar[] {
  if (!weekly) {
    return days.map((d) => ({ label: d.date, value: pick(d), empty: !hasData(d) }));
  }
  const bars: Bar[] = [];
  for (let i = 0; i < days.length; i += 7) {
    const week = days.slice(i, i + 7);
    const withData = week.filter(hasData);
    bars.push({
      label: week[0].date,
      value: withData.length ? withData.reduce((s, d) => s + pick(d), 0) / withData.length : 0,
      empty: withData.length === 0,
    });
  }
  return bars;
}

function BarChart({ bars, goal, color }: { bars: Bar[]; goal: number; color: string }) {
  const max = Math.max(goal * 1.15, ...bars.map((b) => b.value), 1);
  const goalTop = CHART_H - (goal / max) * CHART_H;
  const gap = bars.length > 14 ? 2 : 6;
  return (
    <View style={{ height: CHART_H, flexDirection: 'row', alignItems: 'flex-end', gap }}>
      {goal > 0 && (
        <View style={{ position: 'absolute', left: 0, right: 0, top: goalTop, borderTopWidth: 1, borderStyle: 'dashed', borderColor: Colors.muted, opacity: 0.6 }} />
      )}
      {bars.map((b, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: b.empty ? 3 : Math.max(3, (b.value / max) * CHART_H),
            borderRadius: bars.length > 14 ? 2 : 5,
            backgroundColor: b.empty ? Colors.surface2 : b.value >= goal && goal > 0 ? color : `${color}99`,
          }}
        />
      ))}
    </View>
  );
}

function WeightChart({ days, goalKg, unit }: { days: TrendDay[]; goalKg: number | null; unit: WeightUnit }) {
  const W = 300;
  const points = days
    .map((d, i) => ({ i, v: d.weightKg }))
    .filter((p): p is { i: number; v: number } => p.v !== null);
  if (points.length === 0) {
    return (
      <View style={{ height: CHART_H, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13 }}>No weigh-ins in this range yet.</Text>
      </View>
    );
  }
  const values = points.map((p) => p.v);
  // Show the goal line when it's reasonably close to the data
  const lo0 = Math.min(...values), hi0 = Math.max(...values);
  const showGoal = goalKg !== null && Math.abs(goalKg - (lo0 + hi0) / 2) < 25;
  const lo = Math.min(lo0, showGoal ? goalKg! : lo0) - 1;
  const hi = Math.max(hi0, showGoal ? goalKg! : hi0) + 1;
  const x = (i: number) => (days.length === 1 ? W / 2 : (i / (days.length - 1)) * W);
  const y = (v: number) => CHART_H - ((v - lo) / (hi - lo)) * CHART_H;
  const path = points.map((p, k) => `${k === 0 ? 'M' : 'L'} ${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');

  return (
    <View>
      <Svg width="100%" height={CHART_H} viewBox={`-6 -6 ${W + 12} ${CHART_H + 12}`} preserveAspectRatio="none">
        {showGoal && (
          <Line x1="0" x2={W} y1={y(goalKg!)} y2={y(goalKg!)} stroke={Colors.teal} strokeWidth="1" strokeDasharray="4,4" />
        )}
        {points.length > 1 && <Path d={path} stroke={Colors.orange} strokeWidth="2.5" fill="none" strokeLinejoin="round" strokeLinecap="round" />}
        {points.map((p) => (
          <Circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={points.length > 30 ? 2 : 3.5} fill={Colors.orange} />
        ))}
      </Svg>
      <View style={{ position: 'absolute', right: 0, top: -2 }}>
        <Text style={{ color: Colors.muted, fontFamily: 'JetBrainsMono-Regular', fontSize: 10 }}>{kgToUnit(hi - 1, unit)}</Text>
      </View>
      <View style={{ position: 'absolute', right: 0, bottom: -2 }}>
        <Text style={{ color: Colors.muted, fontFamily: 'JetBrainsMono-Regular', fontSize: 10 }}>{kgToUnit(lo + 1, unit)}</Text>
      </View>
    </View>
  );
}

function Stat({ label, value, color = Colors.text }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color, fontFamily: 'JetBrainsMono-Regular', fontSize: 18, letterSpacing: -0.5 }}>{value}</Text>
      <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 11, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function signed(n: number, unit: string) {
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)} ${unit}`;
}

/** Calories, protein, activity and weight over 7 days, 30 days or 3 months. */
export function TrendsCard({ unit, onLogWeight }: { unit: WeightUnit; onLogWeight: () => void }) {
  const [range, setRange] = useState<TrendRange>(7);
  const [metric, setMetric] = useState<Metric>('calories');
  const { data, isLoading, isError, refetch } = useTrends(range);
  const weight = useWeightHistory(range === 90 ? 90 : 30);
  const { mutate: deleteWeight } = useDeleteWeight();
  const color = Colors[METRICS.find((m) => m.value === metric)!.color];
  const weekly = range === 90;

  const view = useMemo(() => {
    if (!data) return null;
    const { days, goals } = data;
    const fed = days.filter((d) => d.foodEntries > 0);
    const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
    if (metric === 'calories') {
      return {
        bars: toBars(days, (d) => d.calories, (d) => d.foodEntries > 0, weekly),
        goal: goals.calories,
        stats: [
          { label: 'avg kcal / logged day', value: avg(fed.map((d) => d.calories)).toLocaleString() },
          { label: 'days logged', value: `${fed.length}/${days.length}` },
          { label: 'goal', value: goals.calories.toLocaleString() },
        ],
      };
    }
    if (metric === 'protein') {
      return {
        bars: toBars(days, (d) => d.proteinG, (d) => d.foodEntries > 0, weekly),
        goal: goals.proteinG,
        stats: [
          { label: 'avg g / logged day', value: String(avg(fed.map((d) => d.proteinG))) },
          { label: 'days on target', value: String(fed.filter((d) => d.proteinG >= goals.proteinG).length) },
          { label: 'target', value: `${goals.proteinG} g` },
        ],
      };
    }
    if (metric === 'activity') {
      const minutes = days.reduce((s, d) => s + d.activeMinutes, 0);
      return {
        bars: toBars(days, (d) => d.activeMinutes, (d) => d.activeMinutes > 0, weekly),
        goal: goals.activeMinutes,
        stats: [
          { label: 'active minutes', value: minutes.toLocaleString() },
          { label: 'workouts', value: String(days.reduce((s, d) => s + d.workouts, 0)) },
          { label: 'active days', value: `${days.filter((d) => d.activeMinutes > 0).length}/${days.length}` },
        ],
      };
    }
    return null;
  }, [data, metric, weekly]);

  const w = weight.data;
  const entries = w?.entries ?? [];

  return (
    <View style={{ backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, padding: 18, marginBottom: 12, gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 16 }}>Trends</Text>
        <View style={{ flexDirection: 'row', gap: 4 }} accessibilityRole="radiogroup">
          {RANGES.map((r) => (
            <Pressable
              key={r.value}
              onPress={() => setRange(r.value)}
              accessibilityRole="radio"
              aria-selected={range === r.value}
              accessibilityLabel={r.value === 90 ? '3 months' : `${r.value} days`}
              style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: range === r.value ? Colors.surface3 : 'transparent' }}
            >
              <Text style={{ color: range === r.value ? Colors.text : Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 12 }}>{r.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ flexDirection: 'row', backgroundColor: Colors.surface2, borderRadius: 999, padding: 3, gap: 2 }} accessibilityRole="tablist">
        {METRICS.map((m) => (
          <Pressable
            key={m.value}
            onPress={() => setMetric(m.value)}
            accessibilityRole="tab"
            aria-selected={metric === m.value}
            style={{ flex: 1, paddingVertical: 7, borderRadius: 999, alignItems: 'center', backgroundColor: metric === m.value ? Colors.surface3 : 'transparent' }}
          >
            <Text style={{ color: metric === m.value ? Colors.text : Colors.muted, fontFamily: metric === m.value ? 'DMSans-Bold' : 'DMSans-Regular', fontSize: 12 }}>{m.label}</Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color={Colors.orange} style={{ height: CHART_H }} />
      ) : isError || !data ? (
        <ErrorNotice compact onRetry={() => refetch()} />
      ) : metric === 'weight' ? (
        <>
          <View style={{ flexDirection: 'row' }}>
            <Stat label="latest" value={w?.latest != null ? `${kgToUnit(w.latest, unit)} ${unit}` : '—'} color={Colors.orange} />
            <Stat label={`change, ${range === 90 ? '3 months' : '30 days'}`} value={w?.change != null ? signed(kgToUnit(w.change, unit), unit) : '—'} />
            <Stat
              label={w?.goalWeightKg ? `to goal of ${kgToUnit(w.goalWeightKg, unit)}` : 'set a goal in Goals'}
              value={w?.toGoal != null ? (Math.abs(w.toGoal) < 0.1 ? 'Reached!' : `${kgToUnit(Math.abs(w.toGoal), unit)} ${unit}`) : '—'}
              color={Colors.teal}
            />
          </View>
          <WeightChart days={data.days} goalKg={data.goals.weightKg} unit={unit} />
          <Pressable
            onPress={onLogWeight}
            accessibilityRole="button"
            style={({ pressed }) => ({ backgroundColor: pressed ? `${Colors.orange}CC` : Colors.orange, borderRadius: 999, paddingVertical: 11, alignItems: 'center' })}
          >
            <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 14 }}>+ Log weight</Text>
          </Pressable>
          {entries.length > 0 && (
            <View style={{ gap: 8 }}>
              {[...entries].reverse().slice(0, 5).map((e) => (
                <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ flex: 1, color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13 }}>{shortDate(e.date)}</Text>
                  <Text style={{ color: Colors.text, fontFamily: 'JetBrainsMono-Regular', fontSize: 13 }}>{kgToUnit(e.weightKg, unit)} {unit}</Text>
                  <Pressable
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete weigh-in on ${shortDate(e.date)}`}
                    onPress={async () => {
                      if (await confirmAction({ title: 'Delete weigh-in?', message: `Remove ${kgToUnit(e.weightKg, unit)} ${unit} on ${shortDate(e.date)}?`, confirmLabel: 'Delete', destructive: true })) {
                        deleteWeight(e.id);
                      }
                    }}
                  >
                    <Text style={{ color: Colors.muted, fontSize: 13 }}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </>
      ) : view && (
        <>
          <View style={{ flexDirection: 'row' }}>
            {view.stats.map((s, i) => <Stat key={s.label} label={s.label} value={s.value} color={i === 0 ? color : Colors.text} />)}
          </View>
          <BarChart bars={view.bars} goal={view.goal} color={color} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: -6 }}>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 10 }}>{shortDate(data.days[0].date)}</Text>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 10 }}>
              {weekly ? 'weekly average · ' : ''}dashed line = goal
            </Text>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 10 }}>Today</Text>
          </View>
        </>
      )}
    </View>
  );
}
