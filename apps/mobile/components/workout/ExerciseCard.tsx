import React from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { Colors } from '@/constants/colors';
import { kgToUnit, unitToKg, type WeightUnit } from '@/lib/units';
import type { DraftExercise, DraftSet } from '@/stores/workoutStore';
import type { PastSet, PreparedExercise } from '@/hooks/useWorkouts';
import { PR_LABELS } from '@/lib/strength';

const ACTION_ICON: Record<string, string> = { increase: '↑', reps: '+1', hold: '=', deload: '↓', start: '•' };

function fmtSet(s: PastSet, unit: WeightUnit) {
  if (s.durationSec) return `${s.durationSec}s`;
  return s.weightKg ? `${kgToUnit(s.weightKg, unit)}×${s.reps}` : `${s.reps}`;
}

/** One exercise in the workout: last time, today's target, and its sets. */
export function ExerciseCard({
  exercise, prepared, unit, supersetLabel, onOpen, onMenu, onComplete, onCopyPrevious, onUpdate, onAddSet,
}: {
  exercise: DraftExercise;
  prepared: PreparedExercise | undefined;
  unit: WeightUnit;
  supersetLabel: string | null;
  onOpen: () => void;
  onMenu: () => void;
  onComplete: (set: DraftSet) => void;
  onCopyPrevious: (set: DraftSet, previous: PastSet) => void;
  onUpdate: (setId: string, patch: Partial<DraftSet>) => void;
  onAddSet: (warmup: boolean) => void;
}) {
  const s = prepared?.suggestion;
  const timed = !!prepared?.timed;
  const previous = prepared?.last?.sets ?? [];
  let working = -1;

  return (
    <View style={{ backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1.5, borderColor: supersetLabel ? Colors.teal : Colors.border, padding: 14, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <Pressable onPress={onOpen} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={`${exercise.name}. Show history`}>
          {!!supersetLabel && (
            <Text style={{ color: Colors.teal, fontFamily: 'DMSans-Bold', fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' }}>{supersetLabel}</Text>
          )}
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 16 }}>{exercise.name}</Text>
          {!!exercise.detail && <Text style={{ color: Colors.muted, fontFamily: 'JetBrainsMono-Regular', fontSize: 12, marginTop: 2 }}>{exercise.detail}</Text>}
        </Pressable>
        <Pressable onPress={onMenu} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Options for ${exercise.name}`} style={{ paddingHorizontal: 6 }}>
          <Text style={{ color: Colors.muted, fontSize: 20, fontFamily: 'DMSans-Bold' }}>⋯</Text>
        </Pressable>
      </View>

      {!!s && (
        <View style={{ backgroundColor: Colors.surface2, borderRadius: 12, padding: 10, gap: 3 }} accessibilityLabel={`Today: ${s.reasons.join(' ')}`}>
          <Text style={{ color: s.holds.length ? Colors.blue : Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 13 }}>
            {ACTION_ICON[s.action]} {s.weightKg ? `${kgToUnit(s.weightKg, unit)} ${unit} × ${s.reps}` : s.action === 'start' ? `Start with ${s.reps} reps` : `${s.reps} reps`}
          </Text>
          {s.reasons.map((r, i) => (
            <Text key={i} style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12, lineHeight: 17 }}>{r}</Text>
          ))}
          {!!prepared?.historyFrom && (
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 11 }}>Based on your {prepared.historyFrom.name}.</Text>
          )}
        </View>
      )}

      <View style={{ flexDirection: 'row', paddingHorizontal: 4 }}>
        <Text style={headStyle(36)}>SET</Text>
        <Text style={[headStyle(0), { flex: 1 }]}>LAST</Text>
        {!timed && <Text style={headStyle(70)}>{unit.toUpperCase()}</Text>}
        <Text style={headStyle(56)}>{timed ? 'SEC' : 'REPS'}</Text>
        <View style={{ width: 44 }} />
      </View>

      {exercise.sets.map((set) => {
        if (!set.warmup) working++;
        const prev = set.warmup ? undefined : previous[working];
        const label = set.warmup ? 'W' : String(working + 1);
        return (
          <View key={set.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: set.done ? `${Colors.teal}18` : 'transparent', borderRadius: 10, paddingVertical: 4, paddingHorizontal: 4 }}>
            <Text style={{ width: 30, color: set.warmup ? Colors.muted : Colors.text, fontFamily: 'JetBrainsMono-Regular', fontSize: 13 }}>{label}</Text>
            <Pressable
              style={{ flex: 1 }}
              disabled={!prev || set.done}
              onPress={() => prev && onCopyPrevious(set, prev)}
              accessibilityRole="button"
              accessibilityLabel={prev ? `Repeat last time: ${fmtSet(prev, unit)}` : undefined}
            >
              <Text style={{ color: prev ? Colors.muted : `${Colors.muted}66`, fontFamily: 'JetBrainsMono-Regular', fontSize: 12, textDecorationLine: prev && !set.done ? 'underline' : 'none' }}>
                {prev ? fmtSet(prev, unit) : '—'}
              </Text>
            </Pressable>
            {!timed && (
              <NumberBox
                width={70}
                value={set.weightKg != null ? kgToUnit(set.weightKg, unit) : null}
                onChange={(v) => onUpdate(set.id, { weightKg: v == null ? null : unitToKg(v, unit) })}
                decimal
                label={`Set ${label} weight in ${unit}`}
                placeholder="—"
              />
            )}
            <NumberBox
              width={56}
              value={timed ? set.durationSec : set.reps}
              onChange={(v) => onUpdate(set.id, timed ? { durationSec: v } : { reps: v })}
              label={`Set ${label} ${timed ? 'seconds' : 'reps'}`}
              placeholder="0"
            />
            <Pressable
              onPress={() => onComplete(set)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: set.done }}
              aria-checked={set.done}
              accessibilityLabel={`Set ${label} done`}
              style={{ width: 38, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: set.done ? Colors.teal : Colors.surface2, marginLeft: 6 }}
            >
              <Text style={{ color: set.done ? '#fff' : Colors.muted, fontSize: 16, fontFamily: 'DMSans-Bold' }}>✓</Text>
            </Pressable>
            {!!set.pr && (
              <Text style={{ position: 'absolute', right: 48, top: -6, color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 10 }} accessibilityLabel={`Personal record: ${PR_LABELS[set.pr]}`}>🏆 PR</Text>
            )}
          </View>
        );
      })}

      <View style={{ flexDirection: 'row', gap: 16, paddingTop: 2 }}>
        <Pressable onPress={() => onAddSet(false)} accessibilityRole="button">
          <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 13 }}>+ Add set</Text>
        </Pressable>
        {!timed && (
          <Pressable onPress={() => onAddSet(true)} accessibilityRole="button">
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 13 }}>+ Warm-up</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const headStyle = (width: number) => ({
  ...(width ? { width } : {}),
  color: Colors.muted,
  fontFamily: 'DMSans-Bold' as const,
  fontSize: 10,
  letterSpacing: 0.6,
});

function NumberBox({ value, onChange, width, decimal, label, placeholder }: {
  value: number | null;
  onChange: (v: number | null) => void;
  width: number;
  decimal?: boolean;
  label: string;
  placeholder: string;
}) {
  const [text, setText] = React.useState(value != null ? String(value) : '');
  // Follow changes made elsewhere (prefill, Say it), but not while typing "8."
  React.useEffect(() => {
    const parsed = text === '' ? null : Number(text.replace(',', '.'));
    if (parsed !== value) setText(value != null ? String(value) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <TextInput
      value={text}
      onChangeText={(t) => {
        const clean = t.replace(',', '.').replace(decimal ? /[^0-9.]/g : /[^0-9]/g, '');
        setText(clean);
        const n = clean === '' ? null : Number(clean);
        if (n == null || Number.isFinite(n)) onChange(n);
      }}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      selectTextOnFocus
      placeholder={placeholder}
      placeholderTextColor={`${Colors.muted}88`}
      accessibilityLabel={label}
      maxLength={6}
      style={{ width, height: 34, borderRadius: 10, backgroundColor: Colors.surface2, color: Colors.text, textAlign: 'center', fontFamily: 'JetBrainsMono-Regular', fontSize: 14, paddingVertical: 0 }}
    />
  );
}
