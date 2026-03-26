import React, { useRef, useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { useLogActivity, useActivityTypes } from '@/hooks/useActivityLog';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';

// Display labels for activity types
const ACTIVITY_LABELS: Record<string, string> = {
  running: '🏃 Running',
  cycling: '🚴 Cycling',
  walking: '🚶 Walking',
  swimming: '🏊 Swimming',
  strength_training: '🏋️ Strength',
  yoga: '🧘 Yoga',
  hiit: '⚡ HIIT',
  rowing: '🚣 Rowing',
  elliptical: '🔄 Elliptical',
  stair_climbing: '🪜 Stairs',
  basketball: '🏀 Basketball',
  tennis: '🎾 Tennis',
  soccer: '⚽ Soccer',
  dancing: '💃 Dancing',
  hiking: '⛰️ Hiking',
  jump_rope: '🪢 Jump Rope',
  pilates: '🤸 Pilates',
  boxing: '🥊 Boxing',
  rock_climbing: '🧗 Rock Climbing',
  other: '✨ Other',
};

interface LogActivitySheetProps {
  onClose: () => void;
}

export function LogActivitySheet({ onClose }: LogActivitySheetProps) {
  const sheetRef = useRef<BottomSheet>(null);
  const { mutateAsync: logActivity, isPending } = useLogActivity();
  const { data: types } = useActivityTypes();

  const [selectedType, setSelectedType] = useState('running');
  const [duration, setDuration] = useState('30');

  const handleLog = useCallback(async () => {
    const durationMin = parseInt(duration, 10);
    if (!durationMin || durationMin < 1) {
      Alert.alert('Invalid duration', 'Please enter a duration in minutes.');
      return;
    }
    try {
      await logActivity({ activityType: selectedType, durationMin });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch {
      Alert.alert('Error', 'Could not log activity. Please try again.');
    }
  }, [selectedType, duration, logActivity, onClose]);

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={['70%']}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={{ backgroundColor: Colors.surface }}
      handleIndicatorStyle={{ backgroundColor: Colors.muted }}
    >
      <BottomSheetScrollView contentContainerStyle={{ padding: 24, gap: 20, paddingBottom: 40 }}>
        <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 20 }}>
          Log Activity
        </Text>

        {/* Activity type grid */}
        <View>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12, marginBottom: 10 }}>
            ACTIVITY TYPE
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(types ?? Object.keys(ACTIVITY_LABELS)).map((type) => (
              <Pressable
                key={type}
                onPress={() => setSelectedType(type)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: selectedType === type ? Colors.orange : Colors.surface2,
                  borderWidth: 1.5,
                  borderColor: selectedType === type ? Colors.orange : Colors.border,
                }}
              >
                <Text style={{
                  color: selectedType === type ? '#fff' : Colors.muted,
                  fontFamily: 'DMSans-Medium',
                  fontSize: 13,
                }}>
                  {ACTIVITY_LABELS[type] ?? type}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Duration */}
        <View>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12, marginBottom: 8 }}>
            DURATION (MINUTES)
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[15, 30, 45, 60].map((min) => (
              <Pressable
                key={min}
                onPress={() => setDuration(String(min))}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: duration === String(min) ? Colors.orange : Colors.surface2,
                  borderWidth: 1.5,
                  borderColor: duration === String(min) ? Colors.orange : Colors.border,
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  color: duration === String(min) ? '#fff' : Colors.muted,
                  fontFamily: 'DMSans-Bold',
                  fontSize: 15,
                }}>
                  {min}
                </Text>
              </Pressable>
            ))}
            <TextInput
              style={{
                flex: 1,
                backgroundColor: Colors.surface2,
                borderRadius: 999,
                borderWidth: 1.5,
                borderColor: Colors.border,
                color: Colors.text,
                fontFamily: 'DMSans-Bold',
                fontSize: 15,
                textAlign: 'center',
              }}
              placeholder="—"
              placeholderTextColor={Colors.muted}
              value={[15, 30, 45, 60].includes(parseInt(duration)) ? '' : duration}
              onChangeText={setDuration}
              keyboardType="number-pad"
            />
          </View>
        </View>

        <Button label="Log activity" onPress={handleLog} loading={isPending} />
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
