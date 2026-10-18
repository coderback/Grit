import React from 'react';
import { View, Text, Pressable } from 'react-native';
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

const GENDERS = [
  { v: 'male' as const, label: 'Male', icon: '♂' },
  { v: 'female' as const, label: 'Female', icon: '♀' },
  { v: 'other' as const, label: 'Other', icon: '⚧' },
];

export default function GenderScreen() {
  const { gender, set } = useOnboardingStore();

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}>
      <View style={{ flex: 1, padding: 20 }}>
        <ProgressBar step={1} total={11} />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: Colors.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <Text style={{ fontSize: 13, color: Colors.muted, fontFamily: 'DMSans-Regular' }}>2 of 11</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={{ marginTop: 28, gap: 6 }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 28, letterSpacing: -0.5 }}>What's your gender?</Text>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14, lineHeight: 20 }}>
            Used to calculate your metabolic rate.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 32 }}>
          {GENDERS.map(g => {
            const sel = gender === g.v;
            return (
              <Pressable
                key={g.v}
                onPress={() => set({ gender: g.v })}
                style={{
                  flex: 1, paddingVertical: 28, borderRadius: 18,
                  alignItems: 'center', gap: 10,
                  backgroundColor: sel ? `${Colors.orange}15` : Colors.surface,
                  borderWidth: 1.5,
                  borderColor: sel ? Colors.orange : Colors.border,
                }}
              >
                <Text style={{ fontSize: 30 }}>{g.icon}</Text>
                <Text style={{ fontSize: 14, fontFamily: sel ? 'DMSans-Bold' : 'DMSans-Regular', color: sel ? Colors.orange : Colors.text }}>
                  {g.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flex: 1 }} />

        <Pressable
          onPress={() => { if (gender) router.push('/onboarding/age'); }}
          disabled={!gender}
          style={({ pressed }) => ({
            backgroundColor: gender ? Colors.orange : Colors.surface2,
            borderRadius: 999,
            paddingVertical: 18,
            alignItems: 'center',
            opacity: pressed ? 0.85 : 1,
            marginBottom: 16,
          })}
        >
          <Text style={{ color: gender ? '#fff' : Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 17 }}>
            Continue →
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
