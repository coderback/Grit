import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useMe, useUpdateMe, type Me } from '@/hooks/useMe';
import { calcAdjustedCalories, calcBMR, calcMacros, calcTDEE, ageFromDOB } from '@/lib/tdee';
import { LB_PER_KG, kgToUnit, unitToKg } from '@/lib/units';
import {
  ChipGroup, FieldLabel, NumberField, PrimaryButton, ScreenHeader, Section, ToggleRow,
} from '@/components/settings/SettingsUI';

const GOALS = [
  { value: 'lose_weight', label: 'Lose weight' },
  { value: 'build_muscle', label: 'Build muscle' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'recomp', label: 'Recomp' },
] as const;

const PACES = [
  { value: 'slow', label: 'Slow' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'aggressive', label: 'Aggressive' },
] as const;
const PACE_KG: Record<string, number> = { slow: 0.25, moderate: 0.5, aggressive: 1 };
// Weekly change with two decimals, so 0.25 kg doesn't round to 0.3
const paceText = (kg: number, unit: 'kg' | 'lb') =>
  String(Math.round((unit === 'lb' ? kg * LB_PER_KG : kg) * 100) / 100);

const ACTIVITY = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'lightly_active', label: 'Lightly active' },
  { value: 'active', label: 'Active' },
  { value: 'very_active', label: 'Very active' },
] as const;

const FOCUS = [
  { value: 'high_protein', label: 'High protein' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'low_carb', label: 'Low carb' },
] as const;

const DIETS = [
  { value: 'none', label: 'No restriction' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'halal_kosher', label: 'Halal / Kosher' },
] as const;

type Goal = (typeof GOALS)[number]['value'];
type Pace = (typeof PACES)[number]['value'];
type Activity = (typeof ACTIVITY)[number]['value'];
type Focus = (typeof FOCUS)[number]['value'];

const num = (s: string) => (s.trim() === '' ? null : Number(s));
const str = (n: number | null | undefined) => (n == null ? '' : String(n));

/** Goal, body stats, calorie and macro targets, editable in one place. */
export default function GoalsScreen() {
  const { data: me } = useMe();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}>
      <ScreenHeader title="Goals & Targets" />
      {me ? <GoalsForm me={me} /> : null}
    </SafeAreaView>
  );
}

