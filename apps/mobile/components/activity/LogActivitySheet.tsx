import React, { useRef, useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { SheetTextInput, sheetKeyboardProps } from '@/components/ui/SheetTextInput';
import * as Haptics from 'expo-haptics';
import { useLogActivity, useActivityTypes, useUpdateActivity, useDeleteActivity, type ActivityLog } from '@/hooks/useActivityLog';
import { confirmAction } from '@/lib/confirm';
import { loggedAtFor } from '@/lib/date';
import { Button } from '@/components/ui/Button';
import { useHideTabBar } from '@/stores/uiStore';
import { Colors } from '@/constants/colors';

// Display labels for activity types
const STEP_TYPES = ['walking', 'running', 'hiking'];

export const ACTIVITY_LABELS: Record<string, string> = {
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
  /** Edit (or delete) this workout instead of logging a new one */
  editing?: ActivityLog;
  /** Day to log a new workout against (YYYY-MM-DD); defaults to today */
  date?: string;
}

export function LogActivitySheet({ onClose, editing, date }: LogActivitySheetProps) {
  const sheetRef = useRef<BottomSheet>(null);
  useHideTabBar();
  const { mutateAsync: logActivity, isPending: logging } = useLogActivity();
  const { mutateAsync: updateActivity, isPending: updating } = useUpdateActivity();
  const { mutateAsync: deleteActivity, isPending: deleting } = useDeleteActivity();
  const isPending = logging || updating;
  const { data: types } = useActivityTypes();

  const [selectedType, setSelectedType] = useState(editing?.activityType ?? 'running');
  const [duration, setDuration] = useState(String(editing?.durationMin ?? 30));
  const [steps, setSteps] = useState(editing?.steps ? String(editing.steps) : '');
  // Step counts only make sense for on-foot workouts; they count toward step challenges
  const countsSteps = STEP_TYPES.includes(selectedType);

  const handleLog = useCallback(async () => {
    const durationMin = parseInt(duration, 10);
    if (!durationMin || durationMin < 1 || durationMin > 1440) {
      Alert.alert('Invalid duration', 'Please enter a duration in minutes.');
      return;
    }
    const stepCount = countsSteps && steps.trim() ? parseInt(steps, 10) : undefined;
    if (stepCount !== undefined && (!Number.isFinite(stepCount) || stepCount < 0 || stepCount > 300000)) {
      Alert.alert('Invalid steps', 'Enter a step count up to 300,000, or leave it empty.');
      return;
    }
    try {
      if (editing) {
        // Calories are re-estimated on the server when type or duration change
        await updateActivity({
          id: editing.id,
          activityType: selectedType,
          durationMin,
          // 0 clears a count that no longer applies
          steps: countsSteps ? stepCount ?? 0 : editing.steps ? 0 : undefined,
        });
      } else {
        await logActivity({ activityType: selectedType, durationMin, steps: stepCount, loggedAt: date ? loggedAtFor(date) : undefined });
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch {
      Alert.alert('Error', editing ? 'Could not save the workout. Please try again.' : 'Could not log activity. Please try again.');
    }
  }, [selectedType, duration, steps, countsSteps, logActivity, updateActivity, editing, date, onClose]);

  async function handleDelete() {
    if (!editing) return;
    const ok = await confirmAction({ title: 'Delete workout', message: 'Remove this workout from your log?', confirmLabel: 'Delete', destructive: true });
    if (!ok) return;
    try {
      await deleteActivity(editing.id);
      onClose();
    } catch {
      Alert.alert('Error', 'Could not delete the workout. Please try again.');
    }
  }

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={['70%']}
      enablePanDownToClose
      onClose={onClose}
      {...sheetKeyboardProps}
      backgroundStyle={{ backgroundColor: Colors.surface }}
      handleIndicatorStyle={{ backgroundColor: Colors.muted }}
    >
      <BottomSheetScrollView contentContainerStyle={{ padding: 24, gap: 20, paddingBottom: 40 }}>
        <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 20 }}>
          {editing ? 'Edit workout' : 'Log Activity'}
        </Text>

        {/* Activity type grid */}
        <View>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12, marginBottom: 10 }}>
            ACTIVITY TYPE
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(types ?? Object.keys(ACTIVITY_LABELS)).map((type) => (
              <Pressable accessibilityRole="button" aria-selected={selectedType === type}
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
              <Pressable accessibilityRole="button" aria-selected={duration === String(min)}
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
            <SheetTextInput
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

        {countsSteps && (
          <View style={{ gap: 8 }}>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12 }}>STEPS (OPTIONAL)</Text>
            <SheetTextInput
              style={{
                backgroundColor: Colors.surface2, borderRadius: 999, borderWidth: 1.5, borderColor: Colors.border,
                color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 15, paddingHorizontal: 18, paddingVertical: 10,
              }}
              placeholder="e.g. 6500 — counts toward step challenges"
              placeholderTextColor={Colors.muted}
              value={steps}
              onChangeText={(t) => setSteps(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              accessibilityLabel="Steps"
            />
          </View>
        )}

        <Button label={editing ? 'Save changes' : 'Log activity'} onPress={handleLog} loading={isPending} />
        {editing && (
          <Pressable onPress={handleDelete} disabled={deleting} accessibilityRole="button" style={{ alignItems: 'center', paddingVertical: 4 }}>
            <Text style={{ color: Colors.error, fontFamily: 'DMSans-Bold', fontSize: 14 }}>{deleting ? 'Deleting…' : 'Delete workout'}</Text>
          </Pressable>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
