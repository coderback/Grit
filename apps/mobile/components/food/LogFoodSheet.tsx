import React, { useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
} from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { SheetTextInput, sheetKeyboardProps } from '@/components/ui/SheetTextInput';
import * as Haptics from 'expo-haptics';
import { useLogFood, type NormalizedFood } from '@/hooks/useFoodLog';
import { foodKey, useFavoriteFoods, useRemoveFavorite, useSaveFavorite } from '@/hooks/useQuickFoods';
import { Button } from '@/components/ui/Button';
import { VerifiedPill } from '@/components/food/VerifiedPill';
import { useHideTabBar } from '@/stores/uiStore';
import { Colors } from '@/constants/colors';
import { loggedAtFor } from '@/lib/date';
import { notify } from '@/lib/confirm';
import { portionGrams } from '@/lib/quickFoods';
import {
  MAX_LOG_GRAMS, defaultOption, foodUnit, formatGrams, qtyAfterSwitch, round1, servingLog, servingOptions,
  type ServingOption,
} from '@/lib/servings';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

/** Read during render, so it follows the current theme */
const fieldStyle = () => ({
  backgroundColor: Colors.surface2,
  borderRadius: 16,
  padding: 12,
  color: Colors.text,
  fontFamily: 'DMSans-Regular',
  fontSize: 16,
  borderWidth: 1.5,
  borderColor: Colors.border,
} as const);
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

  // Foods from the database carry nutrition per 100 g (or ml) plus servings
  // to pick from; manual entries have neither, so the user types values per
  // serving. Saved portions (recent or favourite foods) carry amounts for
  // the whole portion, so servings multiply them directly. A database food
  // can have no Open Food Facts id, so `foodId` also marks it as not manual.
  const isPortion = !!food?.portion;
  const isManual = !food?.offId && !food?.foodId && !isPortion;
  const usesPicker = !!food && !isManual && !isPortion;
  const unit = food ? foodUnit(food) : 'g';
  const [name, setName] = useState(food?.name ?? '');
  const [manual, setManual] = useState({ calories: '', proteinG: '', carbsG: '', fatG: '' });
  const num = (v: string) => Math.max(0, parseFloat(v) || 0);

  // The serving picker: the food's servings, then 100 g, then grams typed directly
  const options = useMemo(() => (food && usesPicker ? servingOptions(food) : []), [food, usesPicker]);
  const [optionKey, setOptionKey] = useState(() => (food && options.length ? defaultOption(food, options).key : ''));
  const option = options.find((o) => o.key === optionKey) ?? options[0];
  const picked = food && usesPicker && option ? servingLog(food, option, qty) : null;

  const servings = parseFloat(qty) > 0 ? parseFloat(qty) : 1;
  const amount = picked ? picked.grams : servings * (food?.servingQty ?? 100); // grams or ml eaten
  // How much of the food's listed amounts this is
  const factor = isManual ? servings : isPortion ? servings : amount / 100;

  const adjustedCalories = isManual ? num(manual.calories) * servings : picked ? picked.calories : (food?.calories ?? 0) * factor;
  const adjustedProtein = isManual ? num(manual.proteinG) * servings : picked ? picked.proteinG : (food?.proteinG ?? 0) * factor;
  const adjustedCarbs = isManual ? num(manual.carbsG) * servings : picked ? picked.carbsG : (food?.carbsG ?? 0) * factor;
  const adjustedFat = isManual ? num(manual.fatG) * servings : picked ? picked.fatG : (food?.fatG ?? 0) * factor;
  const caffeineMg = food?.caffeineMg != null && !isManual ? Math.round(food.caffeineMg * factor) : undefined;
  const alcoholG = food?.alcoholG != null && !isManual ? Math.round(food.alcoholG * factor * 10) / 10 : undefined;

  // What's logged: database foods as grams, so the server can save their nutrients
  const loggedQty = isManual ? servings : picked ? round1(amount) : amount;
  const loggedUnit = isManual ? 'serving' : picked ? unit : food?.servingUnit ?? 'g';
  const loggedFoodId = !isManual ? food?.foodId : undefined;
  const loggedGrams = picked
    ? (unit === 'g' ? round1(amount) : undefined)
    : isPortion ? portionGrams(food?.portionGrams, servings) : undefined;

  // The star saves exactly what would be logged now
  const { data: favorites } = useFavoriteFoods();
  const { mutate: saveFavorite, isPending: savingFavorite } = useSaveFavorite();
  const { mutate: removeFavorite, isPending: removingFavorite } = useRemoveFavorite();
  const favName = isManual ? name.trim() : food?.name ?? '';
  const favorite = favorites?.find((f) => f.key === foodKey(favName, food?.brand));
  function toggleFavorite() {
    if (!food || !favName) return;
    Haptics.selectionAsync();
    if (favorite) {
      removeFavorite(favorite.id);
      return;
    }
    saveFavorite({
      name: favName,
      brand: food.brand,
      barcode: food.barcode,
      calories: Math.round(adjustedCalories),
      proteinG: Math.round(adjustedProtein * 10) / 10,
      carbsG: Math.round(adjustedCarbs * 10) / 10,
      fatG: Math.round(adjustedFat * 10) / 10,
      servingQty: loggedQty,
      servingUnit: loggedUnit,
      foodId: loggedFoodId ?? null,
      grams: loggedGrams ?? null,
    });
  }

  function pickOption(o: ServingOption) {
    if (o.key === option?.key) return;
    Haptics.selectionAsync();
    // Keep the amount when switching to grams; start at 1 of a serving
    setQty(qtyAfterSwitch(o, amount));
    setOptionKey(o.key);
  }

  const handleLog = useCallback(async () => {
    if (!food) return;
    if (isManual && (!name.trim() || !manual.calories.trim())) {
      Alert.alert('Missing details', 'Enter a name and the calories per serving.');
      return;
    }
    if (usesPicker && !(amount > 0)) {
      notify('How much?', `Enter the ${unit === 'ml' ? 'millilitres' : 'grams'} you had.`);
      return;
    }
    if (loggedGrams != null && loggedGrams > MAX_LOG_GRAMS) {
      notify("That's a lot", `Log up to ${MAX_LOG_GRAMS.toLocaleString()} g at a time.`);
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
        servingQty: loggedQty,
        servingUnit: loggedUnit,
        foodId: loggedFoodId,
        grams: loggedGrams,
        caffeineMg,
        alcoholG,
        loggedAt: date ? loggedAtFor(date) : undefined,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch {
      Alert.alert('Error', 'Could not log food. Please try again.');
    }
  }, [food, isManual, name, manual.calories, usesPicker, amount, unit, mealType, loggedQty, loggedUnit, loggedFoodId, loggedGrams, adjustedCalories, adjustedProtein, adjustedCarbs, adjustedFat, caffeineMg, alcoholG, logFood, onClose, date]);

  if (!food) return null;

  const directLabel = unit === 'ml' ? 'Millilitres' : 'Grams';
  const qtyLabel = isPortion
    ? `Portions (1 = ${Math.round(food.servingQty * 10) / 10} ${food.servingUnit})`
    : isManual
      ? 'Servings'
      : option?.direct
        ? directLabel
        : `Servings · ${formatGrams(amount)} ${unit}`;

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={[isPortion ? '55%' : '75%']}
      enablePanDownToClose
      onClose={onClose}
      {...sheetKeyboardProps}
      backgroundStyle={{ backgroundColor: Colors.surface }}
      handleIndicatorStyle={{ backgroundColor: Colors.muted }}
    >
      <BottomSheetScrollView contentContainerStyle={{ padding: 24, gap: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* Food name */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1 }}>
          {isManual ? (
            <SheetTextInput
              style={fieldStyle()}
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
          {food.verified === true && (
            <View style={{ flexDirection: 'row', marginTop: 6 }}>
              <VerifiedPill size="medium" />
            </View>
          )}
        </View>
          <Pressable
            onPress={toggleFavorite}
            disabled={!favName || savingFavorite || removingFavorite}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={favorite ? 'Remove from favourites' : 'Save to favourites'}
            aria-checked={!!favorite}
            style={{ opacity: favName ? 1 : 0.4, paddingTop: 2 }}
          >
            <Text style={{ fontSize: 22, color: favorite ? Colors.orange : Colors.muted }}>{favorite ? '★' : '☆'}</Text>
          </Pressable>
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
                  style={fieldStyle()}
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

        {/* Serving picker (database foods) */}
        {usesPicker && options.length > 0 && (
          <View style={{ gap: 6 }}>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12 }}>Serving</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} accessibilityRole="radiogroup" accessibilityLabel="Serving">
              {options.map((o) => {
                const selected = o.key === option?.key;
                return (
                  <Pressable
                    key={o.key}
                    onPress={() => pickOption(o)}
                    accessibilityRole="radio"
                    accessibilityLabel={o.direct ? `Type the amount in ${directLabel.toLowerCase()}` : o.label}
                    aria-checked={selected}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor: selected ? Colors.orange : Colors.surface2,
                      borderWidth: 1.5,
                      borderColor: selected ? Colors.orange : Colors.border,
                    }}
                  >
                    <Text style={{ color: selected ? '#fff' : Colors.muted, fontFamily: selected ? 'DMSans-Bold' : 'DMSans-Medium', fontSize: 12 }}>
                      {o.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Qty + meal type row */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12, marginBottom: 6 }}>
              {qtyLabel}
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
              {...(usesPicker ? { accessibilityLabel: option?.direct ? `${directLabel} eaten` : 'Number of servings' } : {})}
            />
          </View>

          <View style={{ flex: 2 }}>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12, marginBottom: 6 }}>
              Meal
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {MEAL_TYPES.map((m) => (
                <Pressable accessibilityRole="button" aria-selected={mealType === m}
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
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
