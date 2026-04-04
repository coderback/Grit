import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useOnboardingStore } from '../../stores/onboardingStore';

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <View style={{ height: 3, backgroundColor: Colors.surface2, borderRadius: 2 }}>
      <View style={{ height: 3, backgroundColor: Colors.orange, borderRadius: 2, width: `${(step / total) * 100}%` }} />
    </View>
  );
}

const LEVELS: {
  value: 'sedentary' | 'lightly_active' | 'active' | 'very_active';
  label: string;
  freq: string;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}[] = [
  { value: 'sedentary', label: 'Sedentary', freq: '0–1× per week', description: 'Mostly desk job or very little movement', icon: 'laptop-outline' },
  { value: 'lightly_active', label: 'Lightly Active', freq: '2–3× per week', description: 'Light exercise or walking regularly', icon: 'walk-outline' },
  { value: 'active', label: 'Active', freq: '4–5× per week', description: 'Moderate workouts most days', icon: 'bicycle-outline' },
  { value: 'very_active', label: 'Very Active', freq: '6+× per week', description: 'Intense training or physical job', icon: 'barbell-outline' },
];

export default function ActivityScreen() {
  const { activityLevel, set } = useOnboardingStore();

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <ProgressBar step={2} total={9} />

        <View style={{ gap: 6 }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 28, letterSpacing: -0.5 }}>
            How active are you?
          </Text>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 15 }}>
            Based on your typical week of exercise.
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          {LEVELS.map((level) => {
            const selected = activityLevel === level.value;
            return (
              <Pressable
                key={level.value}
                onPress={() => set({ activityLevel: level.value })}
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
                <View style={{
                  width: 44, height: 44, borderRadius: 12,
                  backgroundColor: selected ? `${Colors.orange}22` : Colors.surface2,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name={level.icon} size={22} color={selected ? Colors.orange : Colors.muted} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ color: selected ? Colors.orange : Colors.text, fontFamily: 'DMSans-Bold', fontSize: 16 }}>
                      {level.label}
                    </Text>
                    <View style={{ backgroundColor: selected ? `${Colors.orange}22` : Colors.surface2, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ color: selected ? Colors.orange : Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 11 }}>
                        {level.freq}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13 }}>
                    {level.description}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => {
            if (activityLevel) router.push('/onboarding/goal');
          }}
          disabled={!activityLevel}
          style={({ pressed }) => ({
            backgroundColor: activityLevel ? Colors.orange : Colors.surface2,
            borderRadius: 999,
            paddingVertical: 18,
            alignItems: 'center',
            opacity: pressed ? 0.85 : 1,
            marginTop: 4,
          })}
        >
          <Text style={{ color: activityLevel ? '#fff' : Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 17 }}>
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
