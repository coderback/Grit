import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Colors } from '@/constants/colors';
import { showToast } from '@/stores/toastStore';
import { api } from '@/lib/api';
import { removeAvatarFile } from '@/lib/avatar';
import { supabase } from '@/lib/supabase';
import { signOut } from '@/lib/session';
import { useThemeStore } from '@/stores/themeStore';
import { confirmAction, notify } from '@/lib/confirm';
import { sendPasswordReset } from '@/lib/passwordReset';
import { useAuthStore } from '@/stores/authStore';
import { useMe, useUpdateMe } from '@/hooks/useMe';
import { ChipGroup, FieldLabel, NavRow, ScreenHeader, Section } from '@/components/settings/SettingsUI';

export default function AccountScreen() {
  const { data: me } = useMe();
  const themePreference = useThemeStore((s) => s.preference);
  const setThemePreference = useThemeStore((s) => s.setPreference);
  const { mutate: save } = useUpdateMe();
  const email = useAuthStore((s) => s.user?.email);
  const [busy, setBusy] = useState(false);

  async function handlePasswordReset() {
    if (!email) return;
    try {
      await sendPasswordReset(email);
      notify('Check your email', `We sent a link to ${email} to set a new password.`);
    } catch (err: any) {
      notify("Couldn't send the email", err?.message ?? 'Try again in a minute.');
    }
  }

  async function handleSignOut() {
    if (!(await confirmAction({ title: 'Log out', message: 'Are you sure you want to log out?', confirmLabel: 'Log out' }))) return;
    // The auth listener in the root layout clears cached data and redirects
    await signOut();
  }

  async function handleDelete() {
    const ok = await confirmAction({
      title: 'Delete account?',
      message: 'This permanently deletes your account and everything you have logged: food, workouts, habits, challenges and coach chats. It cannot be undone.',
      confirmLabel: 'Delete account',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      // While still signed in: storage only lets the owner delete their photo
      const authId = (await supabase.auth.getUser()).data.user?.id;
      if (authId && me?.avatarUrl) await removeAvatarFile(authId).catch(() => {});
      await api.delete('/users/me');
      // The sign-in no longer exists, so only clear the local session
      await supabase.auth.signOut({ scope: 'local' });
    } catch (err: any) {
      setBusy(false);
      notify("Couldn't delete your account", err?.response?.data?.message?.toString() ?? 'Check your connection and try again.');
    }
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}>
      <ScreenHeader title="Account" />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 22, paddingBottom: 48 }}>
        <Section title="Signed in as">
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Medium', fontSize: 15 }}>{email ?? '—'}</Text>
        </Section>

        <Section title="Appearance" footer="System follows your phone's light or dark mode.">
          <ChipGroup
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            value={themePreference}
            onChange={setThemePreference}
          />
        </Section>

        {me && (
          <Section title="Units">
            <View style={{ gap: 8 }}>
              <FieldLabel>Weight</FieldLabel>
              <ChipGroup
                options={[{ value: 'kg', label: 'Kilograms (kg)' }, { value: 'lb', label: 'Pounds (lb)' }]}
                value={me.weightUnit}
                onChange={(weightUnit) => save({ weightUnit }, { onError: () => showToast("Couldn't save your units.") })}
              />
            </View>
            <View style={{ gap: 8 }}>
              <FieldLabel>Height</FieldLabel>
              <ChipGroup
                options={[{ value: 'cm', label: 'Centimetres' }, { value: 'ft', label: 'Feet & inches' }]}
                value={me.heightUnit}
                onChange={(heightUnit) => save({ heightUnit }, { onError: () => showToast("Couldn't save your units.") })}
              />
            </View>
          </Section>
        )}

        <Section>
          <NavRow icon="🔑" label="Change password" sub="We'll email you a link" onPress={handlePasswordReset} />
          <NavRow icon="🚪" label="Log out" onPress={handleSignOut} />
        </Section>

        <Section footer="Deleting your account removes all of your data from GRIT straight away.">
          <NavRow icon="🗑️" label={busy ? 'Deleting…' : 'Delete account'} destructive onPress={busy ? () => {} : handleDelete} />
        </Section>

        <Text style={{ color: Colors.border, fontFamily: 'DMSans-Regular', fontSize: 12, textAlign: 'center' }}>
          GRIT · v{Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
