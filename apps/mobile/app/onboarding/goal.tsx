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
  color: string;
}[] = [
  { value: 'lose_weight', label: 'Lose Weight', description: 'Burn fat, reduce body weight', emoji: '🔥', color: Colors.orange },
  { value: 'build_muscle', label: 'Build Muscle', description: 'Increase mass and strength', emoji: '💪', color: Colors.blue },
  { value: 'maintain', label: 'Maintain', description: 'Hold weight, build habits', emoji: '⚖️', color: Colors.teal },
  { value: 'recomp', label: 'Recomp', description: 'Lose fat and gain muscle', emoji: '🔄', color: '#A78BFA' },
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
      <ScrollView contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <ProgressBar step={3} total={9} />

        {/* Header nav */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            onPress={() => router.back()}
            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: Colors.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <Text style={{ fontSize: 13, color: Colors.muted, fontFamily: 'DMSans-Regular' }}>4 of 9</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 28, letterSpacing: -0.5 }}>
            What's your goal?
          </Text>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14 }}>
            This determines your calorie target and plan structure.
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          {GOALS.map(g => {
            const selected = primaryGoal === g.value;
            return (
              <Pressable
                key={g.value}
                onPress={() => set({ primaryGoal: g.value })}
                style={{
                  backgroundColor: selected ? `${g.color}12` : Colors.surface,
                  borderRadius: 20,
                  borderWidth: 1.5,
                  borderColor: selected ? g.color : Colors.border,
                  padding: 18,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 16,
                }}
              >
                {/* Emoji container */}
                <View style={{
                  width: 52, height: 52, borderRadius: 16,
                  backgroundColor: selected ? `${g.color}22` : Colors.surface2,
                  alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Text style={{ fontSize: 26 }}>{g.emoji}</Text>
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ color: selected ? g.color : Colors.text, fontFamily: 'DMSans-Bold', fontSize: 16 }}>
                    {g.label}
                  </Text>
                  <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13 }}>
                    {g.description}
                  </Text>
                </View>
                {/* Radio */}
                <View style={{
                  width: 22, height: 22, borderRadius: 11,
                  borderWidth: 2,
                  borderColor: selected ? g.color : Colors.border,
                  backgroundColor: selected ? g.color : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {selected && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />}
                </View>
              </Pressable>
            );
          })}
        </View>

        {showDesired && (
          <View style={{ gap: 10 }}>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>
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
                  borderTopLeftRadius: 14, borderBottomLeftRadius: 14,
                  borderWidth: 1, borderColor: Colors.border, borderRightWidth: 0,
                  paddingHorizontal: 16, paddingVertical: 14,
                  color: Colors.text, fontFamily: 'DMSans-Regular', fontSize: 16,
                }}
              />
              <View style={{ backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border, borderTopRightRadius: 14, borderBottomRightRadius: 14, paddingHorizontal: 14, paddingVertical: 14 }}>
                <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 15 }}>kg</Text>
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
      </ScrollView>
    </SafeAreaView>
  );
}
