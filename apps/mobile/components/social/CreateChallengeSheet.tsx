import React, { useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useCreateChallenge } from '@/hooks/useChallenges';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';

const DURATIONS = [3, 7, 14, 30] as const;
const STEP_PRESETS = [50_000, 100_000, 250_000, 500_000];

interface CreateChallengeSheetProps {
  onClose: () => void;
}

export function CreateChallengeSheet({ onClose }: CreateChallengeSheetProps) {
  const sheetRef = useRef<BottomSheet>(null);
  const { mutateAsync: createChallenge, isPending } = useCreateChallenge();

  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState<7 | 3 | 14 | 30>(7);
  const [goalValue, setGoalValue] = useState(100_000);

  async function handleCreate() {
    if (!title.trim()) {
      Alert.alert('Add a title', 'Give your challenge a name.');
      return;
    }
    try {
      await createChallenge({ title: title.trim(), goalValue, durationDays: duration });
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Could not create challenge.');
    }
  }

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={['70%']}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={{ backgroundColor: Colors.surface }}
      handleIndicatorStyle={{ backgroundColor: Colors.muted }}
    >
      <BottomSheetView style={{ padding: 24, gap: 22 }}>
        <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 20 }}>
          New challenge
        </Text>

        {/* Title */}
        <View style={{ gap: 8 }}>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12 }}>
            CHALLENGE NAME
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
            placeholder="e.g. Office Step Battle"
            placeholderTextColor={Colors.muted}
            value={title}
            onChangeText={setTitle}
            maxLength={50}
          />
        </View>

        {/* Duration */}
        <View style={{ gap: 8 }}>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12 }}>
            DURATION
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {DURATIONS.map((d) => (
              <Pressable
                key={d}
                onPress={() => setDuration(d)}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center',
                  backgroundColor: duration === d ? Colors.orange : Colors.surface2,
                  borderWidth: 1.5,
                  borderColor: duration === d ? Colors.orange : Colors.border,
                }}
              >
                <Text style={{
                  color: duration === d ? '#fff' : Colors.muted,
                  fontFamily: 'DMSans-Bold', fontSize: 14,
                }}>
                  {d}d
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Goal */}
        <View style={{ gap: 8 }}>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12 }}>
            GROUP STEP GOAL
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {STEP_PRESETS.map((g) => (
              <Pressable
                key={g}
                onPress={() => setGoalValue(g)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
                  backgroundColor: goalValue === g ? Colors.orange : Colors.surface2,
                  borderWidth: 1.5,
                  borderColor: goalValue === g ? Colors.orange : Colors.border,
                }}
              >
                <Text style={{
                  color: goalValue === g ? '#fff' : Colors.muted,
                  fontFamily: 'DMSans-Medium', fontSize: 13,
                }}>
                  {(g / 1000).toFixed(0)}k steps
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Button label="Create & get invite link" onPress={handleCreate} loading={isPending} />
      </BottomSheetView>
    </BottomSheet>
  );
}
