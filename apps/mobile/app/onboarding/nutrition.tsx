import React from 'react';
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

function SelectGroup<T extends string>({
  title,
  options,
  selected,
  onSelect,
}: {
  title: string;
  options: { value: T; label: string; emoji: string }[];
  selected: T | null;
  onSelect: (v: T) => void;
}) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>
        {title}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => {
          const isSelected = selected === o.value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onSelect(o.value)}
              style={{
                backgroundColor: isSelected ? `${Colors.orange}18` : Colors.surface,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: isSelected ? Colors.orange : Colors.border,
                paddingHorizontal: 16,
                paddingVertical: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Text style={{ fontSize: 18 }}>{o.emoji}</Text>
              <Text style={{ color: isSelected ? Colors.orange : Colors.text, fontFamily: 'DMSans-Medium', fontSize: 14 }}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function NutritionScreen() {
  const { dietType, goalFocus, accomplishment, set } = useOnboardingStore();

  const isValid = !!dietType && !!goalFocus && !!accomplishment;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 28, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <ProgressBar step={6} total={9} />

        <View style={{ gap: 6 }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 28, letterSpacing: -0.5 }}>
            Nutrition preferences
          </Text>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 15 }}>
            We'll tailor your meal recommendations.
          </Text>
        </View>

        <SelectGroup
          title="Diet Type"
          selected={dietType}
          onSelect={(v) => set({ dietType: v })}
          options={[
            { value: 'none', label: 'No restriction', emoji: '🍽️' },
            { value: 'vegetarian', label: 'Vegetarian', emoji: '🥦' },
            { value: 'vegan', label: 'Vegan', emoji: '🌱' },
            { value: 'halal_kosher', label: 'Halal / Kosher', emoji: '🕌' },
          ]}
        />

        <SelectGroup
          title="Goal Focus"
          selected={goalFocus}
          onSelect={(v) => set({ goalFocus: v })}
          options={[
            { value: 'high_protein', label: 'High Protein', emoji: '🥩' },
            { value: 'balanced', label: 'Balanced', emoji: '⚖️' },
            { value: 'low_carb', label: 'Low Carb', emoji: '🥑' },
          ]}
        />

        <SelectGroup
          title="What do you want to accomplish?"
          selected={accomplishment}
          onSelect={(v) => set({ accomplishment: v })}
          options={[
            { value: 'fat_loss', label: 'Fat Loss', emoji: '🔥' },
            { value: 'muscle_gain', label: 'Muscle Gain', emoji: '💪' },
            { value: 'energy', label: 'More Energy', emoji: '⚡' },
            { value: 'discipline', label: 'Discipline', emoji: '🧠' },
          ]}
        />

        <Pressable
          onPress={() => { if (isValid) router.push('/onboarding/advanced'); }}
          disabled={!isValid}
          style={({ pressed }) => ({
            backgroundColor: isValid ? Colors.orange : Colors.surface2,
            borderRadius: 999,
            paddingVertical: 18,
            alignItems: 'center',
            opacity: pressed ? 0.85 : 1,
            marginTop: 4,
          })}
        >
          <Text style={{ color: isValid ? '#fff' : Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 17 }}>
            Continue →
          </Text>
        </Pressable>

        <Pressable onPress={() => router.back()} style={{ alignItems: 'center', paddingBottom: 8 }}>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14 }}>← Back</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
