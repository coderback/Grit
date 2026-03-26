import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
} from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { useLogFood, type NormalizedFood } from '@/hooks/useFoodLog';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
type MealType = typeof MEAL_TYPES[number];

interface LogFoodSheetProps {
  food: NormalizedFood | null;
  onClose: () => void;
}

export function LogFoodSheet({ food, onClose }: LogFoodSheetProps) {
  const sheetRef = useRef<BottomSheet>(null);
  const { mutateAsync: logFood, isPending } = useLogFood();

  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [qty, setQty] = useState('1');

  const servingQty = parseFloat(qty) || 1;
  const multiplier = servingQty / (food?.servingQty ?? 1);

  const adjustedCalories = (food?.calories ?? 0) * multiplier;
  const adjustedProtein = (food?.proteinG ?? 0) * multiplier;
  const adjustedCarbs = (food?.carbsG ?? 0) * multiplier;
  const adjustedFat = (food?.fatG ?? 0) * multiplier;

  const handleLog = useCallback(async () => {
    if (!food) return;
    try {
      await logFood({
        name: food.name,
        brand: food.brand ?? undefined,
        barcode: food.barcode ?? undefined,
        mealType,
        calories: adjustedCalories,
        proteinG: adjustedProtein,
        carbsG: adjustedCarbs,
        fatG: adjustedFat,
        servingQty,
        servingUnit: food.servingUnit,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch {
      Alert.alert('Error', 'Could not log food. Please try again.');
    }
  }, [food, mealType, servingQty, adjustedCalories, adjustedProtein, adjustedCarbs, adjustedFat, logFood, onClose]);

  if (!food) return null;

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={['55%']}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={{ backgroundColor: Colors.surface }}
      handleIndicatorStyle={{ backgroundColor: Colors.muted }}
    >
      <BottomSheetView style={{ padding: 24, gap: 20 }}>
        {/* Food name */}
        <View>
          <Text
            style={{
              color: Colors.text,
              fontFamily: 'DMSans-Bold',
              fontSize: 18,
            }}
            numberOfLines={2}
          >
            {food.name}
          </Text>
          {food.brand && (
            <Text
              style={{
                color: Colors.muted,
                fontFamily: 'DMSans-Regular',
                fontSize: 13,
                marginTop: 2,
              }}
            >
              {food.brand}
            </Text>
          )}
        </View>

        {/* Macros preview */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: Colors.surface2,
            borderRadius: 16,
            padding: 12,
            justifyContent: 'space-around',
          }}
        >
          {[
            { label: 'Calories', value: Math.round(adjustedCalories), unit: 'kcal', color: Colors.text },
            { label: 'Protein', value: Math.round(adjustedProtein), unit: 'g', color: Colors.blue },
            { label: 'Carbs', value: Math.round(adjustedCarbs), unit: 'g', color: Colors.orange },
            { label: 'Fat', value: Math.round(adjustedFat), unit: 'g', color: Colors.success },
          ].map((m) => (
            <View key={m.label} style={{ alignItems: 'center' }}>
              <Text style={{ color: m.color, fontFamily: 'JetBrainsMono-Regular', fontSize: 16 }}>
                {m.value}<Text style={{ fontSize: 11, color: Colors.muted }}>{m.unit}</Text>
              </Text>
              <Text style={{ color: Colors.muted, fontSize: 11, fontFamily: 'DMSans-Regular' }}>
                {m.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Qty + meal type row */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12, marginBottom: 6 }}>
              Servings
            </Text>
            <TextInput
              style={{
                backgroundColor: Colors.surface2,
                borderRadius: 16,
                padding: 12,
                color: Colors.text,
                fontFamily: 'DMSans-Regular',
                fontSize: 16,
                borderWidth: 1.5,
                borderColor: Colors.border,
              }}
              value={qty}
              onChangeText={setQty}
              keyboardType="decimal-pad"
              selectTextOnFocus
            />
          </View>

          <View style={{ flex: 2 }}>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12, marginBottom: 6 }}>
              Meal
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {MEAL_TYPES.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setMealType(m)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: mealType === m ? Colors.orange : Colors.surface2,
                    borderWidth: 1.5,
                    borderColor: mealType === m ? Colors.orange : Colors.border,
                  }}
                >
                  <Text style={{
                    color: mealType === m ? '#fff' : Colors.muted,
                    fontFamily: 'DMSans-Medium',
                    fontSize: 11,
                    textTransform: 'capitalize',
                  }}>
                    {m}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <Button label="Log food" onPress={handleLog} loading={isPending} />
      </BottomSheetView>
    </BottomSheet>
  );
}
