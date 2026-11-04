import React, { useState } from 'react';
import { View, Text } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { SheetTextInput, sheetKeyboardProps } from '@/components/ui/SheetTextInput';
import { Button } from '@/components/ui/Button';
import { useHideTabBar } from '@/stores/uiStore';
import { useLogWeight } from '@/hooks/useProgress';
import { kgToUnit, unitToKg, type WeightUnit } from '@/lib/units';
import { notify } from '@/lib/confirm';
import { Colors } from '@/constants/colors';

/** Today's weigh-in. Logging again today replaces it. */
export function LogWeightSheet({ unit, lastKg, onClose }: { unit: WeightUnit; lastKg: number | null; onClose: () => void }) {
  useHideTabBar();
  const { mutateAsync: logWeight, isPending } = useLogWeight();
  const [value, setValue] = useState(lastKg ? String(kgToUnit(lastKg, unit)) : '');

  const parsed = parseFloat(value.replace(',', '.'));
  const kg = Number.isFinite(parsed) ? unitToKg(parsed, unit) : null;
  const invalid = kg === null || kg < 20 || kg > 400;

  async function save() {
    if (invalid || kg === null) return;
    try {
      await logWeight({ weightKg: kg });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (err: any) {
      notify("Couldn't save your weight", err?.response?.data?.message?.toString() ?? 'Check your connection and try again.');
    }
  }

  return (
    <BottomSheet
      snapPoints={['45%']}
      enablePanDownToClose
      onClose={onClose}
      {...sheetKeyboardProps}
      backgroundStyle={{ backgroundColor: Colors.surface }}
      handleIndicatorStyle={{ backgroundColor: Colors.muted }}
    >
      <BottomSheetView style={{ padding: 24, gap: 18 }}>
        <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 20 }}>Log today's weight</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface2, borderRadius: 16, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 16 }}>
          <SheetTextInput
            value={value}
            onChangeText={(t) => setValue(t.replace(/[^0-9.,]/g, ''))}
            keyboardType="decimal-pad"
            placeholder={unit === 'lb' ? '165' : '75'}
            placeholderTextColor={Colors.muted}
            accessibilityLabel={`Weight in ${unit}`}
            autoFocus
            style={{ flex: 1, color: Colors.text, fontFamily: 'JetBrainsMono-Regular', fontSize: 24, paddingVertical: 14 }}
          />
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 16 }}>{unit}</Text>
        </View>
        {value.trim() !== '' && invalid && (
          <Text style={{ color: Colors.error, fontFamily: 'DMSans-Regular', fontSize: 12, marginTop: -8 }}>Enter a realistic weight.</Text>
        )}
        <Button label="Save" onPress={save} loading={isPending} disabled={invalid} />
      </BottomSheetView>
    </BottomSheet>
  );
}
