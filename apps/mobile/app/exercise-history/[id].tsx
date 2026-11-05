import React, { useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { useExerciseHistory } from '@/hooks/useWorkouts';
import { useMe } from '@/hooks/useMe';
import { kgToUnit } from '@/lib/units';
import { ScreenHeader, Section } from '@/components/settings/SettingsUI';
import { ExerciseSheet } from '@/components/exercises/ExerciseSheet';

const W = 320;
const H = 160;
const PAD = 28;

/** A line over time, oldest on the left. */
function Chart({ points, color, unit }: { points: { date: string; value: number }[]; color: string; unit: string }) {
  if (points.length < 2) {
    return <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13 }}>Log this exercise twice to see a chart.</Text>;
  }
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - PAD * 2);
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} accessibilityLabel={`From ${values[0]} to ${values[values.length - 1]} ${unit}`}>
      <Line x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} stroke={Colors.border} strokeWidth={1} />
      <Polyline points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')} fill="none" stroke={color} strokeWidth={2.5} />
      {points.map((p, i) => (
        <Circle key={i} cx={x(i)} cy={y(p.value)} r={3.5} fill={color} />
      ))}
      <SvgText x={PAD} y={14} fill={Colors.muted} fontSize={11}>{`${max} ${unit}`}</SvgText>
      <SvgText x={PAD} y={H - 8} fill={Colors.muted} fontSize={11}>{`${min} ${unit}`}</SvgText>
      <SvgText x={W - PAD} y={H - 8} fill={Colors.muted} fontSize={11} textAnchor="end">{points[points.length - 1].date.slice(5)}</SvgText>
    </Svg>
  );
}

/** One exercise's history: top weight and estimated one-rep max over time, records, sessions. */
export default function ExerciseHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, isError, refetch } = useExerciseHistory(id ?? null);
  const { data: me } = useMe();
  const unit = me?.weightUnit ?? 'kg';
  const [chosen, setChosen] = useState<'e1rm' | 'top' | null>(null);
  // Estimated 1RM needs sets of 10 reps or fewer; until there are two such
  // sessions, show top weight instead
  const e1rmSessions = (data?.sessions ?? []).filter((s) => s.bestE1rm != null).length;
  const metric = chosen ?? (e1rmSessions >= 2 ? 'e1rm' : 'top');
  const setMetric = setChosen;
  const [info, setInfo] = useState<string | null>(null);

  const oldestFirst = [...(data?.sessions ?? [])].reverse();
  const points = oldestFirst
    .map((s) => ({ date: s.date, value: metric === 'e1rm' ? s.bestE1rm : s.topWeightKg }))
    .filter((p): p is { date: string; value: number } => p.value != null)
    .map((p) => ({ ...p, value: kgToUnit(p.value, unit) }));
  const bodyweight = !!data && data.sessions.every((s) => s.topWeightKg == null);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}>
      <ScreenHeader
        title={data?.exercise.name ?? 'History'}
        right={
          data ? (
            <Pressable onPress={() => setInfo(data.exercise.id)} accessibilityRole="button" hitSlop={8}>
              <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 14 }}>How to</Text>
            </Pressable>
          ) : undefined
        }
      />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 48 }}>
        {isLoading ? (
          <ActivityIndicator color={Colors.orange} style={{ marginTop: 40 }} />
        ) : isError || !data ? (
          <Pressable onPress={() => refetch()} accessibilityRole="button">
            <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 15 }}>Couldn't load the history. Try again</Text>
          </Pressable>
        ) : !data.sessions.length ? (
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 15 }}>You haven't logged this exercise yet.</Text>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {data.records.weightKg != null && <Record label="Heaviest" value={`${kgToUnit(data.records.weightKg, unit)} ${unit}`} />}
              {data.records.e1rm != null && <Record label="Best est. 1RM" value={`${kgToUnit(data.records.e1rm, unit)} ${unit}`} />}
              {data.records.reps != null && <Record label="Most reps" value={String(data.records.reps)} />}
            </View>

            {!bodyweight && (
              <Section>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['e1rm', 'top'] as const).map((m) => (
                    <Pressable
                      key={m}
                      onPress={() => setMetric(m)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: metric === m }}
                      style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: metric === m ? Colors.orange : Colors.surface2 }}
                    >
                      <Text style={{ color: metric === m ? '#fff' : Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 12 }}>{m === 'e1rm' ? 'Estimated 1RM' : 'Top weight'}</Text>
                    </Pressable>
                  ))}
                </View>
                <Chart points={points} color={Colors.orange} unit={unit} />
                <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 11 }}>
                  Estimated one-rep max uses the Epley formula, from sets of 10 reps or fewer.
                </Text>
              </Section>
            )}

            <Section title="Sessions">
              {data.sessions.map((s) => (
                <View key={s.sessionId} style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: Colors.border, gap: 3 }}>
                  <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 14 }}>{s.date}</Text>
                  <Text style={{ color: Colors.muted, fontFamily: 'JetBrainsMono-Regular', fontSize: 12 }}>
                    {s.sets
                      .map((x) => `${x.warmup ? 'W ' : ''}${x.durationSec ? `${x.durationSec}s` : x.weightKg ? `${kgToUnit(x.weightKg, unit)}×${x.reps}` : x.reps}${x.pr ? ' 🏆' : ''}`)
                      .join('   ')}
                  </Text>
                </View>
              ))}
            </Section>
          </>
        )}
      </ScrollView>
      <ExerciseSheet id={info} onClose={() => setInfo(null)} />
    </SafeAreaView>
  );
}

function Record({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 12 }}>
      <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 11 }}>{label}</Text>
      <Text style={{ color: Colors.text, fontFamily: 'JetBrainsMono-Regular', fontSize: 17, marginTop: 2 }}>{value}</Text>
    </View>
  );
}
