import React from 'react';
import { View, Text, Pressable, ScrollView, Switch } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useOnboardingStore } from '../../stores/onboardingStore';

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <View style={{ height: 3, backgroundColor: Colors.surface2, borderRadius: 2 }}>
      <View style={{ height: 3, backgroundColor: Colors.orange, borderRadius: 2, width: `${(step / total) * 100}%` }} />
    </View>
  );
}

export default function NotificationsScreen() {
  const {
    notifWorkout, notifMeal, notifProgress, notifStreak, notifOffTrackOnly, set,
  } = useOnboardingStore();

  const ITEMS: {
    key: keyof ReturnType<typeof useOnboardingStore.getState>;
    label: string;
    description: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    color: string;
  }[] = [
    { key: 'notifWorkout', label: 'Workout reminders', description: 'Daily nudge to hit your training', icon: 'barbell-outline', color: Colors.blue },
    { key: 'notifMeal', label: 'Meal reminders', description: 'Log your meals on time', icon: 'restaurant-outline', color: Colors.teal },
    { key: 'notifProgress', label: 'Progress nudges', description: 'Weekly check-ins on your goals', icon: 'trending-up-outline', color: Colors.orange },
    { key: 'notifStreak', label: 'Streak alerts', description: "Don't lose your daily streak", icon: 'flame-outline', color: Colors.error },
  ];

  const values: Record<string, boolean> = { notifWorkout, notifMeal, notifProgress, notifStreak };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <ProgressBar step={8} total={9} />

        <View style={{ gap: 6 }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 28, letterSpacing: -0.5 }}>
            Stay on track
          </Text>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 15 }}>
            Choose which notifications help you most.
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          {ITEMS.map((item) => {
            const val = values[item.key] as boolean;
            return (
              <Pressable
                key={item.key}
                onPress={() => set({ [item.key]: !val } as any)}
                style={{
                  backgroundColor: val ? `${item.color}12` : Colors.surface,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: val ? `${item.color}44` : Colors.border,
                  padding: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <View style={{
                  width: 40, height: 40, borderRadius: 12,
                  backgroundColor: val ? `${item.color}22` : Colors.surface2,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name={item.icon} size={20} color={val ? item.color : Colors.muted} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: Colors.text, fontFamily: 'DMSans-Medium', fontSize: 15 }}>{item.label}</Text>
                  <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12 }}>{item.description}</Text>
                </View>
                <Switch
                  value={val}
                  onValueChange={() => set({ [item.key]: !val } as any)}
                  trackColor={{ false: Colors.surface2, true: `${item.color}66` }}
                  thumbColor={val ? item.color : Colors.muted}
                  ios_backgroundColor={Colors.surface2}
                />
              </Pressable>
            );
          })}
        </View>

        {/* Off-track only toggle */}
        <Pressable
          onPress={() => set({ notifOffTrackOnly: !notifOffTrackOnly })}
          style={{
            backgroundColor: Colors.surface,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: Colors.border,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: Colors.text, fontFamily: 'DMSans-Medium', fontSize: 15 }}>Only when I'm off track</Text>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12 }}>Suppress all notifications unless you miss a goal</Text>
          </View>
          <Switch
            value={notifOffTrackOnly}
            onValueChange={() => set({ notifOffTrackOnly: !notifOffTrackOnly })}
            trackColor={{ false: Colors.surface2, true: `${Colors.muted}66` }}
            thumbColor={notifOffTrackOnly ? Colors.muted : Colors.border}
            ios_backgroundColor={Colors.surface2}
          />
        </Pressable>

        <Pressable
          onPress={() => router.push('/onboarding/reveal')}
          style={({ pressed }) => ({
            backgroundColor: Colors.orange,
            borderRadius: 999,
            paddingVertical: 18,
            alignItems: 'center',
            opacity: pressed ? 0.85 : 1,
            marginTop: 4,
          })}
        >
          <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 17 }}>
            See my plan →
          </Text>
        </Pressable>

        <Pressable onPress={() => router.back()} style={{ alignItems: 'center', paddingBottom: 8 }}>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14 }}>← Back</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
