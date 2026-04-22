import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import {
  useFoodLogsForDate,
  useDeleteFoodLog,
  type NormalizedFood,
} from '@/hooks/useFoodLog';
import { FoodSearchBar } from '@/components/food/FoodSearchBar';
import { LogFoodSheet } from '@/components/food/LogFoodSheet';
import { Colors } from '@/constants/colors';

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

function MacroDonutSVG({
  calories,
  proteinG,
  carbsG,
  fatG,
}: {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}) {
  const r = 33, cx = 45, cy = 45;
  const circ = 2 * Math.PI * r;
  const total = proteinG + carbsG + fatG || 1;
  const slices = [
    { val: proteinG, color: Colors.blue },
    { val: carbsG, color: Colors.orange },
    { val: fatG, color: Colors.teal },
  ];
  let offset = 0;
  const paths = slices.map((s, i) => {
    const dash = (s.val / total) * circ;
    const el = (
      <Circle
        key={i}
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={s.color}
        strokeWidth={9}
        strokeLinecap="round"
        strokeDasharray={`${Math.max(0, dash - 2)} ${Math.max(circ, circ - dash + 2)}`}
        strokeDashoffset={-offset}
        rotation={-90}
        originX={cx}
        originY={cy}
      />
    );
    offset += dash;
    return el;
  });

  return (
    <Svg width={90} height={90} viewBox="0 0 90 90">
      <Circle cx={cx} cy={cy} r={r} fill="none" stroke={Colors.surface2} strokeWidth={9} />
      {paths}
      <SvgText x={cx} y={cy - 4} textAnchor="middle" fill={Colors.text} fontSize={13} fontFamily="JetBrainsMono-Regular">
        {calories}
      </SvgText>
      <SvgText x={cx} y={cy + 9} textAnchor="middle" fill={Colors.muted} fontSize={7.5} fontFamily="DMSans-Regular">
        kcal eaten
      </SvgText>
    </Svg>
  );
}

