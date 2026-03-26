import React, { useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, Alert,
} from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useHabitPresets, useCreateHabit } from '@/hooks/useHabits';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';

interface CreateHabitSheetProps {
  onClose: () => void;
}

type Mode = 'presets' | 'custom';

export function CreateHabitSheet({ onClose }: CreateHabitSheetProps) {
  const sheetRef = useRef<BottomSheet>(null);
  const { data: presets } = useHabitPresets();
  const { mutateAsync: createHabit, isPending } = useCreateHabit();

  const [mode, setMode] = useState<Mode>('presets');
  const [customName, setCustomName] = useState('');
  const [customEmoji, setCustomEmoji] = useState('✅');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  async function handleCreate() {
    try {
      if (mode === 'presets') {
        if (!selectedPreset) {
          Alert.alert('Pick a habit', 'Select one of the presets or switch to custom.');
          return;
        }
        await createHabit({ presetKey: selectedPreset });
      } else {
        if (!customName.trim()) {
          Alert.alert('Name required', 'Please enter a habit name.');
          return;
        }
        await createHabit({ name: customName.trim(), emoji: customEmoji });
      }
      onClose();
    } catch (err: any) {
      Alert.alert('Could not create habit', err?.response?.data?.message ?? err.message);
    }
  }

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={['75%']}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={{ backgroundColor: Colors.surface }}
      handleIndicatorStyle={{ backgroundColor: Colors.muted }}
    >
      <BottomSheetScrollView contentContainerStyle={{ padding: 24, gap: 20, paddingBottom: 40 }}>
        <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 20 }}>
          Add a habit
        </Text>

        {/* Mode toggle */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['presets', 'custom'] as Mode[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 999,
                backgroundColor: mode === m ? Colors.orange : Colors.surface2,
                borderWidth: 1.5,
                borderColor: mode === m ? Colors.orange : Colors.border,
                alignItems: 'center',
              }}
            >
              <Text style={{
                color: mode === m ? '#fff' : Colors.muted,
                fontFamily: 'DMSans-Bold',
                fontSize: 14,
                textTransform: 'capitalize',
              }}>
                {m === 'presets' ? '📋 Presets' : '✏️ Custom'}
              </Text>
            </Pressable>
          ))}
        </View>

        {mode === 'presets' ? (
          <View style={{ gap: 8 }}>
            {(presets ?? []).map((p) => (
              <Pressable
                key={p.key}
                onPress={() => setSelectedPreset(p.key)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 14,
                  borderRadius: 16,
                  backgroundColor: selectedPreset === p.key ? `${Colors.orange}22` : Colors.surface2,
                  borderWidth: 1.5,
                  borderColor: selectedPreset === p.key ? Colors.orange : Colors.border,
                }}
              >
                <Text style={{ fontSize: 22 }}>{p.emoji}</Text>
                <Text style={{
                  color: Colors.text,
                  fontFamily: 'DMSans-Medium',
                  fontSize: 15,
                  flex: 1,
                }}>
                  {p.name}
                </Text>
                {selectedPreset === p.key && (
                  <Text style={{ color: Colors.orange, fontSize: 18 }}>✓</Text>
                )}
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            <View>
              <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12, marginBottom: 8 }}>
                HABIT NAME
              </Text>
              <TextInput
                style={{
                  backgroundColor: Colors.surface2,
                  borderRadius: 16,
                  padding: 14,
                  color: Colors.text,
                  fontFamily: 'DMSans-Regular',
                  fontSize: 16,
                  borderWidth: 1.5,
                  borderColor: Colors.border,
                }}
                placeholder="e.g. No caffeine after 2pm"
                placeholderTextColor={Colors.muted}
                value={customName}
                onChangeText={setCustomName}
                maxLength={60}
              />
            </View>
            <View>
              <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12, marginBottom: 8 }}>
                EMOJI
              </Text>
              <TextInput
                style={{
                  backgroundColor: Colors.surface2,
                  borderRadius: 16,
                  padding: 14,
                  color: Colors.text,
                  fontSize: 24,
                  borderWidth: 1.5,
                  borderColor: Colors.border,
                  width: 72,
                  textAlign: 'center',
                }}
                value={customEmoji}
                onChangeText={(t) => setCustomEmoji(t.slice(-2))} // keep last emoji
                maxLength={2}
              />
            </View>
          </View>
        )}

        <Button label="Add habit" onPress={handleCreate} loading={isPending} />
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
