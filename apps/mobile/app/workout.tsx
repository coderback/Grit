import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useOnlineManager } from '@/hooks/useOnline';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import { useWorkoutStore, type DraftExercise, type DraftSet, type SaveWorkoutBody } from '@/stores/workoutStore';
import { usePrepareWorkout, useParseSets, type PastSet, type PreparedExercise, type SpokenSet } from '@/hooks/useWorkouts';
import { useMe } from '@/hooks/useMe';
import { useEnsureAiConsent } from '@/hooks/useAiConsent';
import { isCompound } from '@/hooks/useStartWorkout';
import { ExerciseCard } from '@/components/workout/ExerciseCard';
import { RestBar } from '@/components/workout/RestBar';
import { MenuSheet, type MenuItem } from '@/components/workout/MenuSheet';
import { ExercisePicker } from '@/components/workout/ExercisePicker';
import { PlatesSheet } from '@/components/workout/PlatesSheet';
import { ExerciseSheet } from '@/components/exercises/ExerciseSheet';
import { formatClock, parseDetail, prOf, PR_LABELS, restSeconds, withSet, type PrKind } from '@/lib/strength';
import { kgToUnit } from '@/lib/units';
import { sendWorkout, retryWorkout } from '@/lib/workoutSync';
import { confirmAction } from '@/lib/confirm';
import { showToast } from '@/stores/toastStore';

