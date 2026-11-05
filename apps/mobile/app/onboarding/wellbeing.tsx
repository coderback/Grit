import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
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

const OPTIONS = [
  { value: 'no', label: 'No' },
  { value: 'yes', label: 'Yes, now or in the past' },
  { value: 'prefer_not', label: "I'd rather not say" },
] as const;

/**
 * One private question before goals: a "yes" means GRIT never sets
 * weight-loss targets, and the coach focuses on regular meals and wellbeing.
 */
export default function WellbeingScreen() {
  const { edScreen, primaryGoal, set } = useOnboardingStore();

  function handleContinue() {
    // A weight-loss goal picked earlier is cleared after a "yes"
    if (edScreen === 'yes' && primaryGoal === 'lose_weight') set({ primaryGoal: null, desiredWeightKg: null });
    router.push('/onboarding/goal');
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <ProgressBar step={5} total={12} />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back"
            onPress={() => router.back()}
            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: Colors.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <Text style={{ fontSize: 13, color: Colors.muted, fontFamily: 'DMSans-Regular' }}>6 of 12</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 26, letterSpacing: -0.5 }}>
            One private question
          </Text>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 15, lineHeight: 22 }}>
            Have you ever been diagnosed with, or treated for, an eating disorder? Your answer is never shown to anyone, and you can change it later in Settings.
          </Text>
        </View>

        <View style={{ gap: 10 }} accessibilityRole="radiogroup">
          {OPTIONS.map((o) => {
            const selected = edScreen === o.value;
            return (
              <Pressable
                key={o.value}
                onPress={() => set({ edScreen: o.value })}
                accessibilityRole="radio"
                aria-checked={selected}
                style={{
                  backgroundColor: selected ? `${Colors.teal}14` : Colors.surface,
                  borderRadius: 18, borderWidth: 1.5, borderColor: selected ? Colors.teal : Colors.border,
                  paddingVertical: 16, paddingHorizontal: 18,
                }}
              >
                <Text style={{ color: selected ? Colors.teal : Colors.text, fontFamily: 'DMSans-Bold', fontSize: 16 }}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {edScreen === 'yes' && (
          <View style={{ backgroundColor: Colors.surface2, borderRadius: 16, padding: 16, gap: 8 }}>
            <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 15 }}>Thank you for telling us.</Text>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14, lineHeight: 21 }}>
              GRIT won't set weight-loss targets or suggest eating less. Your coach will focus on regular meals, training and how you feel. If eating feels hard right now, your doctor or a local eating disorder helpline can help.
            </Text>
          </View>
        )}

        <Pressable accessibilityRole="button"
          onPress={handleContinue}
          disabled={!edScreen}
          style={({ pressed }) => ({
            backgroundColor: edScreen ? Colors.orange : Colors.surface2,
            borderRadius: 999, paddingVertical: 18, alignItems: 'center', opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ color: edScreen ? '#fff' : Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 17 }}>Continue →</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