export default function FoodScreen() {
  const today = new Date().toISOString().split('T')[0];
  const { data, isLoading } = useFoodLogsForDate(today);
  const { mutate: deleteLog } = useDeleteFoodLog();
  const [selectedFood, setSelectedFood] = useState<NormalizedFood | null>(null);
  const [expanded, setExpanded] = useState(new Set<string>(['Breakfast']));

  useFocusEffect(
    React.useCallback(() => {
      return () => setSelectedFood(null);
    }, [])
  );

  const calorieGoal = 2000;
  const eaten = data?.totals?.calories ?? 0;
  const proteinG = data?.totals?.proteinG ?? 0;
  const carbsG = data?.totals?.carbsG ?? 0;
  const fatG = data?.totals?.fatG ?? 0;

  const proteinGoal = Math.round(calorieGoal * 0.30 / 4);
  const carbsGoal = Math.round(calorieGoal * 0.40 / 4);
  const fatGoal = Math.round(calorieGoal * 0.30 / 9);

  const macroRows = [
    { label: 'Protein', val: proteinG, goal: proteinGoal, color: Colors.blue },
    { label: 'Carbs', val: carbsG, goal: carbsGoal, color: Colors.orange },
    { label: 'Fat', val: fatG, goal: fatGoal, color: Colors.teal },
  ];

  const sections = MEAL_ORDER.map(meal => ({
    key: meal,
    title: MEAL_LABELS[meal],
    data: (data?.logs ?? []).filter(l => l.mealType === meal),
    kcal: (data?.logs ?? []).filter(l => l.mealType === meal).reduce((s, l) => s + (l.calories ?? 0), 0),
  }));

  function toggleSection(title: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingTop: 6 }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 28, letterSpacing: -0.5 }}>Food</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => router.push('/barcode-scanner' as never)}
              style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1,
                width: 40, height: 40, borderRadius: 12,
                backgroundColor: Colors.surface,
                borderWidth: 1, borderColor: Colors.border,
                alignItems: 'center', justifyContent: 'center',
              })}
            >
              <Text style={{ fontSize: 18 }}>📷</Text>
            </Pressable>
            <Pressable
              style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.orange, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: '#fff', fontSize: 22, lineHeight: 26 }}>+</Text>
            </Pressable>
          </View>
        </View>

        {/* Summary card with donut */}
        <View style={{ backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, padding: 18, marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
            <MacroDonutSVG calories={eaten} proteinG={proteinG} carbsG={carbsG} fatG={fatG} />
            <View style={{ flex: 1, gap: 8 }}>
              {macroRows.map(m => (
                <View key={m.label}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: m.color }} />
                      <Text style={{ fontSize: 12, color: Colors.muted, fontFamily: 'DMSans-Regular' }}>{m.label}</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontFamily: 'JetBrainsMono-Regular', color: m.color }}>
                      {m.val}<Text style={{ color: `${Colors.muted}80`, fontSize: 10 }}>/{m.goal}g</Text>
                    </Text>
                  </View>
                  <View style={{ height: 4, backgroundColor: Colors.surface2, borderRadius: 999 }}>
                    <View style={{ height: '100%', width: `${Math.min(100, (m.val / Math.max(m.goal, 1)) * 100)}%`, backgroundColor: m.color, borderRadius: 999 }} />
                  </View>
                </View>
              ))}
              <Text style={{ fontSize: 11, color: Colors.muted, fontFamily: 'DMSans-Regular', marginTop: 2 }}>
                {Math.max(0, calorieGoal - eaten)} kcal remaining
              </Text>
            </View>
          </View>
        </View>

        {/* Search bar */}
        <FoodSearchBar onSelect={(food) => setSelectedFood(food)} />

        {/* Meal sections */}
        <View style={{ gap: 12, marginTop: 14 }}>
          {sections.map(section => {
            const isOpen = expanded.has(section.title);
            const isEmpty = section.data.length === 0;
            return (
              <View key={section.key}>
                <Pressable
                  onPress={() => toggleSection(section.title)}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2, marginBottom: isOpen ? 8 : 0 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                      {section.title}
                    </Text>
                    {section.kcal > 0 && (
                      <Text style={{ fontSize: 12, fontFamily: 'JetBrainsMono-Regular', color: Colors.muted }}>
                        {section.kcal} kcal
                      </Text>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 13, color: Colors.orange, fontFamily: 'DMSans-Bold' }}>+ Add</Text>
                    <Text style={{ color: Colors.muted, fontSize: 12 }}>{isOpen ? '▲' : '▼'}</Text>
                  </View>
                </Pressable>

                {isOpen && (
                  <View style={{ gap: 8 }}>
                    {isEmpty ? (
                      <View style={{ backgroundColor: 'transparent', borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.border, padding: 14, alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, color: Colors.muted, fontFamily: 'DMSans-Regular' }}>Nothing logged yet</Text>
                      </View>
                    ) : (
                      section.data.map(item => (
                        <Pressable
                          key={item.id}
                          onLongPress={() => deleteLog(item.id)}
                          style={{ backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, fontFamily: 'DMSans-Bold', color: Colors.text }}>{item.name}</Text>
                            {item.brand && (
                              <Text style={{ fontSize: 12, color: Colors.muted, fontFamily: 'DMSans-Regular', marginTop: 2 }}>{item.brand}</Text>
                            )}
                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 5 }}>
                              <Text style={{ fontSize: 11, fontFamily: 'JetBrainsMono-Regular', color: Colors.blue }}>P {Math.round(item.proteinG ?? 0)}g</Text>
                              <Text style={{ fontSize: 11, fontFamily: 'JetBrainsMono-Regular', color: Colors.orange }}>C {Math.round(item.carbsG ?? 0)}g</Text>
                              <Text style={{ fontSize: 11, fontFamily: 'JetBrainsMono-Regular', color: Colors.teal }}>F {Math.round(item.fatG ?? 0)}g</Text>
                            </View>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ fontSize: 16, fontFamily: 'JetBrainsMono-Regular', color: Colors.text }}>{Math.round(item.calories ?? 0)}</Text>
                            <Text style={{ fontSize: 10, color: Colors.muted, fontFamily: 'DMSans-Regular' }}>kcal</Text>
                          </View>
                        </Pressable>
                      ))
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>

      </ScrollView>

      {selectedFood && (
        <LogFoodSheet food={selectedFood} onClose={() => setSelectedFood(null)} />
      )}
    </SafeAreaView>
  );
}