const haptic = (kind: 'light' | 'success') => {
  if (Platform.OS === 'web') return;
  if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

/** The sets to start with: today's target, or last time's, or the plan's. */
function startingSets(p: PreparedExercise | undefined, e: DraftExercise): Partial<DraftSet>[] {
  if (p?.timed) return Array.from({ length: p.timed.sets }, () => ({ durationSec: p.timed!.seconds, reps: 0 }));
  const plan = e.detail ? parseDetail(e.detail) : null;
  if (plan?.kind === 'timed') return Array.from({ length: plan.sets }, () => ({ durationSec: plan.seconds, reps: 0 }));
  const s = p?.suggestion;
  const n = s?.sets ?? (plan?.kind === 'reps' ? plan.sets : p?.last?.sets.length || 3);
  return Array.from({ length: n }, (_, i) => ({
    weightKg: s?.weightKg ?? (s?.action === 'start' ? null : p?.last?.sets[i]?.weightKg ?? null),
    reps: s?.reps ?? (plan?.kind === 'reps' ? plan.repsLow : p?.last?.sets[i]?.reps ?? null),
  }));
}

/** Logs a workout set by set: last time's numbers one tap away, rest timers, PRs as they happen. */
export default function WorkoutScreen() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const stored = useWorkoutStore((s) => s.active);
  const active = stored && stored.ownerId === userId ? stored : null;
  const store = useWorkoutStore.getState;
  const { data: me } = useMe();
  const unit = me?.weightUnit ?? 'kg';
  const [summary, setSummary] = useState<{ body: SaveWorkoutBody; prs: string[]; volume: number } | null>(null);

  const prepare = usePrepareWorkout(active?.exercises.map((e) => ({ exerciseId: e.exerciseId, detail: e.detail })) ?? []);
  const prepared = useMemo(() => new Map((prepare.data?.exercises ?? []).map((p) => [p.exerciseId, p])), [prepare.data]);

  // Fill in each exercise's sets once its targets are in (or straight away
  // if they can't be fetched, e.g. offline with nothing cached)
  useEffect(() => {
    if (!active) return;
    for (const e of active.exercises) {
      if (e.prefilled) continue;
      const p = prepared.get(e.exerciseId);
      if (p || prepare.isError) store().prefill(e.key, startingSets(p, e));
    }
  }, [active, prepared, prepare.isError, store]);

  const [menuFor, setMenuFor] = useState<DraftExercise | null>(null);
  const [picker, setPicker] = useState<{ mode: 'add' | 'swap'; key?: string; pattern?: string | null } | null>(null);
  const [plates, setPlates] = useState<{ key: string; weightKg: number | null } | undefined>(undefined);
  const [infoId, setInfoId] = useState<string | null>(null);
  const [workoutMenu, setWorkoutMenu] = useState(false);

  if (summary) return <Summary {...summary} unit={unit} />;

  if (!active) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark, padding: 24, gap: 16, justifyContent: 'center' }}>
        <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 22, textAlign: 'center' }}>No workout in progress</Text>
        <Pressable
          onPress={() => userId && store().start({ ownerId: userId, exercises: [] })}
          accessibilityRole="button"
          style={{ backgroundColor: Colors.orange, borderRadius: 999, paddingVertical: 14, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 16 }}>Start an empty workout</Text>
        </Pressable>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/'))} accessibilityRole="button" style={{ alignItems: 'center', padding: 10 }}>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 15 }}>Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const exercises = active.exercises;

  /** Ticks a set (or unticks it), marking a PR and starting the rest timer. */
  function complete(e: DraftExercise, set: DraftSet, values?: Partial<DraftSet>) {
    const s = { ...set, ...values };
    if (set.done && !values) {
      store().updateSet(e.key, set.id, { done: false, pr: null });
      return;
    }
    const p = prepared.get(e.exerciseId);
    const timed = !!p?.timed || !!s.durationSec;
    if (!timed && !(s.reps && s.reps > 0)) {
      showToast('Add the reps first');
      return;
    }
    let pr: PrKind | null = null;
    const base = p?.records;
    if (base && (base.e1rm != null || base.weightKg != null || base.reps != null)) {
      const current = useWorkoutStore.getState().active?.exercises.find((x) => x.key === e.key);
      const records = (current?.sets ?? []).filter((x) => x.done && x.id !== set.id).reduce((r, x) => withSet(r, { reps: x.reps ?? 0, weightKg: x.weightKg, warmup: x.warmup }), base);
      pr = prOf({ reps: s.reps ?? 0, weightKg: s.weightKg, warmup: s.warmup, durationSec: s.durationSec }, records);
    }
    store().updateSet(e.key, set.id, { ...values, done: true, pr });
    haptic(pr ? 'success' : 'light');
    if (pr) showToast(`🏆 New PR on ${e.name}: ${PR_LABELS[pr]}`, 'info');

    const group = e.supersetId ? exercises.filter((x) => x.supersetId === e.supersetId) : null;
    const kind = set.warmup ? 'warmup' : group && group[group.length - 1].key !== e.key ? 'superset' : 'working';
    const sec = restSeconds(kind, isCompound(p?.pattern));
    if (sec) store().startRest(sec, kind === 'warmup' ? 'Warm-up rest' : group ? 'Rest after the round' : 'Rest');
    else store().clearRest();
  }

  /** Puts spoken sets into the first sets not done yet, adding sets as needed. */
  function logSpoken(sets: SpokenSet[]) {
    for (const spoken of sets) {
      let ex = useWorkoutStore.getState().active?.exercises.find((x) => x.exerciseId === spoken.exerciseId);
      if (!ex) {
        store().addExercise({ exerciseId: spoken.exerciseId, name: spoken.exerciseName });
        ex = useWorkoutStore.getState().active?.exercises.find((x) => x.exerciseId === spoken.exerciseId);
        if (ex) store().prefill(ex.key, []);
      }
      if (!ex) continue;
      let target = ex.sets.find((x) => !x.done && !x.warmup);
      if (!target) {
        store().insertSets(ex.key, [{}], 'end');
        target = useWorkoutStore.getState().active?.exercises.find((x) => x.key === ex!.key)?.sets.at(-1);
      }
      if (target) complete(ex, target, { reps: spoken.reps, weightKg: spoken.weightKg, durationSec: spoken.durationSec });
    }
  }

  async function finish() {
    const all = exercises.flatMap((e) => e.sets);
    const done = all.filter((s) => s.done);
    if (!done.length) {
      const discard = await confirmAction({ title: 'No sets ticked', message: 'Tick the sets you did, or discard this workout.', confirmLabel: 'Discard workout', destructive: true });
      if (discard) {
        store().discard();
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)/');
      }
      return;
    }
    if (done.length < all.length) {
      const ok = await confirmAction({ title: 'Finish workout?', message: `${all.length - done.length} sets aren't ticked and won't be saved.`, confirmLabel: 'Finish' });
      if (!ok) return;
    }
    const prs = exercises.flatMap((e) => e.sets.filter((s) => s.done && s.pr).map((s) => `${e.name}: ${s.weightKg ? `${kgToUnit(s.weightKg, unit)} ${unit} × ${s.reps}` : `${s.reps} reps`}`));
    const volume = done.filter((s) => !s.warmup).reduce((t, s) => t + (s.weightKg ?? 0) * (s.reps ?? 0), 0);
    const body = store().finish();
    if (!body) return;
    sendWorkout(body);
    haptic('success');
    setSummary({ body, prs, volume });
  }

  function menuItems(e: DraftExercise): MenuItem[] {
    const i = exercises.findIndex((x) => x.key === e.key);
    const p = prepared.get(e.exerciseId);
    const firstWorking = e.sets.find((s) => !s.warmup);
    return [
      { label: 'Swap for a similar exercise', onPress: () => setPicker({ mode: 'swap', key: e.key, pattern: p?.pattern ?? null }) },
      { label: 'Plates and warm-ups', onPress: () => setPlates({ key: e.key, weightKg: firstWorking?.weightKg ?? p?.suggestion?.weightKg ?? null }), disabled: !!p?.timed },
      { label: e.supersetId ? 'Remove from superset' : 'Superset with the next exercise', onPress: () => store().toggleSuperset(e.key), disabled: !e.supersetId && i === exercises.length - 1 },
      { label: 'Move up', onPress: () => store().moveExercise(e.key, -1), disabled: i === 0 },
      { label: 'Move down', onPress: () => store().moveExercise(e.key, 1), disabled: i === exercises.length - 1 },
      { label: 'History', onPress: () => router.push(`/exercise-history/${encodeURIComponent(e.exerciseId)}`) },
      { label: 'How to do it', onPress: () => setInfoId(e.exerciseId) },
      { label: 'Remove exercise', onPress: () => store().removeExercise(e.key), destructive: true },
    ];
  }

  const supersetLabel = (e: DraftExercise) => {
    if (!e.supersetId) return null;
    const group = exercises.filter((x) => x.supersetId === e.supersetId);
    const letter = String.fromCharCode(65 + [...new Set(exercises.filter((x) => x.supersetId).map((x) => x.supersetId))].indexOf(e.supersetId));
    return `Superset ${letter}${group.indexOf(e) + 1}`;
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, gap: 12 }}>
          <Pressable onPress={() => setWorkoutMenu(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Workout options">
            <Text style={{ color: Colors.muted, fontSize: 22, fontFamily: 'DMSans-Bold' }}>⋯</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 17 }} numberOfLines={1}>{active.title || 'Workout'}</Text>
            <Elapsed since={active.startedAt} />
          </View>
          <Pressable onPress={finish} accessibilityRole="button" style={{ backgroundColor: Colors.teal, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9 }}>
            <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 14 }}>Finish</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <SayIt exerciseIds={exercises.map((e) => e.exerciseId)} onSets={logSpoken} />
          {prepare.isLoading && !prepare.data && <ActivityIndicator color={Colors.orange} />}
          {exercises.map((e) => (
            <ExerciseCard
              key={e.key}
              exercise={e}
              prepared={prepared.get(e.exerciseId)}
              unit={unit}
              supersetLabel={supersetLabel(e)}
              onOpen={() => router.push(`/exercise-history/${encodeURIComponent(e.exerciseId)}`)}
              onMenu={() => setMenuFor(e)}
              onComplete={(set) => complete(e, set)}
              onCopyPrevious={(set, prev: PastSet) => complete(e, set, { weightKg: prev.weightKg, reps: prev.reps, durationSec: prev.durationSec })}
              onUpdate={(setId, patch) => store().updateSet(e.key, setId, patch)}
              onAddSet={(warmup) => store().addSet(e.key, warmup)}
            />
          ))}
          <Pressable
            onPress={() => setPicker({ mode: 'add' })}
            accessibilityRole="button"
            style={{ borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.border, paddingVertical: 16, alignItems: 'center' }}
          >
            <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 15 }}>+ Add exercise</Text>
          </Pressable>
        </ScrollView>
        <RestBar />
      </KeyboardAvoidingView>

      <MenuSheet title={menuFor?.name ?? null} items={menuFor ? menuItems(menuFor) : []} onClose={() => setMenuFor(null)} />
      <MenuSheet
        title={workoutMenu ? 'Workout' : null}
        onClose={() => setWorkoutMenu(false)}
        items={[
          { label: 'Leave it running in the background', onPress: () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/')) },
          {
            label: 'Discard workout',
            destructive: true,
            onPress: async () => {
              if (await confirmAction({ title: 'Discard workout?', message: "Sets you've ticked won't be saved.", confirmLabel: 'Discard', destructive: true })) {
                store().discard();
                if (router.canGoBack()) router.back();
                else router.replace('/(tabs)/');
              }
            },
          },
        ]}
      />
      <ExercisePicker
        mode={picker?.mode ?? null}
        pattern={picker?.pattern}
        onClose={() => setPicker(null)}
        onPick={(x) => {
          const next = { exerciseId: x.id, name: x.name, compound: x.mechanics !== 'isolation' };
          if (picker?.mode === 'swap' && picker.key) store().swapExercise(picker.key, next);
          else store().addExercise(next);
          setPicker(null);
        }}
      />
      <PlatesSheet
        weightKg={plates?.weightKg}
        unit={unit}
        onClose={() => setPlates(undefined)}
        onAddWarmups={(sets) => plates && store().insertSets(plates.key, sets.map((s) => ({ ...s, warmup: true })), 'start')}
      />
      <ExerciseSheet id={infoId} onClose={() => setInfoId(null)} />
    </SafeAreaView>
  );
}

