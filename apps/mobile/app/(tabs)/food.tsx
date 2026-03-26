import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useFoodLogsForDate,
  useDeleteFoodLog,
  type NormalizedFood,
} from '@/hooks/useFoodLog';
import { FoodSearchBar } from '@/components/food/FoodSearchBar';
import { FoodLogItem } from '@/components/food/FoodLogItem';
import { MacroDonut } from '@/components/food/MacroDonut';
import { LogFoodSheet } from '@/components/food/LogFoodSheet';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

export default function FoodScreen() {
  const today = new Date().toISOString().split('T')[0];
  const { data, isLoading } = useFoodLogsForDate(today);
  const { mutate: deleteLog } = useDeleteFoodLog();
  const [selectedFood, setSelectedFood] = useState<NormalizedFood | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      return () => setSelectedFood(null);
    }, [])
  );

  const sections = MEAL_ORDER.map((meal) => ({
    title: MEAL_LABELS[meal],
    data: (data?.logs ?? []).filter((l) => l.mealType === meal),
  })).filter((s) => s.data.length > 0);

  const calorieGoal = 2000; // TODO: pull from user profile (Phase F settings)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: 110 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 24 }}>
            Food
          </Text>
          <Pressable
            onPress={() => router.push('/barcode-scanner' as never)}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              backgroundColor: Colors.surface,
              borderRadius: 999,
              padding: 10,
              borderWidth: 1,
              borderColor: Colors.border,
            })}
          >
            <Ionicons name="barcode-outline" size={22} color={Colors.text} />
          </Pressable>
        </View>

        {/* Macro donut */}
        {data && (
          <View style={{
            backgroundColor: Colors.surface,
            borderRadius: 20,
            padding: 20,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: Colors.border,
          }}>
            <MacroDonut
              calories={data.totals.calories}
              calorieGoal={calorieGoal}
              proteinG={data.totals.proteinG}
              carbsG={data.totals.carbsG}
              fatG={data.totals.fatG}
            />
          </View>
        )}

        {/* Search bar */}
        <FoodSearchBar onSelect={(food) => setSelectedFood(food)} />

        {/* Logged meals grouped by type */}
        {sections.length > 0 ? (
          <View style={{ gap: 16 }}>
            {sections.map((section) => (
              <View key={section.title}>
                <Text style={{
                  color: Colors.muted,
                  fontFamily: 'DMSans-Bold',
                  fontSize: 12,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  marginBottom: 8,
                }}>
                  {section.title}
                </Text>
                <View style={{ gap: 6 }}>
                  {section.data.map((item) => (
                    <FoodLogItem
                      key={item.id}
                      item={item}
                      onDelete={(id) => deleteLog(id)}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : !isLoading ? (
          /* Empty state */
          <View style={{
            backgroundColor: Colors.surface,
            borderRadius: 20,
            padding: 32,
            alignItems: 'center',
            gap: 12,
            borderWidth: 1,
            borderColor: Colors.border,
          }}>
            <Text style={{ fontSize: 40 }}>🍽️</Text>
            <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 17 }}>
              Nothing logged yet
            </Text>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14, textAlign: 'center' }}>
              Search for a food above or scan a barcode to get started.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {selectedFood && (
        <LogFoodSheet food={selectedFood} onClose={() => setSelectedFood(null)} />
      )}
    </SafeAreaView>
  );
}
