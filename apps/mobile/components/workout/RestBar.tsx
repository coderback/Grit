import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { formatClock } from '@/lib/strength';
import { useWorkoutStore } from '@/stores/workoutStore';

/** The rest timer between sets, pinned to the bottom of the workout. */
export function RestBar() {
  const rest = useWorkoutStore((s) => s.rest);
  const extend = useWorkoutStore((s) => s.extendRest);
  const clear = useWorkoutStore((s) => s.clearRest);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!rest) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [rest]);

  const left = rest ? Math.ceil((rest.endsAt - now) / 1000) : 0;
  useEffect(() => {
    if (rest && left <= 0) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      clear();
    }
  }, [rest, left, clear]);

  if (!rest || left <= 0) return null;
  const pct = Math.max(0, Math.min(1, left / rest.totalSec));
  return (
    <View accessibilityLiveRegion="polite" style={{ backgroundColor: Colors.surface, borderTopWidth: 1, borderColor: Colors.border, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14, gap: 8 }}>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: Colors.surface2, overflow: 'hidden' }}>
        <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: Colors.teal }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 13, flex: 1 }}>{rest.label}</Text>
        <Text style={{ color: Colors.text, fontFamily: 'JetBrainsMono-Regular', fontSize: 20 }} accessibilityLabel={`Rest, ${left} seconds left`}>{formatClock(left)}</Text>
        <Pressable onPress={() => extend(30)} accessibilityRole="button" accessibilityLabel="Add 30 seconds" style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: Colors.surface2 }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 13 }}>+30s</Text>
        </Pressable>
        <Pressable onPress={clear} accessibilityRole="button" accessibilityLabel="Skip rest" style={{ paddingHorizontal: 10, paddingVertical: 6 }}>
          <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 13 }}>Skip</Text>
        </Pressable>
      </View>
    </View>
  );
}
