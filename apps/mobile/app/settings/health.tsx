import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View, Platform, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { ScreenHeader, Section, ToggleRow, NavRow, PrimaryButton } from '@/components/settings/SettingsUI';
import { healthSource } from '@/lib/health/source';
import { connectHealth, disconnectHealth, isHealthSyncOn, lastHealthSync, syncHealth } from '@/lib/health/sync';
import { useHealthRecent } from '@/hooks/useHealthRecent';
import { dayLabel } from '@/lib/date';
import { confirmAction, notify } from '@/lib/confirm';
import { showToast } from '@/stores/toastStore';

function timeAgo(d: Date | null) {
  if (!d) return 'Never';
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs} h ago` : d.toLocaleDateString();
}

/** Connect Apple Health or Health Connect and see what's been synced. */
export default function HealthSettingsScreen() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [on, setOn] = useState(false);
  const [last, setLast] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);
  const recent = useHealthRecent();

  const refresh = useCallback(async () => {
    setAvailable(await healthSource.isAvailable());
    setOn(await isHealthSyncOn());
    setLast(await lastHealthSync());
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  async function runSync() {
    setSyncing(true);
    try {
      const result = await syncHealth({ force: true });
      if (result) {
        const w = result.workouts.created;
        showToast(`Synced: ${w} new ${w === 1 ? 'workout' : 'workouts'}, ${result.days} days, ${result.weights} weigh-ins`, 'info');
      }
      await refresh();
    } catch (err) {
      notify("Couldn't sync", (err as Error).message ?? 'Try again in a moment.');
    } finally {
      setSyncing(false);
    }
  }

  async function toggle(value: boolean) {
    if (value) {
      const ok = await connectHealth();
      if (!ok) {
        notify(`Couldn't connect ${healthSource.name}`, Platform.OS === 'android'
          ? 'Allow GRIT in Health Connect, then try again.'
          : 'Allow GRIT in the Health app (Sharing → Apps), then try again.');
        return;
      }
      setOn(true);
      await runSync();
    } else {
      const ok = await confirmAction({
        title: `Stop syncing ${healthSource.name}?`,
        message: 'Workouts, steps and weigh-ins already imported stay in GRIT.',
        confirmLabel: 'Stop syncing',
      });
      if (!ok) return;
      await disconnectHealth();
      await refresh();
    }
  }

  const name = healthSource.name;
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}>
      <ScreenHeader title={Platform.OS === 'web' ? 'Health data' : name} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 22, paddingBottom: 48 }}>
        {Platform.OS === 'web' ? (
          <Section>
            <Text style={{ color: Colors.text, fontFamily: 'DMSans-Regular', fontSize: 14, lineHeight: 20 }}>
              Apple Health and Health Connect sync from the GRIT iOS and Android apps. What they import shows up here too.
            </Text>
          </Section>
        ) : available === null ? (
          <ActivityIndicator color={Colors.orange} />
        ) : !available ? (
          <Section footer={Platform.OS === 'android' ? 'Health Connect comes with Android 14 and later, and is a free download for Android 9–13.' : undefined}>
            <Text style={{ color: Colors.text, fontFamily: 'DMSans-Regular', fontSize: 14 }}>{name} isn't available on this phone.</Text>
            {Platform.OS === 'android' && (
              <NavRow icon="⬇️" label="Get Health Connect" onPress={() => Linking.openURL('market://details?id=com.google.android.apps.healthdata')} />
            )}
          </Section>
        ) : (
          <>
            <Section footer={`Reads workouts, steps, sleep and weight. GRIT never writes to ${name}.`}>
              <ToggleRow label={`Sync with ${name}`} hint={on ? `Last synced ${timeAgo(last).toLowerCase()}` : undefined} value={on} onChange={toggle} />
            </Section>
            {on && <PrimaryButton label={syncing ? 'Syncing…' : 'Sync now'} onPress={runSync} loading={syncing} />}
          </>
        )}

        <Section title="What's come in" footer="Imported workouts appear in Stats and your feed like logged ones, and count toward challenges. Daily steps count toward step challenges.">
          {recent.isLoading ? (
            <ActivityIndicator color={Colors.orange} />
          ) : (recent.data?.days ?? []).length === 0 ? (
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14 }}>Nothing synced in the last week.</Text>
          ) : (
            <>
              {[...recent.data!.days].reverse().map((d) => (
                <View key={d.date} style={{ flexDirection: 'row', gap: 12 }}>
                  <Text style={{ flex: 1, color: Colors.text, fontFamily: 'DMSans-Medium', fontSize: 14 }}>{dayLabel(d.date)}</Text>
                  <Text style={{ color: Colors.muted, fontFamily: 'JetBrainsMono-Regular', fontSize: 13 }}>
                    {d.steps != null ? `${d.steps.toLocaleString()} steps` : ''}
                    {d.steps != null && d.sleepMinutes != null ? ' · ' : ''}
                    {d.sleepMinutes != null ? `${Math.floor(d.sleepMinutes / 60)}h ${d.sleepMinutes % 60}m sleep` : ''}
                  </Text>
                </View>
              ))}
              <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12 }}>
                {recent.data!.importedWorkouts} imported {recent.data!.importedWorkouts === 1 ? 'workout' : 'workouts'} in total
              </Text>
            </>
          )}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}
