import React from 'react';
import { ScrollView, Text, View, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { ScreenHeader, Section } from '@/components/settings/SettingsUI';
import { ErrorNotice } from '@/components/ui/QueryStatus';
import { useFoodMemories, useForgetFood } from '@/hooks/useSmartLog';
import { confirmAction } from '@/lib/confirm';

/** The foods smart log has learned from what you confirmed, and a way to forget them. */
export default function FoodMemoryScreen() {
  const { data, isLoading, isError, refetch } = useFoodMemories();
  const { mutate: forget } = useForgetFood();

  async function handleForget(id: string, name: string) {
    const ok = await confirmAction({
      title: `Forget ${name}?`,
      message: 'Smart log will estimate it again next time, until you confirm a new portion.',
      confirmLabel: 'Forget',
      destructive: true,
    });
    if (ok) forget(id);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark }} edges={['top']}>
      <ScreenHeader title="Foods GRIT knows" />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 20, paddingBottom: 60 }}>
        {isError && !data ? (
          <ErrorNotice what="your foods" onRetry={() => refetch()} />
        ) : isLoading ? (
          <ActivityIndicator color={Colors.orange} />
        ) : !data?.length ? (
          <Section footer="When you log a meal with ✨ Smart log, GRIT remembers each food's nutrition and your usual portion, so the next reading starts from your numbers.">
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14 }}>Nothing yet.</Text>
          </Section>
        ) : (
          <Section footer="Learned from meals you confirmed with Smart log. Forget a food if its numbers are wrong.">
            {data.map((m) => (
              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 15, textTransform: 'capitalize' }}>{m.name}</Text>
                  <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12 }}>
                    Usually {Math.round(m.usualGrams)} g · {Math.round(m.kcalPer100g)} kcal per 100 g · logged {m.uses}×
                  </Text>
                </View>
                <Pressable onPress={() => handleForget(m.id, m.name)} accessibilityRole="button" accessibilityLabel={`Forget ${m.name}`} hitSlop={8}>
                  <Text style={{ color: Colors.error, fontFamily: 'DMSans-Medium', fontSize: 13 }}>Forget</Text>
                </Pressable>
              </View>
            ))}
          </Section>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
