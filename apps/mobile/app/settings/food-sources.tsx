import React from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { ScreenHeader, Section } from '@/components/settings/SettingsUI';
import { FOOD_SOURCES, siteName } from '@/lib/foodSources';

/** The public food tables and product data GRIT's food database is built from, with their credits. */
export default function FoodSourcesScreen() {
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}>
      <ScreenHeader title="Food data sources" />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 20, paddingBottom: 48 }}>
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14, lineHeight: 20, paddingHorizontal: 4 }}>
          GRIT's food database is built from these public food tables and product data. Foods marked ✓ Verified come from a government table or the manufacturer's own data.
        </Text>
        <Section>
          {FOOD_SOURCES.map((s, i) => (
            <View key={s.code} style={{ gap: 4, paddingTop: i ? 16 : 0, borderTopWidth: i ? 1 : 0, borderTopColor: Colors.border }}>
              <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 15 }}>{s.name}</Text>
              <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13, lineHeight: 18 }}>{s.credit}</Text>
              {!!s.notice && (
                <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13, lineHeight: 18 }}>{s.notice}</Text>
              )}
              <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12 }}>Licence: {s.licence}</Text>
              <Pressable
                onPress={() => Linking.openURL(s.url).catch(() => {})}
                accessibilityRole="link"
                accessibilityLabel={`Open the ${s.name} website`}
                hitSlop={6}
                style={({ pressed }) => ({ alignSelf: 'flex-start', marginTop: 2, opacity: pressed ? 0.6 : 1 })}
              >
                <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 13 }}>{siteName(s.url)} ›</Text>
              </Pressable>
            </View>
          ))}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}
