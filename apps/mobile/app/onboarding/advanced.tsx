import React from 'react';
import { View, Text, Pressable, ScrollView, Switch } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { useOnboardingStore } from '../../stores/onboardingStore';

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <View style={{ height: 3, backgroundColor: Colors.surface2, borderRadius: 2 }}>
      <View style={{ height: 3, backgroundColor: Colors.orange, borderRadius: 2, width: `${(step / total) * 100}%` }} />
    </View>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onToggle,
}: {
  label: string;
  description: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={{
        backgroundColor: Colors.surface,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: 18,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: Colors.text, fontFamily: 'DMSans-Medium', fontSize: 15 }}>{label}</Text>
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13 }}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: Colors.surface2, true: `${Colors.orange}66` }}
        thumbColor={value ? Colors.orange : Colors.muted}
        ios_backgroundColor={Colors.surface2}
      />
    </Pressable>
  );
}

export default function AdvancedScreen() {
  const { earnbackCalories, rolloverCalories, set } = useOnboardingStore();

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <ProgressBar step={7} total={9} />

        <View style={{ gap: 6 }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 28, letterSpacing: -0.5 }}>
            Advanced preferences
          </Text>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 15 }}>
            Fine-tune how your calories are tracked. You can change these later.
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          <ToggleRow
            label="Add burned calories back"
            description="Calories from exercise are added to your daily goal"
            value={earnbackCalories}
            onToggle={() => set({ earnbackCalories: !earnbackCalories })}
          />
          <ToggleRow
            label="Roll over extra calories"
            description="Unused calories from today carry over to tomorrow"
            value={rolloverCalories}
            onToggle={() => set({ rolloverCalories: !rolloverCalories })}
          />
        </View>

        <View style={{ backgroundColor: Colors.surface2, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border }}>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13, lineHeight: 20 }}>
            These settings affect how your calorie budget adjusts day-to-day. Most people leave these off for simpler tracking.
          </Text>
        </View>

        <Pressable
          onPress={() => router.push('/onboarding/notifications')}
          style={({ pressed }) => ({
            backgroundColor: Colors.orange,
            borderRadius: 999,
            paddingVertical: 18,
            alignItems: 'center',
            opacity: pressed ? 0.85 : 1,
            marginTop: 4,
          })}
        >
          <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 17 }}>
            Continue →
          </Text>
        </Pressable>

        <Pressable onPress={() => router.back()} style={{ alignItems: 'center', paddingBottom: 8 }}>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14 }}>← Back</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
