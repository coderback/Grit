import React, { useMemo, useRef, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Animated } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
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

  const RESULTS = plan ? [
    { label: 'Daily Calories', value: String(plan.calories), unit: 'kcal', color: Colors.orange },
    { label: 'Protein', value: String(plan.macros.proteinG), unit: 'g', color: Colors.blue },
    { label: 'Carbs', value: String(plan.macros.carbsG), unit: 'g', color: Colors.orange },
    { label: 'Fat', value: String(plan.macros.fatG), unit: 'g', color: Colors.teal },
    ...(plan.weeks ? [{ label: 'Est. Timeline', value: `~${plan.weeks}`, unit: 'weeks', color: Colors.teal }] : []),
  ] : [];

  const opacityAnims = useRef(RESULTS.map(() => new Animated.Value(0))).current;
  const translateAnims = useRef(RESULTS.map(() => new Animated.Value(12))).current;

  useEffect(() => {
    const animations = RESULTS.map((_, i) =>
      Animated.parallel([
        Animated.timing(opacityAnims[i], {
          toValue: 1, duration: 400, delay: i * 80, useNativeDriver: true,
        }),
        Animated.timing(translateAnims[i], {
          toValue: 0, duration: 400, delay: i * 80, useNativeDriver: true,
        }),
      ])
    );
    Animated.parallel(animations).start();
  }, []);

  if (!plan) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 15 }}>
          Missing information — please go back.
        </Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 15 }}>← Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40, alignItems: 'center' }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: '100%', marginBottom: 32 }}>
          <ProgressBar step={9} total={9} />
        </View>

        {/* Logo pulse ring */}
        <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          {/* Outer glow rings */}
          <View style={{ position: 'absolute', width: 130, height: 130, borderRadius: 65, borderWidth: 1, borderColor: 'rgba(255,92,43,0.05)' }} />
          <View style={{ position: 'absolute', width: 110, height: 110, borderRadius: 55, borderWidth: 1, borderColor: 'rgba(255,92,43,0.1)' }} />
          {/* Main ring */}
          <View style={{
            width: 90, height: 90, borderRadius: 45,
            backgroundColor: 'rgba(255,92,43,0.1)',
            borderWidth: 2, borderColor: 'rgba(255,92,43,0.3)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 36 }}>💪</Text>
          </View>
        </View>

        <Text style={{ fontSize: 30, fontFamily: 'DMSans-Bold', color: Colors.text, letterSpacing: -0.5, textAlign: 'center', marginBottom: 8 }}>
          Your plan is ready.
        </Text>
        <Text style={{ fontSize: 14, color: Colors.muted, fontFamily: 'DMSans-Regular', textAlign: 'center', lineHeight: 22, maxWidth: 280, marginBottom: 32 }}>
          Based on your stats, we've calculated personalised targets to fuel your goals.
        </Text>

        {/* Staggered result rows */}
        <View style={{ width: '100%', gap: 10, marginBottom: 32 }}>
          {RESULTS.map((item, i) => (
            <Animated.View
              key={item.label}
              style={{
                opacity: opacityAnims[i],
                transform: [{ translateY: translateAnims[i] }],
                backgroundColor: Colors.surface,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: Colors.border,
                padding: 16,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 14, color: Colors.muted, fontFamily: 'DMSans-Regular' }}>{item.label}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <Text style={{ fontSize: 20, fontFamily: 'JetBrainsMono-Regular', color: item.color }}>{item.value}</Text>
                <Text style={{ fontSize: 13, color: Colors.muted, fontFamily: 'DMSans-Regular' }}>{item.unit}</Text>
              </View>
            </Animated.View>
          ))}
        </View>

        <Pressable
          onPress={() => router.push('/onboarding/signup')}
          style={({ pressed }) => ({
            width: '100%',
            backgroundColor: Colors.orange,
            borderRadius: 999,
            paddingVertical: 18,
            alignItems: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 17 }}>
            Create my account →
          </Text>
        </Pressable>

        <Pressable onPress={() => router.back()} style={{ alignItems: 'center', paddingTop: 16, paddingBottom: 8 }}>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14 }}>← Back</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