function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <Text style={{ color: Colors.muted, fontFamily: 'JetBrainsMono-Regular', fontSize: 12 }} accessibilityLabel="Time so far">
      {formatClock((now - new Date(since).getTime()) / 1000)}
    </Text>
  );
}

/** "bench 80 for 8, 8, 7": typed, or spoken with the keyboard's microphone. */
function SayIt({ exerciseIds, onSets }: { exerciseIds: string[]; onSets: (sets: SpokenSet[]) => void }) {
  const [text, setText] = useState('');
  const parse = useParseSets();
  const ensureAiConsent = useEnsureAiConsent();

  async function submit() {
    const t = text.trim();
    if (!t) return;
    const run = () => parse.mutateAsync({ text: t, exerciseIds });
    try {
      let res;
      try {
        res = await run();
      } catch (err: any) {
        // Phrasings the app can't read itself go to the AI, which needs consent
        if (err?.response?.data?.code !== 'ai_consent_required' || !(await ensureAiConsent())) throw err;
        res = await run();
      }
      if (!res.sets.length) {
        showToast('No sets in that. Try "bench 80 for 8, 8, 7".');
        return;
      }
      onSets(res.sets);
      setText('');
    } catch (err: any) {
      showToast(err?.response?.data?.message?.toString() ?? "Couldn't read that. Try \"bench 80 for 8, 8, 7\".");
    }
  }

  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <TextInput
        value={text}
        onChangeText={setText}
        onSubmitEditing={submit}
        returnKeyType="done"
        placeholder='Say it: "bench 80 for 8, 8, 7"'
        placeholderTextColor={Colors.muted}
        accessibilityLabel="Say or type your sets"
        maxLength={300}
        style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, color: Colors.text, paddingHorizontal: 14, fontFamily: 'DMSans-Regular', fontSize: 14 }}
      />
      <Pressable onPress={submit} disabled={parse.isPending || !text.trim()} accessibilityRole="button" accessibilityLabel="Log these sets" style={{ height: 44, paddingHorizontal: 16, borderRadius: 12, backgroundColor: text.trim() ? Colors.orange : Colors.surface2, justifyContent: 'center' }}>
        {parse.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: text.trim() ? '#fff' : Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 14 }}>Log</Text>}
      </Pressable>
    </View>
  );
}

