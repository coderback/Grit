import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { calcBMR, calcTDEE, calcAdjustedCalories, calcMacros, calcTimeline, ageFromDOB } from '../../lib/tdee';

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <View style={{ height: 3, backgroundColor: Colors.surface2, borderRadius: 2 }}>
      <View style={{ height: 3, backgroundColor: Colors.orange, borderRadius: 2, width: `${(step / total) * 100}%` }} />
    </View>
  );
}

const GOAL_LABELS: Record<string, string> = {
  lose_weight: 'Lose Weight',
  build_muscle: 'Build Muscle',
  maintain: 'Maintain',
  recomp: 'Recomp',
};

export default function RevealScreen() {
  const store = useOnboardingStore();

  const plan = useMemo(() => {
    const { gender, dateOfBirth, heightCm, weightKg, activityLevel, primaryGoal, pace, desiredWeightKg } = store;
    if (!gender || !dateOfBirth || !heightCm || !weightKg || !activityLevel || !primaryGoal || !pace) return null;

    const age = ageFromDOB(dateOfBirth);
    const bmr = calcBMR(gender, weightKg, heightCm, age);
    const tdee = calcTDEE(bmr, activityLevel);
    const calories = calcAdjustedCalories(tdee, primaryGoal, pace);
    const macros = calcMacros(calories);
    const weeks = desiredWeightKg ? calcTimeline(weightKg, desiredWeightKg, pace) : null;

    return { tdee, calories, macros, weeks, goal: primaryGoal };
  }, [store]);

  if (!plan) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 15 }}>Missing information — please go back.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Medium', fontSize: 15 }}>← Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <ProgressBar step={9} total={9} />

        <View style={{ gap: 6 }}>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Your personalised plan
          </Text>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 30, letterSpacing: -0.5 }}>
            Here's what{'\n'}we calculated 🎯
          </Text>
        </View>

        {/* Daily calories — hero */}
        <View style={{
          backgroundColor: `${Colors.orange}18`,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: `${Colors.orange}44`,
          padding: 28,
          alignItems: 'center',
          gap: 8,
        }}>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Daily Calorie Target
          </Text>
          <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 60, letterSpacing: -2 }}>
            {plan.calories}
          </Text>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 15 }}>
            kcal per day
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.teal }} />
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13 }}>
              TDEE: {plan.tdee} kcal
            </Text>
          </View>
        </View>

        {/* Macros */}
        <View style={{ gap: 10 }}>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Macro Split
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[
              { label: 'Protein', value: plan.macros.proteinG, color: Colors.blue, pct: '30%' },
              { label: 'Carbs', value: plan.macros.carbsG, color: Colors.teal, pct: '40%' },
              { label: 'Fat', value: plan.macros.fatG, color: Colors.orange, pct: '30%' },
            ].map((m) => (
              <View key={m.label} style={{ flex: 1, backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 14, alignItems: 'center', gap: 4 }}>
                <Text style={{ color: m.color, fontFamily: 'DMSans-Bold', fontSize: 22 }}>{m.value}g</Text>
                <Text style={{ color: Colors.text, fontFamily: 'DMSans-Medium', fontSize: 13 }}>{m.label}</Text>
                <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 11 }}>{m.pct}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Timeline */}
        {plan.weeks && (
          <View style={{ backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: `${Colors.teal}22`, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="calendar-outline" size={22} color={Colors.teal} />
            </View>
            <View style={{ gap: 2 }}>
              <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 16 }}>
                ~{plan.weeks} weeks to reach your goal
              </Text>
              <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13 }}>
                {GOAL_LABELS[plan.goal] ?? plan.goal} · staying consistent
              </Text>
            </View>
          </View>
        )}

        {/* CTA */}
        <Pressable
          onPress={() => router.push('/onboarding/signup')}
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
            Create my account →
          </Text>
        </Pressable>

        <Pressable onPress={() => router.back()} style={{ alignItems: 'center', paddingBottom: 8 }}>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14 }}>← Back</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
