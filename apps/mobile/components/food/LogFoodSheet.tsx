import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
} from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { SheetTextInput, sheetKeyboardProps } from '@/components/ui/SheetTextInput';
import * as Haptics from 'expo-haptics';
import { useLogFood, type NormalizedFood } from '@/hooks/useFoodLog';
import { Button } from '@/components/ui/Button';
import { useHideTabBar } from '@/stores/uiStore';
import { Colors } from '@/constants/colors';
import { loggedAtFor } from '@/lib/date';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

const fieldStyle = {
  backgroundColor: Colors.surface2,
  borderRadius: 16,
  padding: 12,
  color: Colors.text,
  fontFamily: 'DMSans-Regular',
  fontSize: 16,
  borderWidth: 1.5,
  borderColor: Colors.border,
} as const;
type MealType = typeof MEAL_TYPES[number];

interface LogFoodSheetProps {
  food: NormalizedFood | null;
  initialMeal?: MealType;
  /** Day to log against (YYYY-MM-DD); defaults to today */
  date?: string;
  onClose: () => void;
}

export function LogFoodSheet({ food, initialMeal, date, onClose }: LogFoodSheetProps) {
  const sheetRef = useRef<BottomSheet>(null);
  useHideTabBar();
  const { mutateAsync: logFood, isPending } = useLogFood();

  const [mealType, setMealType] = useState<MealType>(initialMeal ?? 'breakfast');
  const [qty, setQty] = useState('1');

  // Foods from the database carry nutrition per 100 g (or ml) plus a serving
  // size; manual entries have neither, so the user types values per serving.
  const isManual = !food?.offId;
  const [name, setName] = useState(food?.name ?? '');
  const [manual, setManual] = useState({ calories: '', proteinG: '', carbsG: '', fatG: '' });
  const num = (v: string) => Math.max(0, parseFloat(v) || 0);

  const servings = parseFloat(qty) > 0 ? parseFloat(qty) : 1;
  const amount = servings * (food?.servingQty ?? 100); // grams or ml eaten
  const per100 = amount / 100;

  const adjustedCalories = isManual ? num(manual.calories) * servings : (food?.calories ?? 0) * per100;
  const adjustedProtein = isManual ? num(manual.proteinG) * servings : (food?.proteinG ?? 0) * per100;
  const adjustedCarbs = isManual ? num(manual.carbsG) * servings : (food?.carbsG ?? 0) * per100;
  const adjustedFat = isManual ? num(manual.fatG) * servings : (food?.fatG ?? 0) * per100;

  const handleLog = useCallback(async () => {
    if (!food) return;
    if (isManual && (!name.trim() || !manual.calories.trim())) {
      Alert.alert('Missing details', 'Enter a name and the calories per serving.');
      return;
    }
    try {
      await logFood({
        name: isManual ? name.trim() : food.name,
        brand: food.brand ?? undefined,
        barcode: food.barcode ?? undefined,
        mealType,
        calories: adjustedCalories,
        proteinG: adjustedProtein,
        carbsG: adjustedCarbs,
        fatG: adjustedFat,
        servingQty: isManual ? servings : amount,
        servingUnit: isManual ? 'serving' : food.servingUnit,
        loggedAt: date ? loggedAtFor(date) : undefined,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch {
      Alert.alert('Error', 'Could not log food. Please try again.');
    }
  }, [food, isManual, name, manual.calories, mealType, servings, amount, adjustedCalories, adjustedProtein, adjustedCarbs, adjustedFat, logFood, onClose, date]);

  if (!food) return null;

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={[isManual ? '75%' : '55%']}
      enablePanDownToClose
      onClose={onClose}
      {...sheetKeyboardProps}
      backgroundStyle={{ backgroundColor: Colors.surface }}
      handleIndicatorStyle={{ backgroundColor: Colors.muted }}
    >
      <BottomSheetView style={{ padding: 24, gap: 20 }}>
        {/* Food name */}
        <View>
          {isManual ? (
            <SheetTextInput
              style={fieldStyle}
              value={name}
              onChangeText={setName}
              placeholder="Food name"
              placeholderTextColor={Colors.muted}
              maxLength={200}
            />
          ) : (
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
          )}
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

        {/* Manual entry: nutrition per serving */}
        {isManual && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {([
              ['calories', 'kcal'],
              ['proteinG', 'Protein g'],
              ['carbsG', 'Carbs g'],
              ['fatG', 'Fat g'],
            ] as const).map(([key, label]) => (
              <View key={key} style={{ flex: 1 }}>
                <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 11, marginBottom: 4 }}>
                  {label}
                </Text>
                <SheetTextInput
                  style={fieldStyle}
                  value={manual[key]}
                  onChangeText={(v) => setManual((m) => ({ ...m, [key]: v }))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={Colors.muted}
                />
              </View>
            ))}
          </View>
        )}

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
              Servings{!isManual ? ` (${food.servingQty} ${food.servingUnit})` : ''}
            </Text>
            <SheetTextInput
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
