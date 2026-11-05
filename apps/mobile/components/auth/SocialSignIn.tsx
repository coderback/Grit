import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Platform, ActivityIndicator } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { Colors, colorScheme } from '@/constants/colors';
import { enabledProviders, signInWithProvider, type Provider } from '@/lib/socialAuth';
import { afterSignIn } from '@/lib/postSignIn';
import { notify } from '@/lib/confirm';

/**
 * "Continue with Apple / Google". Only providers switched on in Supabase are
 * shown, so nothing appears until they're configured. On iOS the Apple
 * button is Apple's own, as App Review expects.
 */
export function SocialSignIn({ dividerLabel = 'or' }: { dividerLabel?: string }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [busy, setBusy] = useState<Provider | null>(null);
  const [nativeApple, setNativeApple] = useState(false);

  useEffect(() => {
    enabledProviders().then(setProviders);
    if (Platform.OS === 'ios') AppleAuthentication.isAvailableAsync().then(setNativeApple).catch(() => {});
  }, []);

  if (providers.length === 0) return null;

  async function go(provider: Provider) {
    setBusy(provider);
    try {
      const session = await signInWithProvider(provider);
      if (!session) return; // cancelled, or the web page is redirecting
      await afterSignIn(session);
      router.replace('/(tabs)/');
    } catch (err) {
      notify("Couldn't sign in", (err as Error).message ?? 'Please try again.');
    } finally {
      setBusy(null);
    }
  }

  const light = colorScheme() === 'light';
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: Colors.border }} />
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13 }}>{dividerLabel}</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: Colors.border }} />
      </View>

      {providers.includes('apple') && (nativeApple ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={light ? AppleAuthentication.AppleAuthenticationButtonStyle.BLACK : AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          cornerRadius={999}
          style={{ height: 52 }}
          onPress={() => go('apple')}
        />
      ) : (
        <ProviderButton label="Continue with Apple" icon="" busy={busy === 'apple'} disabled={!!busy} onPress={() => go('apple')} dark={!light} />
      ))}
      {providers.includes('google') && (
        <ProviderButton label="Continue with Google" icon="G" busy={busy === 'google'} disabled={!!busy} onPress={() => go('google')} />
      )}
    </View>
  );
}

function ProviderButton({ label, icon, busy, disabled, onPress, dark }: { label: string; icon: string; busy: boolean; disabled: boolean; onPress: () => void; dark?: boolean }) {
  const bg = dark ? '#FFFFFF' : Colors.surface;
  const fg = dark ? '#000000' : Colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        height: 52, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        backgroundColor: bg, borderWidth: 1, borderColor: Colors.border, opacity: disabled && !busy ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      {busy ? <ActivityIndicator color={fg} /> : (
        <>
          {!!icon && <Text style={{ color: fg, fontFamily: 'DMSans-Bold', fontSize: 17 }}>{icon}</Text>}
          <Text style={{ color: fg, fontFamily: 'DMSans-Bold', fontSize: 15 }}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}
