import React, { useRef, useState } from 'react';
import { View, Text, Pressable, Switch } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { SheetTextInput, sheetKeyboardProps } from '@/components/ui/SheetTextInput';
import { Button } from '@/components/ui/Button';
import { ACTIVITY_LABELS } from '@/components/activity/LogActivitySheet';
import { useUpdatePlanDay, WEEKDAY_NAMES, type PlanDay, type PlanExercise } from '@/hooks/useWorkoutPlan';
import { useHideTabBar } from '@/stores/uiStore';
import { notify } from '@/lib/confirm';
import { Colors } from '@/constants/colors';

const MAX_EXERCISES = 12;

const inputStyle = {
  backgroundColor: Colors.surface2,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: Colors.border,
  paddingHorizontal: 12,
  paddingVertical: 10,
  color: Colors.text,
  fontFamily: 'DMSans-Regular',
  fontSize: 14,
} as const;

/** Edit one day of the plan by hand: rest or train, title, type, length and exercises. */
export function EditPlanDaySheet({ day, onClose }: { day: PlanDay; onClose: () => void }) {
  const sheetRef = useRef<BottomSheet>(null);
  useHideTabBar();
  const { mutateAsync: save, isPending } = useUpdatePlanDay();

  const [rest, setRest] = useState(day.rest);
  const [title, setTitle] = useState(day.title);
  const [activityType, setActivityType] = useState(day.rest ? 'strength_training' : day.activityType);
  const [duration, setDuration] = useState(String(day.durationMin || 30));
  const [exercises, setExercises] = useState<PlanExercise[]>(day.exercises);

  const durationMin = Number(duration);
  const invalid = !rest && (!title.trim() || !durationMin || durationMin > 240 || exercises.some((e) => !e.name.trim()));

  function setExercise(i: number, patch: Partial<PlanExercise>) {
    setExercises((list) => list.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  }

  async function handleSave() {
    if (invalid) return;
    try {
      await save(
        rest
          ? { day: day.day, rest: true, title: title.trim() || 'Rest', activityType: 'other', durationMin: 0, exercises: [] }
          : {
              day: day.day,
              rest: false,
              title: title.trim(),
              activityType,
              durationMin,
              exercises: exercises.map((e) => ({ name: e.name.trim(), detail: e.detail.trim() })),
            },
      );
      onClose();
    } catch (err: any) {
      notify("Couldn't save", err?.response?.data?.message?.toString() ?? 'Check your connection and try again.');
    }
  }

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={['85%']}
      enablePanDownToClose
      onClose={onClose}
      {...sheetKeyboardProps}
      backgroundStyle={{ backgroundColor: Colors.surface }}
      handleIndicatorStyle={{ backgroundColor: Colors.muted }}
    >
      <BottomSheetScrollView contentContainerStyle={{ padding: 24, gap: 18, paddingBottom: 48 }}>
        <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 20 }}>{WEEKDAY_NAMES[day.day]}</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ flex: 1, color: Colors.text, fontFamily: 'DMSans-Medium', fontSize: 15 }}>Rest day</Text>
          <Switch value={rest} onValueChange={setRest} accessibilityLabel="Rest day" trackColor={{ false: Colors.surface3, true: Colors.orange }} thumbColor="#fff" />
        </View>

        <SheetTextInput value={title} onChangeText={setTitle} placeholder={rest ? 'Rest' : 'e.g. Upper body'} placeholderTextColor={Colors.muted} maxLength={60} style={inputStyle} accessibilityLabel="Title" />

        {!rest && (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {Object.entries(ACTIVITY_LABELS).map(([type, label]) => (
                <Pressable
                  key={type}
                  onPress={() => setActivityType(type)}
                  accessibilityRole="radio"
                  aria-selected={activityType === type}
                  style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: activityType === type ? Colors.orange : Colors.surface2, borderWidth: 1, borderColor: activityType === type ? Colors.orange : Colors.border }}
                >
                  <Text style={{ color: activityType === type ? '#fff' : Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12 }}>{label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ color: Colors.text, fontFamily: 'DMSans-Medium', fontSize: 14 }}>Minutes</Text>
              <SheetTextInput value={duration} onChangeText={(t) => setDuration(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={3} style={{ ...inputStyle, width: 80, fontFamily: 'JetBrainsMono-Regular' }} accessibilityLabel="Minutes" />
            </View>

            <View style={{ gap: 10 }}>
              <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>Exercises</Text>
              {exercises.map((e, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <SheetTextInput value={e.name} onChangeText={(t) => setExercise(i, { name: t })} placeholder="Exercise" placeholderTextColor={Colors.muted} maxLength={80} style={{ ...inputStyle, flex: 2 }} accessibilityLabel={`Exercise ${i + 1}`} />
                  <SheetTextInput value={e.detail} onChangeText={(t) => setExercise(i, { detail: t })} placeholder="3 × 12" placeholderTextColor={Colors.muted} maxLength={60} style={{ ...inputStyle, flex: 1 }} accessibilityLabel={`Sets for exercise ${i + 1}`} />
                  <Pressable onPress={() => setExercises((list) => list.filter((_, j) => j !== i))} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove exercise ${i + 1}`}>
                    <Text style={{ color: Colors.muted, fontSize: 18 }}>✕</Text>
                  </Pressable>
                </View>
              ))}
              {exercises.length < MAX_EXERCISES && (
                <Pressable onPress={() => setExercises((list) => [...list, { name: '', detail: '' }])} accessibilityRole="button">
                  <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 14 }}>+ Add exercise</Text>
                </Pressable>
              )}
            </View>
          </>
        )}

        <Button label="Save day" onPress={handleSave} loading={isPending} disabled={invalid} />
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
