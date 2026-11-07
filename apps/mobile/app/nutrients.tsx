import React, { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/colors';
import { ScreenHeader, Section } from '@/components/settings/SettingsUI';
import { DateNavigator } from '@/components/ui/DateNavigator';
import { ErrorNotice } from '@/components/ui/QueryStatus';
import { useNutrientsDay } from '@/hooks/useNutrients';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { addDaysStr, dayLabel, localDateStr } from '@/lib/date';
import {
  amountText, barFraction, barTone, coverageNote, nutrientA11yLabel, nutrientSections, percentText, sourcesLine, statusTag,
  type DayNutrient,
} from '@/lib/nutrients';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** One nutrient: amount against its target or limit, as a bar. */
function NutrientRow({ n, isToday, inProgress }: { n: DayNutrient; isToday: boolean; inProgress: boolean }) {
  const tag = statusTag(n.status, inProgress);
  const tone = barTone(n.status, inProgress);
  // Without enough data the bar stays grey, so nothing reads as low
  const fill = tone === 'muted' ? `${Colors.muted}60` : Colors[tone];
  const sources = sourcesLine(n, isToday);
  const percent = percentText(n.percent);
  return (
    <View accessible accessibilityLabel={`${nutrientA11yLabel(n, inProgress)}${sources ? `. ${sources}` : ''}`} style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ flexShrink: 1, color: Colors.text, fontFamily: 'DMSans-Medium', fontSize: 14 }}>{n.name}</Text>
        {tag && tag.tone === 'muted' && (
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 11 }}>{tag.text}</Text>
        )}
        {tag && tag.tone !== 'muted' && (
          <View style={{ backgroundColor: `${Colors[tag.tone]}20`, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ color: Colors[tag.tone], fontFamily: 'DMSans-Bold', fontSize: 10 }}>{tag.text}</Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        {!!percent && (
          <Text style={{ color: tone === 'muted' ? Colors.muted : Colors.text, fontFamily: 'JetBrainsMono-Regular', fontSize: 13 }}>{percent}</Text>
        )}
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: Colors.surface2, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${barFraction(n.percent) * 100}%`, backgroundColor: fill, borderRadius: 3 }} />
      </View>
      <Text style={{ color: Colors.muted, fontFamily: 'JetBrainsMono-Regular', fontSize: 11 }}>{amountText(n)}</Text>
      {!!sources && (
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12, lineHeight: 16 }}>{sources}</Text>
      )}
    </View>
  );
}

/**
 * Vitamins, minerals, fibre, sodium and saturated fat for a day, against
 * targets for the user's age and sex. Only foods from GRIT's database carry
 * this data, so the screen says how much of the day it's based on.
 */
/**
 * Whether there's anything to show: vitamins and minerals, or sodium,
 * saturated fat and fibre (which branded labels carry even without them).
 */
function hasAnyData(data: { coverage: number; nutrients: { kind: string; coverage: number }[] }) {
  return data.coverage > 0 || data.nutrients.some((n) => n.kind !== 'none' && n.coverage > 0);
}

export default function NutrientsScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const today = localDateStr();
  const yesterday = addDaysStr(today, -1);
  const [date, setDate] = useState(() =>
    typeof params.date === 'string' && DATE_RE.test(params.date) && params.date <= today ? params.date : today,
  );
  const { data, isLoading, isError, refetch } = useNutrientsDay(date);
  const { refreshing, onRefresh } = usePullToRefresh([['nutrients-day', date]]);
  const isToday = date === today;
  // Today is still being logged: no Low tags yet (a passed limit still shows)
  const inProgress = data?.inProgress === true;

  const card = { backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 6 } as const;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}>
      <ScreenHeader title="Nutrients" />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 20, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.orange} />}
      >
        <DateNavigator
          label={dayLabel(date, today)}
          onPrev={() => setDate((d) => addDaysStr(d, -1))}
          onNext={() => setDate((d) => addDaysStr(d, 1))}
          canGoNext={date < today}
          onReset={isToday ? undefined : () => setDate(today)}
        />

        {isError && !data ? (
          <ErrorNotice what="your nutrients" onRetry={() => refetch()} />
        ) : isLoading || !data ? (
          <ActivityIndicator color={Colors.orange} />
        ) : !hasAnyData(data) ? (
          <View style={{ ...card, alignItems: 'center', padding: 24, gap: 8 }}>
            <Text style={{ fontSize: 32 }}>🥦</Text>
            <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 16, textAlign: 'center' }}>
              {data.entries === 0 ? 'Nothing logged yet' : 'No vitamin and mineral data yet'}
            </Text>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13, lineHeight: 18, textAlign: 'center' }}>
              Log foods from the food database to see vitamins and minerals.
            </Text>
          </View>
        ) : (
          <>
            <View style={card}>
              <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 15 }}>
                {data.coverage > 0
                  ? coverageNote(data.coverage, date, today, yesterday)
                  : 'No vitamin and mineral data for this day'}
              </Text>
              {data.coverage < 0.995 && (
                <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12, lineHeight: 17 }}>
                  Vitamins and minerals come from foods in the food database. Foods typed in by hand and Smart log estimates aren't counted.
                </Text>
              )}
              {inProgress ? (
                <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12, lineHeight: 17 }}>
                  Today isn't over yet, so nothing is marked low until it is.
                </Text>
              ) : !data.judged && (
                <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12, lineHeight: 17 }}>
                  Nothing is marked low until more of the day is logged.
                </Text>
              )}
            </View>

            {nutrientSections(data.nutrients).map((s) => (
              <Section key={s.title} title={s.title}>
                {s.items.map((n) => <NutrientRow key={n.code} n={n} isToday={isToday} inProgress={inProgress} />)}
              </Section>
            ))}
          </>
        )}

        <View style={{ gap: 10, paddingHorizontal: 4 }}>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12, lineHeight: 17 }}>
            Targets are US Dietary Reference Intakes for your age and sex. They don't cover pregnancy or breastfeeding.
          </Text>
          <Pressable
            onPress={() => router.push('/settings/food-sources')}
            accessibilityRole="button"
            accessibilityLabel="Food data sources"
            hitSlop={8}
            style={({ pressed }) => ({ alignSelf: 'flex-start', opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 13 }}>Food data sources ›</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
