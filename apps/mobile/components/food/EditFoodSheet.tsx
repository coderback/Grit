import React, { useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { SheetTextInput, sheetKeyboardProps } from '@/components/ui/SheetTextInput';
import { Button } from '@/components/ui/Button';
import { useDeleteFoodLog, useUpdateFoodLog, type FoodLog } from '@/hooks/useFoodLog';
import { useHideTabBar } from '@/stores/uiStore';
import { confirmAction, notify } from '@/lib/confirm';
import { Colors } from '@/constants/colors';

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

const fieldStyle = {
  backgroundColor: Colors.surface2,
  borderRadius: 14,
  padding: 12,
  color: Colors.text,
  fontFamily: 'JetBrainsMono-Regular',
  fontSize: 16,
  borderWidth: 1.5,
  borderColor: Colors.border,
} as const;

const round1 = (n: number) => String(Math.round(n * 10) / 10);
const parse = (s: string) => (s.trim() === '' ? NaN : Number(s));

/** Edit or delete something already logged. Values are the totals for what was eaten. */
export function EditFoodSheet({ log, onClose }: { log: FoodLog; onClose: () => void }) {
  const sheetRef = useRef<BottomSheet>(null);
  useHideTabBar();
  const { mutateAsync: update, isPending: saving } = useUpdateFoodLog();
  const { mutateAsync: remove, isPending: deleting } = useDeleteFoodLog();

  const [name, setName] = useState(log.name);
  const [meal, setMeal] = useState(log.mealType);
  const [values, setValues] = useState({
    calories: round1(log.calories),
    proteinG: round1(log.proteinG),
    carbsG: round1(log.carbsG),
    fatG: round1(log.fatG),
  });

  const nums = { calories: parse(values.calories), proteinG: parse(values.proteinG), carbsG: parse(values.carbsG), fatG: parse(values.fatG) };
  const invalid =
    !name.trim() ||
    Object.values(nums).some((n) => Number.isNaN(n) || n < 0) ||
    nums.calories > 20000;

  async function handleSave() {
    if (invalid) return;
    try {
      await update({ id: log.id, name: name.trim(), mealType: meal, ...nums });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (err: any) {
      notify("Couldn't save", err?.response?.data?.message?.toString() ?? 'Check your connection and try again.');
    }
  }

  async function handleDelete() {
    const ok = await confirmAction({ title: 'Delete entry', message: `Remove "${log.name}" from this day's log?`, confirmLabel: 'Delete', destructive: true });
    if (!ok) return;
    try {
      await remove(log.id);
      onClose();
    } catch {
      notify("Couldn't delete", 'Check your connection and try again.');
    }
  }

  const field = (key: keyof typeof values, label: string, color: string) => (
    <View style={{ flex: 1, gap: 6 }}>
      <Text style={{ color, fontFamily: 'DMSans-Medium', fontSize: 12 }}>{label}</Text>
      <SheetTextInput
        value={values[key]}
        onChangeText={(t) => setValues((v) => ({ ...v, [key]: t.replace(/[^0-9.]/g, '') }))}
        keyboardType="decimal-pad"
        style={fieldStyle}
        accessibilityLabel={label}
      />
    </View>
  );

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={['72%']}
      enablePanDownToClose
      onClose={onClose}
      {...sheetKeyboardProps}
      backgroundStyle={{ backgroundColor: Colors.surface }}
      handleIndicatorStyle={{ backgroundColor: Colors.muted }}
    >
      <BottomSheetScrollView contentContainerStyle={{ padding: 24, gap: 18, paddingBottom: 40 }}>
        <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 20 }}>Edit entry</Text>

        <SheetTextInput
          value={name}
          onChangeText={setName}
          placeholder="Food name"
          placeholderTextColor={Colors.muted}
          style={{ ...fieldStyle, fontFamily: 'DMSans-Regular' }}
          accessibilityLabel="Food name"
        />

        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {MEALS.map((m) => (
            <Pressable
              key={m}
              onPress={() => setMeal(m)}
              accessibilityRole="radio"
              aria-selected={meal === m}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: meal === m ? Colors.orange : Colors.surface2, borderWidth: 1, borderColor: meal === m ? Colors.orange : Colors.border }}
            >
              <Text style={{ color: meal === m ? '#fff' : Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 13, textTransform: 'capitalize' }}>{m}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {field('calories', 'kcal', Colors.text)}
          {field('proteinG', 'Protein g', Colors.blue)}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {field('carbsG', 'Carbs g', Colors.orange)}
          {field('fatG', 'Fat g', Colors.teal)}
        </View>

        <Button label="Save changes" onPress={handleSave} loading={saving} disabled={invalid} />
        <Pressable onPress={handleDelete} disabled={deleting} accessibilityRole="button" style={{ alignItems: 'center', paddingVertical: 6 }}>
          <Text style={{ color: Colors.error, fontFamily: 'DMSans-Bold', fontSize: 14 }}>{deleting ? 'Deleting…' : 'Delete entry'}</Text>
        </Pressable>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
