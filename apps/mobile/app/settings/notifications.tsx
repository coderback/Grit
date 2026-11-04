import React, { useCallback, useState } from 'react';
import { ScrollView, Linking, Platform, AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { Colors } from '@/constants/colors';
import { showToast } from '@/stores/toastStore';
import { useMe, useUpdateMe, type Me } from '@/hooks/useMe';
import { requestNotificationPermission, syncLocalReminders } from '@/lib/reminders';
import { NavRow, ScreenHeader, Section, ToggleRow } from '@/components/settings/SettingsUI';

type Pref = 'notifWorkout' | 'notifMeal' | 'notifProgress' | 'notifStreak' | 'notifOffTrackOnly' | 'notifSocial';

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
    save({ [key]: value }, { onError: () => showToast("Couldn't save that setting.") });
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
          footer="Sent from GRIT's servers at your local time, and kept in your inbox (the bell on Home)."
        >
          <ToggleRow label="Weekly progress check-in" hint="Sundays at 6pm" value={me.notifProgress} onChange={(v) => toggle('notifProgress', v)} />
          <ToggleRow label="Only when I'm off track" hint="Skip the weekly check-in on good weeks" value={me.notifOffTrackOnly} disabled={!me.notifProgress} onChange={(v) => toggle('notifOffTrackOnly', v)} />
          <ToggleRow label="Streak at risk" hint="8pm, if a habit streak hasn't been checked in" value={me.notifStreak} onChange={(v) => toggle('notifStreak', v)} />
        </Section>

        <Section title="Friends" footer="These always appear in your inbox; this controls the push alert.">
          <ToggleRow label="Friends' activity" hint="New followers, requests, kudos and challenge updates" value={me.notifSocial} onChange={(v) => toggle('notifSocial', v)} />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}
