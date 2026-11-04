import React, { useState, useRef } from 'react';
import { View, Text, Pressable, ScrollView, Dimensions, PanResponder } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { Colors } from '../../constants/colors';
import { useOnboardingStore } from '../../stores/onboardingStore';

const SCREEN_W = Dimensions.get('window').width;
const PX_PER = 10;

const CM_PER_IN = 2.54;
const LB_PER_KG = 2.20462;

// The rulers work in whichever unit is shown; the store always holds cm and kg
const HEIGHT_RANGE = { cm: { min: 140, max: 220, major: 5 }, ft: { min: 55, max: 87, major: 12 } };
const WEIGHT_RANGE = { kg: { min: 30, max: 200, major: 5 }, lbs: { min: 66, max: 440, major: 10 } };

const roundTo1 = (n: number) => Math.round(n * 10) / 10;
const feetInches = (inches: number) => `${Math.floor(inches / 12)}'${inches % 12}"`;

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
            paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999,
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

function HorizRuler({ value, onChange, min, max, unit, majorEvery = 5, format = String }: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  unit: string;
  majorEvery?: number;
  format?: (v: number) => string;
}) {
  const startRef = useRef<{ x: number; val: number } | null>(null);
  const RULER_W = SCREEN_W - 40;
  const CTR = RULER_W / 2;
  const RANGE = Math.ceil(CTR / PX_PER) + 2;

  const ticks: { v: number; x: number; isCur: boolean; isMajor: boolean }[] = [];
  for (let i = -RANGE; i <= RANGE; i++) {
    const v = value + i;
    if (v < min || v > max) continue;
    const x = CTR + i * PX_PER;
    ticks.push({ v, x, isCur: v === value, isMajor: v % majorEvery === 0 });
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
      onChange(Math.max(min, Math.min(max, startRef.current.val + delta)));
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
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', paddingTop: 22, paddingBottom: 16, gap: 6 }}>
        <Text style={{ fontSize: 52, fontFamily: 'JetBrainsMono-Regular', color: Colors.text, letterSpacing: -2, lineHeight: 56 }}>
          {format(value)}
        </Text>
        {!!unit && <Text style={{ fontSize: 18, color: Colors.muted, fontFamily: 'DMSans-Regular', paddingBottom: 6 }}>{unit}</Text>}
      </View>

      <View style={{ height: 58, position: 'relative' }}>
        <View style={{
          position: 'absolute', left: CTR - 6, top: 0, zIndex: 3,
          width: 0, height: 0,
          borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 9,
          borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: Colors.orange,
        }} />
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
                  {format(v)}
                </SvgText>
              )}
            </React.Fragment>
          ))}
        </Svg>
      </View>
    </View>
  );
}

export default function BodyScreen() {
  const { heightCm, weightKg, weightUnit: savedWeightUnit, heightUnit: savedHeightUnit, set } = useOnboardingStore();

  const [height, setHeight] = useState(heightCm ?? 175);
  const [weight, setWeight] = useState(weightKg ?? 78);
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>(savedHeightUnit);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>(savedWeightUnit === 'lb' ? 'lbs' : 'kg');

  const hRange = HEIGHT_RANGE[heightUnit];
  const wRange = WEIGHT_RANGE[weightUnit];
  const clamp = (v: number, r: { min: number; max: number }) => Math.max(r.min, Math.min(r.max, v));
  const heightShown = clamp(Math.round(heightUnit === 'cm' ? height : height / CM_PER_IN), hRange);
  const weightShown = clamp(Math.round(weightUnit === 'kg' ? weight : weight * LB_PER_KG), wRange);

  function handleContinue() {
    set({
      heightCm: roundTo1(height),
      weightKg: roundTo1(weight),
      // Remembered as the user's display units for the rest of the app
      weightUnit: weightUnit === 'lbs' ? 'lb' : 'kg',
      heightUnit,
    });
    router.push('/onboarding/activity');
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 28, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <ProgressBar step={3} total={11} />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            onPress={() => router.back()}
            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: Colors.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <Text style={{ fontSize: 13, color: Colors.muted, fontFamily: 'DMSans-Regular' }}>4 of 11</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 28, letterSpacing: -0.5 }}>Height & weight</Text>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14, lineHeight: 20 }}>
            Drag the ruler to set your measurements.
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>Height</Text>
            <UnitToggle options={['cm', 'ft']} value={heightUnit} onChange={(u) => setHeightUnit(u as 'cm' | 'ft')} />
          </View>
          <HorizRuler
            value={heightShown}
            onChange={(v) => setHeight(heightUnit === 'cm' ? v : v * CM_PER_IN)}
            min={hRange.min}
            max={hRange.max}
            majorEvery={hRange.major}
            unit={heightUnit === 'cm' ? 'cm' : ''}
            format={heightUnit === 'cm' ? String : feetInches}
          />
          <Text style={{ fontSize: 11, color: `${Colors.muted}70`, textAlign: 'center', fontFamily: 'DMSans-Regular' }}>← drag to adjust →</Text>
        </View>

        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>Weight</Text>
            <UnitToggle options={['kg', 'lbs']} value={weightUnit} onChange={(u) => setWeightUnit(u as 'kg' | 'lbs')} />
          </View>
          <HorizRuler
            value={weightShown}
            onChange={(v) => setWeight(weightUnit === 'kg' ? v : v / LB_PER_KG)}
            min={wRange.min}
            max={wRange.max}
            majorEvery={wRange.major}
            unit={weightUnit}
          />
          <Text style={{ fontSize: 11, color: `${Colors.muted}70`, textAlign: 'center', fontFamily: 'DMSans-Regular' }}>← drag to adjust →</Text>
        </View>

        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => ({
            backgroundColor: Colors.orange,
            borderRadius: 999,
            paddingVertical: 18,
            alignItems: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 17 }}>Continue →</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
