import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type Provider = 'google' | 'apple';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

/** Which sign-in providers are switched on in the Supabase project. */
export async function enabledProviders(): Promise<Provider[]> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: ANON_KEY } });
    const settings = (await res.json()) as { external?: Record<string, boolean> };
    return (['apple', 'google'] as const).filter((p) => settings.external?.[p]);
  } catch {
    return [];
  }
}

/** The route the browser returns to after signing in with a provider. */
export function authCallbackUrl() {
  return Platform.OS === 'web'
    ? `${globalThis.location?.origin ?? ''}/auth-callback`
    : Linking.createURL('auth-callback');
}

/** Finishes a provider sign-in from the URL it returned to: a code (PKCE) or an error. */
export async function completeFromUrl(url: string): Promise<Session> {
  const params = new URLSearchParams();
  const [, query = ''] = url.split('?');
  const [, hash = ''] = url.split('#');
  for (const part of [query.split('#')[0], hash]) new URLSearchParams(part).forEach((v, k) => params.set(k, v));

  const error = params.get('error_description') ?? params.get('error');
  if (error) throw new Error(error.replace(/\+/g, ' '));
  const code = params.get('code');
  if (!code) throw new Error('The sign-in link is missing its code.');
  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
  return data.session;
}

async function nativeApple(): Promise<Session | null> {
  // Apple compares a hash of this with the one inside the identity token
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (err) {
    if ((err as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null;
    throw err;
  }
  if (!credential.identityToken) throw new Error('Apple did not return a sign-in token.');
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;

  // Apple shares the name only the first time someone signs in
  const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
  if (name) await supabase.auth.updateUser({ data: { full_name: name } }).catch(() => {});
  return data.session;
}

/**
 * Signs in with Google or Apple. iOS uses the native Apple sheet; everything
 * else goes through Supabase's sign-in page in a browser session. Resolves
 * to the session, or null if the user cancelled. On web the page navigates
 * away and the sign-in finishes on /auth-callback instead.
 */
export async function signInWithProvider(provider: Provider): Promise<Session | null> {
  if (provider === 'apple' && Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync())) {
    return nativeApple();
  }

  const redirectTo = authCallbackUrl();
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
    if (error) throw error;
    return null; // the browser is leaving for the provider
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return null;
  return completeFromUrl(result.url);
}
