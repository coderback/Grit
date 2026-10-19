import React, { useCallback, useState } from 'react';
import { ScrollView, Linking, Platform, AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { Colors } from '@/constants/colors';
import { useMe, useUpdateMe, type Me } from '@/hooks/useMe';
import { requestNotificationPermission, syncLocalReminders } from '@/lib/reminders';
import { NavRow, ScreenHeader, Section, ToggleRow } from '@/components/settings/SettingsUI';

type Pref = 'notifWorkout' | 'notifMeal' | 'notifProgress' | 'notifStreak' | 'notifOffTrackOnly';

export default function NotificationsScreen() {
  const { data: me } = useMe();
  const { mutate: save } = useUpdateMe();
  const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');

  // Re-check when returning from the system settings app
  const refreshPermission = useCallback(() => {
    if (Platform.OS === 'web') return;
    Notifications.getPermissionsAsync().then((p) => setPermission(p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied'));
  }, []);
  useFocusEffect(
    useCallback(() => {
      refreshPermission();
      const sub = AppState.addEventListener('change', (s) => s === 'active' && refreshPermission());
      return () => sub.remove();
    }, [refreshPermission]),
  );

  if (!me) return <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}><ScreenHeader title="Notifications" /></SafeAreaView>;

  async function toggle(key: Pref, value: boolean) {
    const next = { ...(me as Me), [key]: value };
    // Turning a reminder on is the moment to ask for permission
    if (value && (key === 'notifWorkout' || key === 'notifMeal')) {
      const granted = await requestNotificationPermission();
      refreshPermission();
      if (!granted) return;
    }
    save({ [key]: value });
    syncLocalReminders(next).catch(() => {});
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}>
      <ScreenHeader title="Notifications" />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 22, paddingBottom: 48 }}>
        {permission === 'denied' && (
          <Section footer="Reminders can't appear until notifications are allowed for GRIT.">
            <NavRow icon="🔕" label="Notifications are off" sub="Open settings to allow them" onPress={() => Linking.openSettings()} />
          </Section>
        )}

        <Section title="Reminders" footer={Platform.OS === 'web' ? 'Reminders are sent on the iOS and Android apps.' : 'Sent at the same time each day from your phone.'}>
          <ToggleRow label="Workout reminder" hint="Every day at 5:30pm" value={me.notifWorkout} onChange={(v) => toggle('notifWorkout', v)} />
          <ToggleRow label="Meal reminders" hint="Lunch at 12:30pm and dinner at 7pm" value={me.notifMeal} onChange={(v) => toggle('notifMeal', v)} />
        </Section>

        <Section
          title="Progress alerts"
          footer="These depend on your logged data, so they're sent from GRIT's servers. Your choices are saved now and take effect when server alerts launch."
        >
          <ToggleRow label="Weekly progress check-in" value={me.notifProgress} onChange={(v) => toggle('notifProgress', v)} />
          <ToggleRow label="Streak at risk" hint="When a habit streak is about to break" value={me.notifStreak} onChange={(v) => toggle('notifStreak', v)} />
          <ToggleRow label="Only when I'm off track" hint="Skip alerts on days you're on target" value={me.notifOffTrackOnly} onChange={(v) => toggle('notifOffTrackOnly', v)} />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}
