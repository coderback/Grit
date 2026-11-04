import React, { useEffect, useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { notify } from '@/lib/confirm';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

type Status = 'checking' | 'ready' | 'invalid';

/** Reads the session or error from a Supabase recovery link (hash or query string). */
function parseRecoveryUrl(url: string) {
  const params = new URLSearchParams();
  const [, query = ''] = url.split('?');
  const [, hash = ''] = url.split('#');
  for (const part of [query.split('#')[0], hash]) {
    new URLSearchParams(part).forEach((v, k) => params.set(k, v));
  }
  return {
    accessToken: params.get('access_token'),
    refreshToken: params.get('refresh_token'),
    code: params.get('code'),
    error: params.get('error_description') ?? params.get('error'),
  };
}

/** Opened from the password reset email: sets a new password for the account. */
export default function ResetPasswordScreen() {
  const url = Linking.useURL();
  const [status, setStatus] = useState<Status>('checking');
  const [problem, setProblem] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!url) return;
    const link = parseRecoveryUrl(url);
    (async () => {
      if (link.error) throw new Error(link.error);
      if (link.code) {
        const { error } = await supabase.auth.exchangeCodeForSession(link.code);
        if (error) throw error;
      } else if (link.accessToken && link.refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken });
        if (error) throw error;
      } else {
        throw new Error('This link is missing its sign-in details.');
      }
      setStatus('ready');
    })().catch((err: Error) => {
      setProblem(err.message.replace(/\+/g, ' '));
      setStatus('invalid');
    });
  }, [url]);

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && confirm !== password;

  async function handleSave() {
    if (password.length < 8 || password !== confirm) return;
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      notify("Couldn't update your password", error.message);
      return;
    }
    notify('Password updated', "You're signed in with your new password.");
    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark }}>
      <KeyboardAvoidingView style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 24 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ gap: 8 }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 28, letterSpacing: -0.5 }}>Set a new password</Text>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 15, lineHeight: 21 }}>
            {status === 'checking' && 'Checking your reset link…'}
            {status === 'ready' && 'Choose a password with at least 8 characters.'}
            {status === 'invalid' && `This reset link doesn't work${problem ? `: ${problem}` : ''}. Links expire after an hour and can only be used once.`}
          </Text>
        </View>

        {status === 'ready' && (
          <View style={{ gap: 16 }}>
            <Input label="New password" placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" error={tooShort ? 'At least 8 characters.' : undefined} />
            <Input label="Confirm password" placeholder="••••••••" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" error={mismatch ? "Passwords don't match." : undefined} />
            <Button label="Save password" onPress={handleSave} loading={saving} disabled={password.length < 8 || password !== confirm} />
          </View>
        )}

        {status === 'invalid' && (
          <Button label="Back to log in" variant="secondary" onPress={() => router.replace('/(auth)/login')} />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
