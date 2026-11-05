import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View, Platform, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { ScreenHeader, Section, ToggleRow, NavRow, PrimaryButton } from '@/components/settings/SettingsUI';
import { healthSource } from '@/lib/health/source';
import { connectHealth, disconnectHealth, isFoodWriteOn, isHealthSyncOn, lastHealthSync, requestCycleAccess, setFoodWrite, syncHealth } from '@/lib/health/sync';
import { useCycleSummary, useHealthRecent } from '@/hooks/useHealthRecent';
import { useMe, useUpdateMe } from '@/hooks/useMe';
import { useQueryClient } from '@tanstack/react-query';
import { CYCLE_REASON, HEALTH_REASONS } from '@/lib/health/reasons';

import { dayLabel } from '@/lib/date';
import { confirmAction, notify } from '@/lib/confirm';
import { showToast } from '@/stores/toastStore';

const METRIC_LABELS: Record<string, string> = {
  resting_hr: 'Resting heart rate',
  hrv: 'Heart rate variability',
  respiratory_rate: 'Breathing rate asleep',
  sleep_temp_deviation: 'Sleeping temperature vs usual',
  vo2max: 'VO2max',
};
const UNITS: Record<string, string> = { ms: 'ms', bpm: 'bpm', breaths_min: '/min', degC: '°C', ml_kg_min: 'mL/kg/min' };

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
  const [writeFood, setWriteFood] = useState(false);
  const recent = useHealthRecent();
  const cycle = useCycleSummary();
  const { data: me } = useMe();
  const updateMe = useUpdateMe();
  const qc = useQueryClient();

  const refresh = useCallback(async () => {
    setAvailable(await healthSource.isAvailable());
    setOn(await isHealthSyncOn());
    setLast(await lastHealthSync());
    setWriteFood(await isFoodWriteOn());
  }, []);

  async function toggleCycle(value: boolean) {
    if (value) {
      const ok = await confirmAction({
        title: 'Turn on cycle data?',
        message: `GRIT will read period days and flow from ${healthSource.name}. They're kept for you alone, never shared in your feed, challenges or coach chats, and turning this off deletes them.`,
        confirmLabel: 'Turn on',
      });
      if (!ok) return;
    }
    try {
      await updateMe.mutateAsync({ consentCycleData: value });
      qc.invalidateQueries({ queryKey: ['health-cycle'] });
      if (value && on) {
        await requestCycleAccess();
        await runSync();
      }
      if (!value) showToast('Cycle data turned off and deleted', 'info');
    } catch {
      showToast("Couldn't save that. Check your connection.");
    }
  }

  async function toggleWriteFood(value: boolean) {
    const ok = await setFoodWrite(value);
    if (!ok) {
      notify(`Couldn't get permission`, `Allow GRIT to write nutrition in ${healthSource.name}, then try again.`);
      return;
    }
    setWriteFood(value);
  }
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
            <Section footer={writeFood ? `Logged meals' calories, macros and caffeine are written to ${name}.` : `GRIT only reads from ${name} unless you turn on writing meals.`}>
              <ToggleRow label={`Sync with ${name}`} hint={on ? `Last synced ${timeAgo(last).toLowerCase()}` : undefined} value={on} onChange={toggle} />
              {on && (
                <ToggleRow label={`Write meals to ${name}`} hint="Calories, protein, carbs, fat and caffeine" value={writeFood} onChange={toggleWriteFood} />
              )}
            </Section>
            {on && <PrimaryButton label={syncing ? 'Syncing…' : 'Sync now'} onPress={runSync} loading={syncing} />}
          </>
        )}

        <Section title="What GRIT reads, and why">
          {HEALTH_REASONS.map((r) => (
            <View key={r.label} style={{ gap: 2 }}>
              <Text style={{ color: Colors.text, fontFamily: 'DMSans-Medium', fontSize: 14 }}>{r.label}</Text>
              <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13, lineHeight: 18 }}>{r.reason}</Text>
            </View>
          ))}
        </Section>

        <Section title="Cycle data" footer={CYCLE_REASON}>
          <ToggleRow
            label="Import cycle data"
            hint={cycle.data?.days ? `${cycle.data.days} days stored` : 'Off unless you turn it on'}
            value={!!me?.consentCycleData}
            onChange={toggleCycle}
            disabled={updateMe.isPending}
          />
        </Section>

        {!!recent.data?.recovery?.length && (
          <Section title="Recovery" footer="From your watch or phone. Heart rate variability is compared only with readings of the same kind.">
            {recent.data.recovery.map((m) => (
              <View key={`${m.metric}-${m.type}`} style={{ flexDirection: 'row', gap: 12 }}>
                <Text style={{ flex: 1, color: Colors.text, fontFamily: 'DMSans-Medium', fontSize: 14 }}>
                  {METRIC_LABELS[m.metric] ?? m.metric}{m.type ? ` (${m.type.toUpperCase()})` : ''}
                </Text>
                <Text style={{ color: Colors.muted, fontFamily: 'JetBrainsMono-Regular', fontSize: 13 }}>
                  {m.metric === 'sleep_temp_deviation' && m.latest > 0 ? '+' : ''}{m.latest} {UNITS[m.unit] ?? m.unit}{m.days >= 7 ? ` · avg ${m.average}` : ''}
                </Text>
              </View>
            ))}
          </Section>
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
