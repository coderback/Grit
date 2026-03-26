import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors } from '@/constants/colors';

interface MacroDonutProps {
  calories: number;
  calorieGoal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

const SIZE = 160;
const STROKE = 14;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;
const CENTER = SIZE / 2;

function arc(value: number, total: number, offset: number) {
  if (total === 0) return { dash: 0, offset };
  const pct = Math.min(value / total, 1);
  return {
    dash: pct * CIRCUMFERENCE,
    offset,
  };
}

export function MacroDonut({
  calories,
  calorieGoal,
  proteinG,
  carbsG,
  fatG,
}: MacroDonutProps) {
  const totalMacroKcal = proteinG * 4 + carbsG * 4 + fatG * 9;

  // Segments in order: protein (blue), carbs (orange), fat (green)
  const protein = arc(proteinG * 4, totalMacroKcal, 0);
  const carbs = arc(carbsG * 4, totalMacroKcal, -(protein.dash));
  const fat = arc(fatG * 9, totalMacroKcal, -(protein.dash + carbs.dash));

  const remaining = calorieGoal - calories;
  const remainingLabel =
    remaining >= 0
      ? `${Math.round(remaining)} remaining`
      : `${Math.round(Math.abs(remaining))} more than planned`;

  return (
    <View style={{ alignItems: 'center', gap: 12 }}>
      <View style={{ position: 'relative', width: SIZE, height: SIZE }}>
        <Svg width={SIZE} height={SIZE}>
          {/* Track */}
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={R}
            stroke={Colors.surface2}
            strokeWidth={STROKE}
            fill="none"
          />
          {/* Fat */}
          {fat.dash > 0 && (
            <Circle
              cx={CENTER}
              cy={CENTER}
              r={R}
              stroke={Colors.success}
              strokeWidth={STROKE}
              fill="none"
              strokeDasharray={`${fat.dash} ${CIRCUMFERENCE}`}
              strokeDashoffset={fat.offset}
              strokeLinecap="round"
              rotation="-90"
              origin={`${CENTER}, ${CENTER}`}
            />
          )}
          {/* Carbs */}
          {carbs.dash > 0 && (
            <Circle
              cx={CENTER}
              cy={CENTER}
              r={R}
              stroke={Colors.orange}
              strokeWidth={STROKE}
              fill="none"
              strokeDasharray={`${carbs.dash} ${CIRCUMFERENCE}`}
              strokeDashoffset={carbs.offset}
              strokeLinecap="round"
              rotation="-90"
              origin={`${CENTER}, ${CENTER}`}
            />
          )}
          {/* Protein */}
          {protein.dash > 0 && (
            <Circle
              cx={CENTER}
              cy={CENTER}
              r={R}
              stroke={Colors.blue}
              strokeWidth={STROKE}
              fill="none"
              strokeDasharray={`${protein.dash} ${CIRCUMFERENCE}`}
              strokeDashoffset={protein.offset}
              strokeLinecap="round"
              rotation="-90"
              origin={`${CENTER}, ${CENTER}`}
            />
          )}
        </Svg>

        {/* Center label */}
        <View
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              color: Colors.text,
              fontSize: 26,
              fontFamily: 'JetBrainsMono-Regular',
              lineHeight: 30,
            }}
          >
            {Math.round(calories)}
          </Text>
          <Text
            style={{
              color: Colors.muted,
              fontSize: 11,
              fontFamily: 'DMSans-Regular',
            }}
          >
            kcal eaten
          </Text>
        </View>
      </View>

      {/* Remaining label — non-judgmental */}
      <Text
        style={{
          color: Colors.muted,
          fontFamily: 'DMSans-Regular',
          fontSize: 13,
        }}
      >
        {remainingLabel}
      </Text>

      {/* Macro legend */}
      <View style={{ flexDirection: 'row', gap: 20 }}>
        {[
          { label: 'Protein', value: Math.round(proteinG), color: Colors.blue, unit: 'g' },
          { label: 'Carbs', value: Math.round(carbsG), color: Colors.orange, unit: 'g' },
          { label: 'Fat', value: Math.round(fatG), color: Colors.success, unit: 'g' },
        ].map((m) => (
          <View key={m.label} style={{ alignItems: 'center', gap: 2 }}>
            <Text
              style={{
                color: m.color,
                fontSize: 16,
                fontFamily: 'JetBrainsMono-Regular',
              }}
            >
              {m.value}
              <Text style={{ fontSize: 11 }}>{m.unit}</Text>
            </Text>
            <Text
              style={{
                color: Colors.muted,
                fontSize: 11,
                fontFamily: 'DMSans-Regular',
              }}
            >
              {m.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
