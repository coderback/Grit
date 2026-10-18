import React, { useState, useRef, useCallback } from 'react';
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

const ITEM_H = 48;

function DrumPicker({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min: number; max: number }) {
  const scrollRef = useRef<ScrollView>(null);
  const items = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  const scrollToValue = useCallback((v: number) => {
    const idx = v - min;
    scrollRef.current?.scrollTo({ y: idx * ITEM_H, animated: false });
  }, [min]);

  return (
    <View style={{ position: 'relative', height: ITEM_H * 3, width: 120, overflow: 'hidden', borderRadius: 14 }}>
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: ITEM_H, backgroundColor: Colors.dark, opacity: 0.85, zIndex: 2 }} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: ITEM_H, backgroundColor: Colors.dark, opacity: 0.85, zIndex: 2 }} />
      <View style={{
        position: 'absolute', top: ITEM_H, left: 4, right: 4, height: ITEM_H,
        backgroundColor: 'rgba(255,92,43,0.12)', borderWidth: 1, borderColor: 'rgba(255,92,43,0.28)',
        borderRadius: 10, zIndex: 1,
      }} />
      <ScrollView
        ref={scrollRef}
        onLayout={() => scrollToValue(value)}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: ITEM_H }}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
          onChange(Math.max(min, Math.min(max, min + idx)));
        }}
      >
        {items.map(i => (
          <View key={i} style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{
              fontSize: i === value ? 30 : 20,
              fontFamily: i === value ? 'DMSans-Bold' : 'DMSans-Regular',
              color: i === value ? Colors.text : `${Colors.muted}70`,
            }}>
              {i}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export default function AgeScreen() {
  const { dateOfBirth, set } = useOnboardingStore();

  const storedAge = dateOfBirth
    ? new Date().getFullYear() - parseInt(dateOfBirth.slice(0, 4), 10)
    : 25;
  const [age, setAge] = useState(storedAge);

  function handleContinue() {
    set({ dateOfBirth: `${new Date().getFullYear() - age}-01-01` });
    router.push('/onboarding/body');
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}>
      <View style={{ flex: 1, padding: 20 }}>
        <ProgressBar step={2} total={11} />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: Colors.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <Text style={{ fontSize: 13, color: Colors.muted, fontFamily: 'DMSans-Regular' }}>3 of 11</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={{ marginTop: 28, gap: 6 }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 28, letterSpacing: -0.5 }}>How old are you?</Text>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14, lineHeight: 20 }}>
            Age affects your daily calorie needs.
          </Text>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <View style={{
            backgroundColor: Colors.surface, borderRadius: 24,
            borderWidth: 1, borderColor: Colors.border,
            paddingVertical: 32, paddingHorizontal: 40,
            alignItems: 'center', gap: 16,
          }}>
            <DrumPicker value={age} onChange={setAge} min={13} max={80} />
            <Text style={{ fontSize: 14, color: Colors.muted, fontFamily: 'DMSans-Regular' }}>years old</Text>
          </View>
          <Text style={{ fontSize: 12, color: `${Colors.muted}60`, fontFamily: 'DMSans-Regular' }}>Scroll to adjust</Text>
        </View>

        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => ({
            backgroundColor: Colors.orange,
            borderRadius: 999,
            paddingVertical: 18,
            alignItems: 'center',
            opacity: pressed ? 0.85 : 1,
            marginBottom: 16,
          })}
        >
          <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 17 }}>Continue →</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
