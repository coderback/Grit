import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { calcBMR, calcTDEE, calcAdjustedCalories, calcTimeline, ageFromDOB } from '../../lib/tdee';

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <View style={{ height: 3, backgroundColor: Colors.surface2, borderRadius: 2 }}>
      <View style={{ height: 3, backgroundColor: Colors.orange, borderRadius: 2, width: `${(step / total) * 100}%` }} />
    </View>
  );
}

const PACES: { value: 'slow' | 'moderate' | 'aggressive'; label: string; kg: string; description: string }[] = [
  { value: 'slow', label: 'Slow', kg: '0.25 kg / week', description: 'Sustainable, minimal muscle loss' },
  { value: 'moderate', label: 'Moderate', kg: '0.5 kg / week', description: 'Balanced and recommended' },
  { value: 'aggressive', label: 'Aggressive', kg: '1 kg / week', description: 'Fast results, requires discipline' },
];

export default function PaceScreen() {
  const { pace, gender, dateOfBirth, heightCm, weightKg, activityLevel, primaryGoal, desiredWeightKg, set } = useOnboardingStore();

  const calc = useMemo(() => {
    if (!gender || !dateOfBirth || !heightCm || !weightKg || !activityLevel || !primaryGoal || !pace) return null;
    const age = ageFromDOB(dateOfBirth);
    const bmr = calcBMR(gender, weightKg, heightCm, age);
    const tdee = calcTDEE(bmr, activityLevel);
    const calories = calcAdjustedCalories(tdee, primaryGoal, pace);
    const weeks = desiredWeightKg ? calcTimeline(weightKg, desiredWeightKg, pace) : null;
    return { calories, weeks };
  }, [pace, gender, dateOfBirth, heightCm, weightKg, activityLevel, primaryGoal, desiredWeightKg]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <ProgressBar step={4} total={9} />

        <View style={{ gap: 6 }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 28, letterSpacing: -0.5 }}>
            How fast do you want to progress?
          </Text>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 15 }}>
            This sets your calorie deficit or surplus.
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          {PACES.map((p) => {
            const selected = pace === p.value;
            return (
              <Pressable
                key={p.value}
                onPress={() => set({ pace: p.value })}
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
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: selected ? Colors.orange : Colors.text, fontFamily: 'DMSans-Bold', fontSize: 16 }}>
                    {p.label}
                  </Text>
                  <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13 }}>
                    {p.description}
                  </Text>
                </View>
                <Text style={{ color: selected ? Colors.orange : Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 14 }}>
                  {p.kg}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Live calculation preview */}
        {calc && (
          <View style={{ backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, padding: 20, gap: 12 }}>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Your estimated plan
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1, backgroundColor: Colors.surface2, borderRadius: 14, padding: 14, alignItems: 'center', gap: 4 }}>
                <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 26 }}>
                  {calc.calories}
                </Text>
                <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12 }}>kcal / day</Text>
              </View>
              {calc.weeks && (
                <View style={{ flex: 1, backgroundColor: Colors.surface2, borderRadius: 14, padding: 14, alignItems: 'center', gap: 4 }}>
                  <Text style={{ color: Colors.teal, fontFamily: 'DMSans-Bold', fontSize: 26 }}>
                    {calc.weeks}
                  </Text>
                  <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12 }}>weeks to goal</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <Pressable
          onPress={() => { if (pace) router.push('/onboarding/friction'); }}
          disabled={!pace}
          style={({ pressed }) => ({
            backgroundColor: pace ? Colors.orange : Colors.surface2,
            borderRadius: 999,
            paddingVertical: 18,
            alignItems: 'center',
            opacity: pressed ? 0.85 : 1,
            marginTop: 4,
          })}
        >
          <Text style={{ color: pace ? '#fff' : Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 17 }}>
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
