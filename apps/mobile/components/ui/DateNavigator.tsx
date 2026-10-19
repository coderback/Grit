import React from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';

/** ‹ label › stepper. The forward arrow stops at the present. */
export function DateNavigator({
  label,
  onPrev,
  onNext,
  canGoNext,
  onReset,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  canGoNext: boolean;
  /** Tapping the label jumps back to the present (shown when away from it) */
  onReset?: () => void;
}) {
  const arrow = (dir: 'prev' | 'next', enabled: boolean, onPress: () => void) => (
    <Pressable
      onPress={() => {
        if (!enabled) return;
        Haptics.selectionAsync();
        onPress();
      }}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={dir === 'prev' ? 'Previous' : 'Next'}
      aria-disabled={!enabled}
      hitSlop={8}
      style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface2, opacity: enabled ? 1 : 0.35 }}
    >
      <Text style={{ color: Colors.text, fontSize: 18, marginTop: -2 }}>{dir === 'prev' ? '‹' : '›'}</Text>
    </Pressable>
  );

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {arrow('prev', true, onPrev)}
      <Pressable onPress={onReset} disabled={!onReset} accessibilityRole={onReset ? 'button' : 'text'} style={{ flex: 1, alignItems: 'center' }}>
        <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 15 }}>{label}</Text>
        {!!onReset && <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Regular', fontSize: 11, marginTop: 1 }}>Back to today</Text>}
      </Pressable>
      {arrow('next', canGoNext, onNext)}
    </View>
  );
}
