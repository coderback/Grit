import React, { useState } from 'react';
import {
  View, Text, Pressable, TextInput, ScrollView, Modal, FlatList,
} from 'react-native';
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

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 80 }, (_, i) => String(currentYear - 13 - i));

function PickerModal({
  visible,
  items,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  items: string[];
  selected: string;
  onSelect: (v: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#00000088' }} onPress={onClose} />
      <View style={{ backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '50%' }}>
        <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 16 }}>Select</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Medium', fontSize: 15 }}>Done</Text>
          </Pressable>
        </View>
        <FlatList
          data={items}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => { onSelect(item); onClose(); }}
              style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: item === selected ? `${Colors.orange}18` : 'transparent' }}
            >
              <Text style={{ color: item === selected ? Colors.orange : Colors.text, fontFamily: 'DMSans-Medium', fontSize: 15 }}>
                {item}
              </Text>
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

export default function BasicsScreen() {
  const { gender, dateOfBirth, heightCm, weightKg, set } = useOnboardingStore();

  const dobParts = dateOfBirth ? dateOfBirth.split('-') : ['', '', ''];
  const [dobYear, setDobYear] = useState(dobParts[0] || '');
  const [dobMonth, setDobMonth] = useState(dobParts[1] ? MONTHS[parseInt(dobParts[1]) - 1] : '');
  const [dobDay, setDobDay] = useState(dobParts[2] || '');

  const [height, setHeight] = useState(heightCm ? String(heightCm) : '');
  const [weight, setWeight] = useState(weightKg ? String(weightKg) : '');
  const [picker, setPicker] = useState<'day' | 'month' | 'year' | null>(null);

  const isValid =
    gender &&
    dobDay && dobMonth && dobYear &&
    height.trim() && !isNaN(parseFloat(height)) &&
    weight.trim() && !isNaN(parseFloat(weight));

  function handleContinue() {
    const monthIndex = MONTHS.indexOf(dobMonth) + 1;
    const isoDate = `${dobYear}-${String(monthIndex).padStart(2, '0')}-${dobDay}`;
    set({
      gender,
      dateOfBirth: isoDate,
      heightCm: parseFloat(height),
      weightKg: parseFloat(weight),
    });
    router.push('/onboarding/activity');
  }

  const inputStyle = {
    flex: 1,
    backgroundColor: Colors.surface2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: Colors.text,
    fontFamily: 'DMSans-Medium',
    fontSize: 16,
  };

  const pickerBtnStyle = (filled: boolean) => ({
    flex: 1,
    backgroundColor: Colors.surface2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: filled ? Colors.border : Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 14,
    alignItems: 'center' as const,
  });

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 28, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <ProgressBar step={1} total={9} />

        <View style={{ gap: 6 }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 28, letterSpacing: -0.5 }}>
            Tell us about yourself
          </Text>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 15 }}>
            We use this to calculate your personalised plan.
          </Text>
        </View>

        {/* Gender */}
        <View style={{ gap: 10 }}>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Gender
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {(['male', 'female'] as const).map((g) => (
              <Pressable
                key={g}
                onPress={() => set({ gender: g })}
                style={{
                  flex: 1,
                  paddingVertical: 16,
                  borderRadius: 16,
                  alignItems: 'center',
                  backgroundColor: gender === g ? `${Colors.orange}18` : Colors.surface2,
                  borderWidth: 1,
                  borderColor: gender === g ? Colors.orange : Colors.border,
                }}
              >
                <Text style={{ color: gender === g ? Colors.orange : Colors.text, fontFamily: 'DMSans-Bold', fontSize: 16 }}>
                  {g === 'male' ? 'Male' : 'Female'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Date of birth */}
        <View style={{ gap: 10 }}>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Date of Birth
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable style={pickerBtnStyle(!!dobDay)} onPress={() => setPicker('day')}>
              <Text style={{ color: dobDay ? Colors.text : Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 15 }}>
                {dobDay || 'Day'}
              </Text>
            </Pressable>
            <Pressable style={[pickerBtnStyle(!!dobMonth), { flex: 2 }]} onPress={() => setPicker('month')}>
              <Text style={{ color: dobMonth ? Colors.text : Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 15 }}>
                {dobMonth || 'Month'}
              </Text>
            </Pressable>
            <Pressable style={pickerBtnStyle(!!dobYear)} onPress={() => setPicker('year')}>
              <Text style={{ color: dobYear ? Colors.text : Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 15 }}>
                {dobYear || 'Year'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Height & Weight */}
        <View style={{ gap: 10 }}>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Height & Weight
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 0 }}>
              <TextInput
                value={height}
                onChangeText={setHeight}
                placeholder="170"
                placeholderTextColor={Colors.muted}
                keyboardType="numeric"
                style={[inputStyle, { borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRightWidth: 0 }]}
              />
              <View style={{ backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border, borderTopRightRadius: 14, borderBottomRightRadius: 14, paddingHorizontal: 12, paddingVertical: 14 }}>
                <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 15 }}>cm</Text>
              </View>
            </View>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                value={weight}
                onChangeText={setWeight}
                placeholder="70"
                placeholderTextColor={Colors.muted}
                keyboardType="decimal-pad"
                style={[inputStyle, { borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRightWidth: 0 }]}
              />
              <View style={{ backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border, borderTopRightRadius: 14, borderBottomRightRadius: 14, paddingHorizontal: 12, paddingVertical: 14 }}>
                <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 15 }}>kg</Text>
              </View>
            </View>
          </View>
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
            marginTop: 8,
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

      <PickerModal
        visible={picker === 'day'}
        items={DAYS}
        selected={dobDay}
        onSelect={setDobDay}
        onClose={() => setPicker(null)}
      />
      <PickerModal
        visible={picker === 'month'}
        items={MONTHS}
        selected={dobMonth}
        onSelect={setDobMonth}
        onClose={() => setPicker(null)}
      />
      <PickerModal
        visible={picker === 'year'}
        items={YEARS}
        selected={dobYear}
        onSelect={setDobYear}
        onClose={() => setPicker(null)}
      />
    </SafeAreaView>
  );
}
