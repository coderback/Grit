import React from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { useAdaptive, useApplyTarget, useSnoozeTarget } from '@/hooks/useAdaptive';
import { kgToUnit, type WeightUnit } from '@/lib/units';

function Meter({ label, value, need }: { label: string; value: number; need: number }) {
  const pct = Math.min(1, value / need);
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12 }}>{label}</Text>
        <Text style={{ color: Colors.text, fontFamily: 'JetBrainsMono-Regular', fontSize: 12 }}>{Math.min(value, need)}/{need}</Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: Colors.surface2, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${pct * 100}%`, backgroundColor: pct >= 1 ? Colors.teal : Colors.orange, borderRadius: 3 }} />
      </View>
    </View>
  );
}

const CONFIDENCE = { low: 'early estimate', medium: 'getting sharper', high: 'high confidence' } as const;

/**
 * Your real daily burn, worked out from what you logged and how your weight
 * moved, and the coach's suggested target. Learns as you log.
 */
export function AdaptiveCard({ unit }: { unit: WeightUnit }) {
  const { data } = useAdaptive();
  const { mutate: apply, isPending: applying } = useApplyTarget();
  const { mutate: snooze } = useSnoozeTarget();
  if (!data) return null;

  const { estimate: est, suggestion: s, progress: p } = data;
  const card = { backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, padding: 18, marginBottom: 12, gap: 12 } as const;

  if (!est) {
    return (
      <View style={card}>
        <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 16 }}>Learning your metabolism</Text>
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13, lineHeight: 18 }}>
          Log your food and weigh in a few times a week. GRIT will work out what you really burn and tune your target to it.
        </Text>
        <Meter label="Days with food logged" value={p.loggedDays} need={p.needs.loggedDays} />
        <Meter label="Weigh-ins" value={p.weighIns} need={p.needs.weighIns} />
        <Meter label="Days since first weigh-in" value={p.spanDays} need={p.needs.spanDays} />
      </View>
    );
  }

  const trend = kgToUnit(Math.abs(est.trendKgPerWeek), unit);
  const trendText = est.trendKgPerWeek < -0.05 ? `−${trend} ${unit}/wk` : est.trendKgPerWeek > 0.05 ? `+${trend} ${unit}/wk` : 'steady';
  return (
    <View style={card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 16 }}>Your metabolism</Text>
        <View style={{ backgroundColor: `${Colors.teal}20`, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
          <Text style={{ color: Colors.teal, fontFamily: 'DMSans-Bold', fontSize: 11 }}>{CONFIDENCE[est.confidence]}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {[
          { label: 'you burn / day', value: est.tdee.toLocaleString(), color: Colors.orange },
          { label: 'you eat / day', value: est.avgIntake.toLocaleString(), color: Colors.text },
          { label: 'weight trend', value: trendText, color: Colors.text },
        ].map((x) => (
          <View key={x.label} style={{ flex: 1 }}>
            <Text style={{ color: x.color, fontFamily: 'JetBrainsMono-Regular', fontSize: 18, letterSpacing: -0.5 }}>{x.value}</Text>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 11, marginTop: 2 }}>{x.label}</Text>
          </View>
        ))}
      </View>
      <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12 }}>
        From {est.loggedDays} logged days and {est.weighIns} weigh-ins over {est.spanDays} days.
      </Text>

      {s && (
        <View style={{ backgroundColor: `${Colors.orange}12`, borderRadius: 14, borderWidth: 1, borderColor: `${Colors.orange}40`, padding: 14, gap: 10 }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 15 }}>
            Suggested target: {s.suggested.toLocaleString()} kcal <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular' }}>(now {s.current.toLocaleString()})</Text>
          </Text>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13, lineHeight: 18 }}>{s.reason}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                apply(s.suggested);
              }}
              disabled={applying}
              accessibilityRole="button"
              style={({ pressed }) => ({ flex: 1, backgroundColor: Colors.orange, borderRadius: 999, paddingVertical: 11, alignItems: 'center', opacity: applying ? 0.5 : pressed ? 0.85 : 1 })}
            >
              <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 14 }}>Use {s.suggested.toLocaleString()}</Text>
            </Pressable>
            <Pressable
              onPress={() => snooze()}
              accessibilityRole="button"
              style={({ pressed }) => ({ paddingHorizontal: 18, borderRadius: 999, paddingVertical: 11, alignItems: 'center', backgroundColor: Colors.surface2, opacity: pressed ? 0.7 : 1 })}
            >
              <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 14 }}>Not now</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