function GoalsForm({ me }: { me: Me }) {
  const { mutateAsync: save, isPending } = useUpdateMe();
  const wUnit = me.weightUnit;
  const ftMode = me.heightUnit === 'ft';

  const [goal, setGoal] = useState<Goal>(
    (GOALS.find((g) => g.value === me.primaryGoal)?.value ?? 'maintain') as Goal,
  );
  const [pace, setPace] = useState<Pace>(me.pace ?? 'moderate');
  const [activity, setActivity] = useState<Activity | null>(me.activityLevel);
  const [weight, setWeight] = useState(str(me.weightKg != null ? kgToUnit(me.weightKg, wUnit) : null));
  const [goalWeight, setGoalWeight] = useState(str(me.goalWeightKg != null ? kgToUnit(me.goalWeightKg, wUnit) : null));
  const [heightCm, setHeightCm] = useState(str(me.heightCm != null ? Math.round(me.heightCm) : null));
  const totalIn = me.heightCm != null ? Math.round(me.heightCm / 2.54) : null;
  const [heightFt, setHeightFt] = useState(str(totalIn != null ? Math.floor(totalIn / 12) : null));
  const [heightIn, setHeightIn] = useState(str(totalIn != null ? totalIn % 12 : null));
  const [calories, setCalories] = useState(String(me.calorieGoal));
  const [focus, setFocus] = useState<Focus>(me.goalFocus);
  const [diet, setDiet] = useState(me.dietType ?? 'none');
  const [earnback, setEarnback] = useState(me.earnbackCalories);
  const [rollover, setRollover] = useState(me.rolloverCalories);
  const [activeMin, setActiveMin] = useState(String(me.activeMinutesGoal));

  const weightKg = num(weight) != null ? unitToKg(num(weight)!, wUnit) : null;
  const goalWeightKg = num(goalWeight) != null ? unitToKg(num(goalWeight)!, wUnit) : null;
  const height = ftMode
    ? num(heightFt) != null
      ? Math.round(((num(heightFt) ?? 0) * 12 + (num(heightIn) ?? 0)) * 2.54 * 10) / 10
      : null
    : num(heightCm);

  const changesWeight = goal === 'lose_weight' || goal === 'build_muscle';

  // What the onboarding formula recommends for the values on screen
  const recommended = useMemo(() => {
    if (!me.gender || !me.dateOfBirth || !weightKg || !height || !activity) return null;
    const tdee = calcTDEE(calcBMR(me.gender, weightKg, height, ageFromDOB(me.dateOfBirth)), activity);
    return calcAdjustedCalories(tdee, goal, pace);
  }, [me.gender, me.dateOfBirth, weightKg, height, activity, goal, pace]);

  const errors = {
    weight: weightKg != null && (weightKg < 20 || weightKg > 400) ? 'Enter a realistic weight.' : null,
    goalWeight: goalWeightKg != null && (goalWeightKg < 20 || goalWeightKg > 400) ? 'Enter a realistic weight.' : null,
    height: height != null && (height < 50 || height > 300) ? 'Enter a realistic height.' : null,
    calories: !num(calories) || num(calories)! < 800 || num(calories)! > 10000 ? 'Between 800 and 10,000 kcal.' : null,
    activeMin: !num(activeMin) || num(activeMin)! < 5 || num(activeMin)! > 600 ? 'Between 5 and 600 minutes.' : null,
  };
  const valid = Object.values(errors).every((e) => !e);
  const targets = calcMacros(num(calories) ?? me.calorieGoal, focus);

  async function handleSave() {
    if (!valid) return;
    try {
      await save({
        primaryGoal: goal,
        pace,
        activityLevel: activity ?? undefined,
        weightKg: weightKg ?? undefined,
        goalWeightKg: changesWeight ? (goalWeightKg ?? undefined) : undefined,
        heightCm: height ?? undefined,
        calorieGoal: num(calories)!,
        goalFocus: focus,
        dietType: diet,
        earnbackCalories: earnback,
        rolloverCalories: rollover,
        activeMinutesGoal: num(activeMin)!,
      });
      router.back();
    } catch (err: any) {
      Alert.alert("Couldn't save", err?.response?.data?.message?.toString() ?? 'Check your connection and try again.');
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 22, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Section title="Your goal">
          <ChipGroup options={[...GOALS]} value={goal} onChange={setGoal} />
          {changesWeight && (
            <>
              <View style={{ gap: 8 }}>
                <FieldLabel hint={`About ${paceText(PACE_KG[pace], wUnit)} ${wUnit} a week`}>Pace</FieldLabel>
                <ChipGroup options={[...PACES]} value={pace} onChange={setPace} />
              </View>
              <View style={{ gap: 8 }}>
                <FieldLabel>Goal weight</FieldLabel>
                <NumberField value={goalWeight} onChange={setGoalWeight} unit={wUnit} decimals placeholder="—" accessibilityLabel="Goal weight" />
                {!!errors.goalWeight && <ErrorText>{errors.goalWeight}</ErrorText>}
              </View>
            </>
          )}
        </Section>

        <Section title="Body">
          <View style={{ gap: 8 }}>
            <FieldLabel>Current weight</FieldLabel>
            <NumberField value={weight} onChange={setWeight} unit={wUnit} decimals placeholder="—" accessibilityLabel="Current weight" />
            {!!errors.weight && <ErrorText>{errors.weight}</ErrorText>}
          </View>
          <View style={{ gap: 8 }}>
            <FieldLabel>Height</FieldLabel>
            {ftMode ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}><NumberField value={heightFt} onChange={setHeightFt} unit="ft" accessibilityLabel="Height in feet" /></View>
                <View style={{ flex: 1 }}><NumberField value={heightIn} onChange={setHeightIn} unit="in" accessibilityLabel="Height in inches" /></View>
              </View>
            ) : (
              <NumberField value={heightCm} onChange={setHeightCm} unit="cm" accessibilityLabel="Height" />
            )}
            {!!errors.height && <ErrorText>{errors.height}</ErrorText>}
          </View>
          <View style={{ gap: 8 }}>
            <FieldLabel>Activity level</FieldLabel>
            <ChipGroup options={[...ACTIVITY]} value={activity} onChange={setActivity} />
          </View>
        </Section>

        <Section
          title="Daily calories"
          footer={recommended ? undefined : 'Add your weight, height and activity level to get a recommendation.'}
        >
          <View style={{ gap: 8 }}>
            <FieldLabel hint={recommended ? `Recommended for the goal above: ${recommended.toLocaleString()} kcal` : undefined}>
              Calorie goal
            </FieldLabel>
            <NumberField
              value={calories}
              onChange={setCalories}
              unit="kcal"
              accessibilityLabel="Calorie goal"
            />
            {!!errors.calories && <ErrorText>{errors.calories}</ErrorText>}
            {/* Never changed automatically, so a custom goal isn't overwritten */}
            {recommended && num(calories) !== recommended && (
              <Pressable onPress={() => setCalories(String(recommended))} hitSlop={6} accessibilityRole="button">
                <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 13 }}>Use recommended</Text>
              </Pressable>
            )}
          </View>
          <ToggleRow
            label="Add calories burned"
            hint="Exercise you log adds to that day's budget."
            value={earnback}
            onChange={setEarnback}
          />
          <ToggleRow
            label="Roll over unused calories"
            hint="Up to 200 kcal you didn't eat yesterday carry into today, if you logged food yesterday."
            value={rollover}
            onChange={setRollover}
          />
        </Section>

        <Section title="Macros">
          <ChipGroup options={[...FOCUS]} value={focus} onChange={setFocus} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              { label: 'Protein', g: targets.proteinG, color: Colors.blue },
              { label: 'Carbs', g: targets.carbsG, color: Colors.orange },
              { label: 'Fat', g: targets.fatG, color: Colors.teal },
            ].map((m) => (
              <View key={m.label} style={{ flex: 1, backgroundColor: `${m.color}14`, borderRadius: 12, borderWidth: 1, borderColor: `${m.color}33`, paddingVertical: 10, alignItems: 'center' }}>
                <Text style={{ color: m.color, fontFamily: 'JetBrainsMono-Regular', fontSize: 17 }}>{m.g}g</Text>
                <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 11, marginTop: 2 }}>{m.label}</Text>
              </View>
            ))}
          </View>
          <View style={{ gap: 8 }}>
            <FieldLabel hint="The coach only suggests foods that fit.">Diet</FieldLabel>
            <ChipGroup options={[...DIETS]} value={diet} onChange={setDiet} />
          </View>
        </Section>

        <Section title="Activity">
          <View style={{ gap: 8 }}>
            <FieldLabel>Active minutes per day</FieldLabel>
            <NumberField value={activeMin} onChange={setActiveMin} unit="min" accessibilityLabel="Active minutes per day" />
            {!!errors.activeMin && <ErrorText>{errors.activeMin}</ErrorText>}
          </View>
        </Section>

        <PrimaryButton label="Save" onPress={handleSave} disabled={!valid} loading={isPending} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <Text style={{ color: Colors.error, fontFamily: 'DMSans-Regular', fontSize: 12 }}>{children}</Text>;
}
