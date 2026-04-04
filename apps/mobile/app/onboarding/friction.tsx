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
  { value: 'consistency', label: 'Lack of consistency', emoji: '🔁' },
  { value: 'time', label: 'No time', emoji: '⏰' },
  { value: 'diet', label: 'Diet is too hard', emoji: '🥗' },
  { value: 'motivation', label: 'No motivation', emoji: '😔' },
  { value: 'plan', label: 'No clear plan', emoji: '🗺️' },
];

export default function FrictionScreen() {
  const { friction, set } = useOnboardingStore();

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <ProgressBar step={5} total={9} />

        <View style={{ gap: 6 }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 28, letterSpacing: -0.5 }}>
            What usually stops you?
          </Text>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 15 }}>
            We'll personalise your experience to work around this.
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          {OPTIONS.map((o) => {
            const selected = friction === o.value;
            return (
              <Pressable
                key={o.value}
                onPress={() => set({ friction: o.value })}
                style={{
                  backgroundColor: selected ? `${Colors.orange}18` : Colors.surface,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: selected ? Colors.orange : Colors.border,
                  padding: 18,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 16,
                }}
              >
                <Text style={{ fontSize: 26 }}>{o.emoji}</Text>
                <Text style={{ flex: 1, color: selected ? Colors.orange : Colors.text, fontFamily: 'DMSans-Medium', fontSize: 16 }}>
                  {o.label}
                </Text>
                <View style={{
                  width: 22, height: 22, borderRadius: 11,
                  borderWidth: 2,
                  borderColor: selected ? Colors.orange : Colors.border,
                  backgroundColor: selected ? Colors.orange : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {selected && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => { if (friction) router.push('/onboarding/nutrition'); }}
          disabled={!friction}
          style={({ pressed }) => ({
            backgroundColor: friction ? Colors.orange : Colors.surface2,
            borderRadius: 999,
            paddingVertical: 18,
            alignItems: 'center',
            opacity: pressed ? 0.85 : 1,
            marginTop: 4,
          })}
        >
          <Text style={{ color: friction ? '#fff' : Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 17 }}>
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
