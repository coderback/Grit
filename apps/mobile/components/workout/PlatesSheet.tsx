import React, { useState } from 'react';
import { Modal, View, Text, Pressable, TextInput } from 'react-native';
import { Colors } from '@/constants/colors';
import { platesFor, warmupsFor } from '@/lib/strength';
import { kgToUnit, unitToKg, type WeightUnit } from '@/lib/units';

const LB_PLATES = [45, 35, 25, 10, 5, 2.5];

/** Plates per side for a weight, and warm-up sets that lead up to it. */
export function PlatesSheet({ weightKg, unit, onClose, onAddWarmups }: {
  weightKg: number | null | undefined;
  unit: WeightUnit;
  onClose: () => void;
  onAddWarmups: (sets: { weightKg: number; reps: number }[]) => void;
}) {
  const visible = weightKg !== undefined;
  const [text, setText] = useState(weightKg ? String(kgToUnit(weightKg, unit)) : '');
  React.useEffect(() => setText(weightKg ? String(kgToUnit(weightKg, unit)) : ''), [weightKg, unit]);
  const shown = Number(text.replace(',', '.')) || 0;
  const bar = unit === 'lb' ? 45 : 20;
  const plates = platesFor(shown, bar, unit === 'lb' ? LB_PLATES : undefined);
  const warmups = warmupsFor(unitToKg(shown, unit));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} accessibilityLabel="Close" />
      <View style={{ backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 36, gap: 14 }}>
        <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 18 }} accessibilityRole="header">Plates and warm-ups</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TextInput
            value={text}
            onChangeText={(t) => setText(t.replace(/[^0-9.,]/g, ''))}
            keyboardType="decimal-pad"
            accessibilityLabel={`Weight in ${unit}`}
            style={{ width: 110, height: 44, borderRadius: 12, backgroundColor: Colors.surface2, color: Colors.text, textAlign: 'center', fontFamily: 'JetBrainsMono-Regular', fontSize: 18 }}
          />
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 14 }}>{unit} on a {bar} {unit} bar</Text>
        </View>
        <Text style={{ color: Colors.text, fontFamily: 'JetBrainsMono-Regular', fontSize: 15 }} accessibilityLabel="Plates on each side">
          Each side: {plates.perSide.length ? plates.perSide.join(' + ') : 'just the bar'}
          {plates.rest > 0 ? `  (${plates.rest} ${unit} short: needs smaller plates)` : ''}
        </Text>
        {warmups.length > 0 && (
          <View style={{ gap: 6 }}>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 12, letterSpacing: 0.6 }}>WARM-UP</Text>
            <Text style={{ color: Colors.text, fontFamily: 'JetBrainsMono-Regular', fontSize: 14 }}>
              {warmups.map((w) => `${kgToUnit(w.weightKg, unit)}×${w.reps}`).join('   ')}
            </Text>
            <Pressable
              onPress={() => {
                onAddWarmups(warmups);
                onClose();
              }}
              accessibilityRole="button"
              style={{ alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: Colors.orange }}
            >
              <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 14 }}>Add warm-up sets</Text>
            </Pressable>
          </View>
        )}
        <Pressable onPress={onClose} accessibilityRole="button" style={{ alignItems: 'center', paddingTop: 6 }}>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 15 }}>Close</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
