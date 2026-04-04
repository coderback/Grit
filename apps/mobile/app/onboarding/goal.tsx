import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
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

const GOALS: {
  value: 'lose_weight' | 'build_muscle' | 'maintain' | 'recomp';
  label: string;
  description: string;
  emoji: string;
}[] = [
  { value: 'lose_weight', label: 'Lose Weight', description: 'Burn fat and reduce body weight', emoji: '🔥' },
  { value: 'build_muscle', label: 'Build Muscle', description: 'Increase muscle mass and strength', emoji: '💪' },
  { value: 'maintain', label: 'Maintain', description: 'Stay at current weight and build habits', emoji: '⚖️' },
  { value: 'recomp', label: 'Recomp', description: 'Lose fat and gain muscle simultaneously', emoji: '🔄' },
];

export default function GoalScreen() {
  const { primaryGoal, desiredWeightKg, weightKg, set } = useOnboardingStore();
  const [desired, setDesired] = useState(desiredWeightKg ? String(desiredWeightKg) : weightKg ? String(weightKg) : '');

  const showDesired = primaryGoal && primaryGoal !== 'maintain';
  const isValid = !!primaryGoal && (!showDesired || (desired.trim() && !isNaN(parseFloat(desired))));

  function handleContinue() {
    set({
      primaryGoal: primaryGoal!,
      desiredWeightKg: showDesired ? parseFloat(desired) : null,
    });
    router.push('/onboarding/pace');
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <ProgressBar step={3} total={9} />

        <View style={{ gap: 6 }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 28, letterSpacing: -0.5 }}>
            What's your goal?
          </Text>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 15 }}>
            This determines your calorie target and plan structure.
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          {GOALS.map((g) => {
            const selected = primaryGoal === g.value;
            return (
              <Pressable
                key={g.value}
                onPress={() => set({ primaryGoal: g.value })}
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
                <Text style={{ fontSize: 28 }}>{g.emoji}</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: selected ? Colors.orange : Colors.text, fontFamily: 'DMSans-Bold', fontSize: 16 }}>
                    {g.label}
                  </Text>
                  <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13 }}>
                    {g.description}
                  </Text>
                </View>
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

        {showDesired && (
          <View style={{ gap: 10 }}>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Target Weight
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                value={desired}
                onChangeText={setDesired}
                placeholder="65"
                placeholderTextColor={Colors.muted}
                keyboardType="decimal-pad"
                style={{
                  flex: 1,
                  backgroundColor: Colors.surface2,
                  borderTopLeftRadius: 14,
                  borderBottomLeftRadius: 14,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  borderRightWidth: 0,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  color: Colors.text,
                  fontFamily: 'DMSans-Medium',
                  fontSize: 16,
                }}
              />
              <View style={{ backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border, borderTopRightRadius: 14, borderBottomRightRadius: 14, paddingHorizontal: 14, paddingVertical: 14 }}>
                <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 15 }}>kg</Text>
              </View>
            </View>
          </View>
        )}

        <Pressable
          onPress={handleContinue}
          disabled={!isValid}
          style={({ pressed }) => ({
            backgroundColor: isValid ? Colors.orange : Colors.surface2,
            borderRadius: 999,
            paddingVertical: 18,
            alignItems: 'center',
            opacity: pressed ? 0.85 : 1,
            marginTop: 4,
          })}
        >
          <Text style={{ color: isValid ? '#fff' : Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 17 }}>
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