/** After finishing: what was done, and whether it's saved yet. */
function Summary({ body, prs, volume, unit }: { body: SaveWorkoutBody; prs: string[]; volume: number; unit: 'kg' | 'lb' }) {
  const pending = useWorkoutStore((s) => s.pending.find((p) => p.body.clientId === body.clientId));
  const online = useOnlineManager();
  const minutes = Math.max(1, Math.round((new Date(body.endedAt).getTime() - new Date(body.startedAt).getTime()) / 60_000));
  const working = body.sets.filter((s) => !s.warmup).length;
  const status = !pending ? '✓ Saved' : pending.error ? `Not saved: ${pending.error}` : online ? 'Saving…' : "Saved on your phone. It'll sync when you're back online.";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark, padding: 24, gap: 18 }}>
      <View style={{ flex: 1, justifyContent: 'center', gap: 18 }}>
        <Text style={{ fontSize: 44, textAlign: 'center' }}>💪</Text>
        <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 24, textAlign: 'center' }} accessibilityRole="header">Workout done</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 28 }}>
          <Stat label="Minutes" value={String(minutes)} />
          <Stat label="Sets" value={String(working)} />
          <Stat label={`Volume (${unit})`} value={String(Math.round(kgToUnit(volume, unit)))} />
        </View>
        {prs.length > 0 && (
          <View style={{ backgroundColor: Colors.surface, borderRadius: 16, padding: 16, gap: 6 }}>
            <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 14 }}>🏆 {prs.length === 1 ? 'New personal record' : `${prs.length} personal records`}</Text>
            {prs.map((p, i) => (
              <Text key={i} style={{ color: Colors.text, fontFamily: 'DMSans-Regular', fontSize: 14 }}>{p}</Text>
            ))}
          </View>
        )}
        <Text style={{ color: pending?.error ? Colors.error : Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 14, textAlign: 'center' }} accessibilityLiveRegion="polite">{status}</Text>
        {pending?.error && (
          <Pressable onPress={() => retryWorkout(body.clientId)} accessibilityRole="button" style={{ alignSelf: 'center' }}>
            <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 15 }}>Try again</Text>
          </Pressable>
        )}
      </View>
      <Pressable onPress={() => router.replace('/(tabs)/activity')} accessibilityRole="button" style={{ backgroundColor: Colors.orange, borderRadius: 999, paddingVertical: 15, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 16 }}>Done</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ color: Colors.text, fontFamily: 'JetBrainsMono-Regular', fontSize: 24 }}>{value}</Text>
      <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12 }}>{label}</Text>
    </View>
  );
}
