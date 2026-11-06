import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useNutrientsWeek } from '@/hooks/useNutrients';
import { localDateStr } from '@/lib/date';
import { lowDaysText } from '@/lib/nutrients';

/**
 * Vitamins and minerals that were low on most of the week's well-logged
 * days. Hidden when nothing was. Opens the Nutrients screen.
 *
 * `week` is any day of the week (YYYY-MM-DD); undefined means this week.
 */
export function LowNutrientsCard({ week }: { week?: string }) {
  const { data } = useNutrientsWeek(week);
  if (!data?.oftenLow?.length) return null;

  const today = localDateStr();
  // A past week opens on its last day
  const openDate = data.weekEnd < today ? data.weekEnd : undefined;
  const names = data.oftenLow.map((n) => n.name).join(', ');

  return (
    <Pressable
      onPress={() => router.push(openDate ? { pathname: '/nutrients', params: { date: openDate } } : '/nutrients')}
      accessibilityRole="button"
      accessibilityLabel={`Often low ${week ? 'that' : 'this'} week: ${names}. Open nutrients`}
      style={({ pressed }) => ({ backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, padding: 18, marginBottom: 12, gap: 12, opacity: pressed ? 0.85 : 1 })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 16 }}>Often low {week ? 'that' : 'this'} week</Text>
        <Text style={{ color: Colors.muted, fontSize: 16 }}>›</Text>
      </View>
      {data.oftenLow.map((n) => (
        <View key={n.code} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.orange }} />
          <Text style={{ flex: 1, color: Colors.text, fontFamily: 'DMSans-Medium', fontSize: 14 }}>{n.name}</Text>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12 }}>{lowDaysText(n)}</Text>
        </View>
      ))}
      <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12, lineHeight: 17 }}>
        From days with enough food logged. Tap for each day's numbers and good sources.
      </Text>
    </Pressable>
  );
}
