import React from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useDeleteWorkout, useWorkout, type SavedSet } from '@/hooks/useWorkouts';
import { useMe } from '@/hooks/useMe';
import { kgToUnit } from '@/lib/units';
import { confirmAction } from '@/lib/confirm';
import { PR_LABELS } from '@/lib/strength';
import { ScreenHeader, Section } from '@/components/settings/SettingsUI';

/** A saved workout: its sets by exercise, with PRs. */
export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: w, isLoading, isError } = useWorkout(id ?? null);
  const { data: me } = useMe();
  const unit = me?.weightUnit ?? 'kg';
  const del = useDeleteWorkout();

  const groups: { exerciseId: string; name: string; sets: SavedSet[] }[] = [];
  for (const s of w?.sets ?? []) {
    const last = groups[groups.length - 1];
    if (last?.exerciseId === s.exerciseId) last.sets.push(s);
    else groups.push({ exerciseId: s.exerciseId, name: s.exerciseName, sets: [s] });
  }

  async function remove() {
    if (!w) return;
    const ok = await confirmAction({ title: 'Delete workout?', message: 'Its sets, PRs and the activity log go too.', confirmLabel: 'Delete', destructive: true });
    if (!ok) return;
    await del.mutateAsync(w.id);
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/activity');
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}>
      <ScreenHeader title={w?.title || 'Workout'} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 48 }}>
        {isLoading ? (
          <ActivityIndicator color={Colors.orange} style={{ marginTop: 40 }} />
        ) : isError || !w ? (
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 15 }}>Couldn't load this workout.</Text>
        ) : (
          <>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14 }}>
              {new Date(w.startedAt).toLocaleString()} · {w.activityLog.durationMin} min · {w.setCount} sets · {Math.round(kgToUnit(w.volumeKg, unit))} {unit} moved
              {w.prCount ? ` · 🏆 ${w.prCount} PR${w.prCount > 1 ? 's' : ''}` : ''}
            </Text>
            {groups.map((g, i) => (
              <Section key={i}>
                <Pressable onPress={() => router.push(`/exercise-history/${encodeURIComponent(g.exerciseId)}`)} accessibilityRole="button">
                  <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 15, textDecorationLine: 'underline', textDecorationColor: `${Colors.muted}80` }}>{g.name}</Text>
                </Pressable>
                {g.sets.map((s) => (
                  <View key={s.id} style={{ flexDirection: 'row', gap: 10 }}>
                    <Text style={{ width: 22, color: Colors.muted, fontFamily: 'JetBrainsMono-Regular', fontSize: 13 }}>{s.warmup ? 'W' : '•'}</Text>
                    <Text style={{ flex: 1, color: Colors.text, fontFamily: 'JetBrainsMono-Regular', fontSize: 13 }}>
                      {s.durationSec ? `${s.durationSec} s` : s.weightKg ? `${kgToUnit(s.weightKg, unit)} ${unit} × ${s.reps}` : `${s.reps} reps`}
                    </Text>
                    {!!s.pr && <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 12 }}>🏆 {PR_LABELS[s.pr]}</Text>}
                  </View>
                ))}
              </Section>
            ))}
            <Pressable onPress={remove} disabled={del.isPending} accessibilityRole="button" style={{ alignItems: 'center', paddingVertical: 12 }}>
              <Text style={{ color: Colors.error, fontFamily: 'DMSans-Bold', fontSize: 15 }}>Delete workout</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
