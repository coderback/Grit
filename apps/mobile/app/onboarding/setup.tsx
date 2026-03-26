import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';

const PRESETS = [
  { label: 'Light', calories: 1500, description: 'Lose weight steadily' },
  { label: 'Moderate', calories: 2000, description: 'Maintain or slow cut' },
  { label: 'Active', calories: 2500, description: 'Fuel heavy training' },
];

export default function SetupScreen() {
  const [selected, setSelected] = useState(2000);
  const { setOnboardingComplete } = useAuthStore();

  async function handleFinish() {
    try {
      await api.put('/users/me', { calorieGoal: selected });
    } catch {
      // non-blocking
    }
    await setOnboardingComplete();
    router.replace('/(tabs)/');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark }}>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingVertical: 16, gap: 32 }}>
        <View style={{ gap: 8, paddingTop: 16 }}>
          <Text
            style={{
              color: Colors.text,
              fontFamily: 'DMSans-Bold',
              fontSize: 28,
              letterSpacing: -0.5,
            }}
          >
            Set your daily target
          </Text>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 15 }}>
            Choose a calorie goal to get started. You can change this later.
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          {PRESETS.map((p) => (
            <Pressable
              key={p.calories}
              onPress={() => setSelected(p.calories)}
              style={{
                backgroundColor: selected === p.calories ? `${Colors.orange}18` : Colors.surface,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: selected === p.calories ? Colors.orange : Colors.border,
                padding: 20,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ gap: 4 }}>
                <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 17 }}>
                  {p.label}
                </Text>
                <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14 }}>
                  {p.description}
                </Text>
              </View>
              <Text
                style={{
                  color: selected === p.calories ? Colors.orange : Colors.muted,
                  fontFamily: 'DMSans-Bold',
                  fontSize: 22,
                }}
              >
                {p.calories}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ flex: 1 }} />

        <View style={{ gap: 12 }}>
          <Pressable
            onPress={handleFinish}
            style={({ pressed }) => ({
              backgroundColor: Colors.orange,
              borderRadius: 999,
              paddingVertical: 16,
              alignItems: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 17 }}>
              Start tracking →
            </Text>
          </Pressable>

          <Pressable onPress={() => router.back()} style={{ alignItems: 'center', padding: 8 }}>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14 }}>
              ← Back
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
