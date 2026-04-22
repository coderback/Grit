import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, Pressable, ScrollView, PanResponder, Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { Colors } from '../../constants/colors';
import { useOnboardingStore } from '../../stores/onboardingStore';

const SCREEN_W = Dimensions.get('window').width;
const PX_PER = 10;

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <View style={{ height: 3, backgroundColor: Colors.surface2, borderRadius: 2 }}>
      <View style={{ height: 3, backgroundColor: Colors.orange, borderRadius: 2, width: `${(step / total) * 100}%` }} />
    </View>
  );
}

function UnitToggle({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {options.map(u => (
        <Pressable
          key={u}
          onPress={() => onChange(u)}
          style={{
            paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
            backgroundColor: value === u ? `${Colors.orange}25` : Colors.surface2,
            borderWidth: 1,
            borderColor: value === u ? Colors.orange : Colors.border,
          }}
        >
          <Text style={{ fontSize: 12, fontFamily: 'DMSans-Bold', color: value === u ? Colors.orange : Colors.muted }}>{u}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function HorizRuler({ value, onChange, min, max, unit }: { value: number; onChange: (v: number) => void; min: number; max: number; unit: string }) {
  const startRef = useRef<{ x: number; val: number } | null>(null);
  const RULER_W = SCREEN_W - 40;
  const CTR = RULER_W / 2;
  const RANGE = Math.ceil(CTR / PX_PER) + 2;

  const ticks: { v: number; x: number; isCur: boolean; isMajor: boolean }[] = [];
  for (let i = -RANGE; i <= RANGE; i++) {
    const v = value + i;
    if (v < min || v > max) continue;
    const x = CTR + i * PX_PER;
    ticks.push({ v, x, isCur: v === value, isMajor: v % 5 === 0 });
  }

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (_, g) => {
      startRef.current = { x: g.x0, val: value };
    },
    onPanResponderMove: (_, g) => {
      if (!startRef.current) return;
      const delta = Math.round(-g.dx / PX_PER);
      const nv = Math.max(min, Math.min(max, startRef.current.val + delta));
      onChange(nv);
    },
  });

  return (
    <View
      {...panResponder.panHandlers}
      style={{
        backgroundColor: Colors.surface2,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.border,
        overflow: 'hidden',
      }}
    >
      {/* Value display */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', paddingTop: 22, paddingBottom: 16, gap: 6 }}>
        <Text style={{ fontSize: 52, fontFamily: 'JetBrainsMono-Regular', color: Colors.text, letterSpacing: -2, lineHeight: 56 }}>
          {value}
        </Text>
        <Text style={{ fontSize: 18, color: Colors.muted, fontFamily: 'DMSans-Regular', paddingBottom: 6 }}>{unit}</Text>
      </View>

      {/* Ruler track */}
      <View style={{ height: 58, position: 'relative' }}>
        {/* Center pointer triangle */}
        <View style={{
          position: 'absolute', left: CTR - 6, top: 0, zIndex: 3,
          width: 0, height: 0,
          borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 9,
          borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: Colors.orange,
        }} />
        {/* Orange center line */}
        <View style={{
          position: 'absolute', left: CTR - 1, top: 9, width: 2, height: 32,
          backgroundColor: Colors.orange, zIndex: 2,
        }} />
        <Svg width={RULER_W} height={58} viewBox={`0 0 ${RULER_W} 58`}>
          {ticks.map(({ v, x, isCur, isMajor }) => (
            <React.Fragment key={v}>
              <Rect
                x={x - (isCur ? 1 : 0.75)}
                y={isMajor ? 2 : 12}
                width={isCur ? 2 : 1.5}
                height={isMajor ? 30 : 20}
                fill={isCur ? Colors.orange : isMajor ? '#4A4A55' : '#323238'}
                rx={1}
              />
              {isMajor && (
                <SvgText
                  x={x} y={54}
                  textAnchor="middle"
                  fill={isCur ? Colors.orange : '#555560'}
                  fontSize={9}
                  fontFamily="DMSans-Regular"
                  fontWeight={isCur ? '700' : '400'}
                >
                  {v}
                </SvgText>
              )}
            </React.Fragment>
          ))}
        </Svg>
      </View>
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
    <View style={{ position: 'relative', height: ITEM_H * 3, width: 90, overflow: 'hidden', borderRadius: 14 }}>
      {/* Fade overlays */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: ITEM_H, backgroundColor: Colors.dark, opacity: 0.85, zIndex: 2 }} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: ITEM_H, backgroundColor: Colors.dark, opacity: 0.85, zIndex: 2 }} />
      {/* Highlight band */}
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
          const nv = Math.max(min, Math.min(max, min + idx));
          onChange(nv);
        }}
      >
        {items.map(i => (
          <View key={i} style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{
              fontSize: i === value ? 28 : 18,
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

const GENDERS = [
  {
    v: 'male' as const, label: 'Male',
    icon: '♂',
  },
  {
    v: 'female' as const, label: 'Female',
    icon: '♀',
  },
  {
    v: 'other' as const, label: 'Other',
    icon: '⚧',
  },
];

export default function BasicsScreen() {
  const { gender, heightCm, weightKg, set } = useOnboardingStore();

  const [age, setAge] = useState(25);
  const [height, setHeight] = useState(heightCm ?? 175);
  const [weight, setWeight] = useState(weightKg ?? 78);
  const [heightUnit, setHeightUnit] = useState('cm');
  const [weightUnit, setWeightUnit] = useState('kg');

  const isValid = !!gender && height > 0 && weight > 0;

  function handleContinue() {
    const dateOfBirth = `${new Date().getFullYear() - age}-01-01`;
    set({
      gender: gender as any,
      dateOfBirth,
      heightCm: height,
      weightKg: weight,
    });
    router.push('/onboarding/activity');
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 28, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <ProgressBar step={1} total={9} />

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            onPress={() => router.back()}
            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: Colors.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <Text style={{ fontSize: 13, color: Colors.muted, fontFamily: 'DMSans-Regular' }}>2 of 9</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 28, letterSpacing: -0.5 }}>Basic info</Text>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14, lineHeight: 20 }}>
            We use this to calculate your personalised plan.
          </Text>
        </View>

        {/* Gender */}
        <View style={{ gap: 10 }}>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>Gender</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {GENDERS.map(g => {
              const sel = gender === g.v;
              return (
                <Pressable
                  key={g.v}
                  onPress={() => set({ gender: g.v as any })}
                  style={{
                    flex: 1, paddingVertical: 16, borderRadius: 18,
                    alignItems: 'center', gap: 6,
                    backgroundColor: sel ? `${Colors.orange}15` : Colors.surface,
                    borderWidth: 1.5,
                    borderColor: sel ? Colors.orange : Colors.border,
                  }}
                >
                  <Text style={{ fontSize: 22 }}>{g.icon}</Text>
                  <Text style={{ fontSize: 13, fontFamily: sel ? 'DMSans-Bold' : 'DMSans-Regular', color: sel ? Colors.orange : Colors.text }}>
                    {g.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Age */}
        <View style={{ gap: 10 }}>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>Age</Text>
          <View style={{
            backgroundColor: Colors.surface, borderRadius: 20,
            borderWidth: 1, borderColor: Colors.border, padding: 20,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20,
          }}>
            <DrumPicker value={age} onChange={setAge} min={13} max={80} />
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 13, color: Colors.muted, fontFamily: 'DMSans-Regular' }}>years old</Text>
              <Text style={{ fontSize: 12, color: `${Colors.muted}60`, fontFamily: 'DMSans-Regular' }}>Scroll to adjust</Text>
            </View>
          </View>
        </View>

        {/* Height */}
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>Height</Text>
            <UnitToggle options={['cm', 'ft']} value={heightUnit} onChange={setHeightUnit} />
          </View>
          <HorizRuler value={height} onChange={setHeight} min={140} max={220} unit={heightUnit} />
          <Text style={{ fontSize: 11, color: `${Colors.muted}70`, textAlign: 'center', fontFamily: 'DMSans-Regular' }}>← drag to adjust →</Text>
        </View>

        {/* Weight */}
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>Weight</Text>
            <UnitToggle options={['kg', 'lbs']} value={weightUnit} onChange={setWeightUnit} />
          </View>
          <HorizRuler value={weight} onChange={setWeight} min={30} max={200} unit={weightUnit} />
          <Text style={{ fontSize: 11, color: `${Colors.muted}70`, textAlign: 'center', fontFamily: 'DMSans-Regular' }}>← drag to adjust →</Text>
        </View>

        {/* Continue */}
        <Pressable
          onPress={handleContinue}
          disabled={!isValid}
          style={({ pressed }) => ({
            backgroundColor: isValid ? Colors.orange : Colors.surface2,
            borderRadius: 999,
            paddingVertical: 18,
            alignItems: 'center',
            opacity: pressed ? 0.85 : 1,
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
