import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  useActivityLogsForDate,
  useWeeklySummary,
  type ActivityLog,
} from '@/hooks/useActivityLog';
import { WeeklyBarChart } from '@/components/activity/WeeklyBarChart';
import { LogActivitySheet } from '@/components/activity/LogActivitySheet';
import { Colors } from '@/constants/colors';

const ACTIVITY_LABELS: Record<string, string> = {
  running: '🏃 Running', cycling: '🚴 Cycling', walking: '🚶 Walking',
  swimming: '🏊 Swimming', strength_training: '🏋️ Strength', yoga: '🧘 Yoga',
  hiit: '⚡ HIIT', other: '✨ Other',
};

function ActivityLogCard({ item }: { item: ActivityLog }) {
  return (
    <View style={{
      backgroundColor: Colors.surface,
      borderRadius: 16,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: Colors.border,
    }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 15 }}>
          {ACTIVITY_LABELS[item.activityType] ?? item.activityType}
        </Text>
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13, marginTop: 2 }}>
          {item.durationMin} min
          {item.caloriesBurned ? ` · ${Math.round(item.caloriesBurned)} kcal` : ''}
          {item.steps ? ` · ${item.steps.toLocaleString()} steps` : ''}
        </Text>
      </View>
      {item.source !== 'manual' && (
        <Text style={{ color: Colors.muted, fontSize: 11, fontFamily: 'DMSans-Regular' }}>
          {item.source === 'healthkit' ? 'Apple Health' : 'Google Health'}
        </Text>
      )}
    </View>
  );
}

export default function ActivityScreen() {
  const today = new Date().toISOString().split('T')[0];
  const { data: todayLogs } = useActivityLogsForDate(today);
  const { data: weekly } = useWeeklySummary();
  const [showSheet, setShowSheet] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      return () => setShowSheet(false);
    }, [])
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: 100 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 24 }}>
            Activity
          </Text>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowSheet(true);
            }}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              backgroundColor: Colors.orange,
              borderRadius: 999,
              paddingHorizontal: 18,
              paddingVertical: 10,
            })}
          >
            <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 14 }}>
              + Log
            </Text>
          </Pressable>
        </View>

        {/* Weekly chart */}
        {weekly && (
          <View style={{ backgroundColor: Colors.surface, borderRadius: 20, padding: 20, gap: 12, borderWidth: 1, borderColor: Colors.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 16 }}>
                This week
              </Text>
              <Text style={{ color: Colors.muted, fontFamily: 'JetBrainsMono-Regular', fontSize: 13 }}>
                {weekly.totals.activeMinutes}m total
              </Text>
            </View>
            <WeeklyBarChart days={weekly.days} />
          </View>
        )}

        {/* Today's logs */}
        <View style={{ gap: 12 }}>
          <Text style={{
            color: Colors.muted,
            fontFamily: 'DMSans-Bold',
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}>
            Today
          </Text>

          {todayLogs && todayLogs.length > 0 ? (
            <View style={{ gap: 8 }}>
              {todayLogs.map((item) => (
                <ActivityLogCard key={item.id} item={item} />
              ))}
            </View>
          ) : (
            <View style={{
              backgroundColor: Colors.surface,
              borderRadius: 20,
              padding: 32,
              alignItems: 'center',
              gap: 12,
              borderWidth: 1,
              borderColor: Colors.border,
            }}>
              <Text style={{ fontSize: 40 }}>🏃</Text>
              <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 17 }}>
                Nothing logged yet
              </Text>
              <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14, textAlign: 'center' }}>
                Tap + Log to record a workout.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {showSheet && <LogActivitySheet onClose={() => setShowSheet(false)} />}
    </SafeAreaView>
  );
}
