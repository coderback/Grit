import '../global.css';
import React, { useEffect, useRef } from 'react';
import { useColorScheme } from 'react-native';
import { Stack, SplashScreen, router, useSegments, usePathname } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
  JetBrainsMono_400Regular,
} from '@expo-google-fonts/jetbrains-mono';

import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/authStore';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Toast } from '@/components/ui/Toast';
import { Colors, applyColorScheme } from '@/constants/colors';
import { useThemeStore } from '@/stores/themeStore';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { CrashScreen } from '@/components/ui/CrashScreen';
import { installGlobalCrashHandler, setCrashScreen } from '@/lib/crashReporter';

installGlobalCrashHandler();

/** A crash anywhere below shows a recovery screen instead of a blank app. */
export const ErrorBoundary = CrashScreen;

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { session, isLoading, onboardingLoading, setSession, onboardingComplete, loadOnboardingState, setOnboardingComplete } = useAuthStore();
  const segments = useSegments();
  const pathname = usePathname();
  useEffect(() => setCrashScreen(pathname), [pathname]);
  // Register for push only once signed in; the backend rejects anonymous calls
  usePushNotifications(!!session);

  // Theme: the saved choice, or the phone's setting. Colors answers from the
  // current palette, so set it before anything below renders.
  const systemScheme = useColorScheme();
  const { preference, loaded: themeLoaded, load: loadTheme } = useThemeStore();
  useEffect(() => { loadTheme(); }, [loadTheme]);
  const scheme = preference === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : preference;
  applyColorScheme(scheme);

  // Screens are memoised by the navigator, so a theme change redraws them by
  // remounting the stack (keyed on the scheme), then reopens the screen the
  // user was on
  const schemeRef = useRef(scheme);
  const pathRef = useRef(pathname);
  const restoreTo = useRef<string | null>(null);
  if (schemeRef.current !== scheme) {
    restoreTo.current = pathRef.current;
    schemeRef.current = scheme;
  } else if (!restoreTo.current) {
    pathRef.current = pathname;
  }
  useEffect(() => {
    const path = restoreTo.current;
    if (!path) return;
    const timer = setTimeout(() => {
      restoreTo.current = null;
      if (path !== '/') router.replace(path as never);
    }, 0);
    return () => clearTimeout(timer);
  }, [scheme]);

  const [fontsLoaded, fontError] = useFonts({
    'DMSans-Regular': DMSans_400Regular,
    'DMSans-Medium': DMSans_500Medium,
    'DMSans-Bold': DMSans_700Bold,
    'JetBrainsMono-Regular': JetBrainsMono_400Regular,
  });
  // If the fonts fail to load, carry on with the system font rather than
  // leaving the app stuck on the splash screen
  const fontsReady = fontsLoaded || !!fontError;

  useEffect(() => {
    let mounted = true;

    loadOnboardingState();

    // Safety net: never block past 5s even if Supabase retries on bad network
    const fallback = setTimeout(() => { if (mounted) setSession(null); }, 5000);

    supabase.auth.getSession()
      .then(({ data: { session } }) => { if (mounted) { clearTimeout(fallback); setSession(session); } })
      .catch(() => { if (mounted) { clearTimeout(fallback); setSession(null); } });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Drop the previous user's cached data on sign-out (including after a 401)
      if (event === 'SIGNED_OUT') queryClient.clear();
      if (mounted) setSession(session);
    });

    return () => {
      mounted = false;
      clearTimeout(fallback);
      subscription.unsubscribe();
    };
  }, [setSession, loadOnboardingState]);

  useEffect(() => {
    if (!isLoading && !onboardingLoading && fontsReady) {
      SplashScreen.hideAsync();
    }
  }, [isLoading, onboardingLoading, fontsReady]);

  // If a session exists but the per-device flag is missing (new device / cleared storage),
  // the user already completed onboarding when they signed up — restore the flag silently.
  useEffect(() => {
    if (!isLoading && !onboardingLoading && session && !onboardingComplete) {
      setOnboardingComplete();
    }
  }, [isLoading, onboardingLoading, session, onboardingComplete, setOnboardingComplete]);

  // Signed-out users may only see onboarding, login and the password reset
  // screen (which signs in from its link); anything else sends them to one of
  // the first two
  const ready = !isLoading && !onboardingLoading && fontsReady;
  const publicRoute = segments[0] === 'onboarding' || segments[0] === '(auth)' || segments[0] === 'reset-password' || segments[0] === 'auth-callback';
  useEffect(() => {
    if (!ready || session || publicRoute) return;
    router.replace(onboardingComplete ? '/(auth)/login' : '/onboarding');
  }, [ready, session, publicRoute, onboardingComplete]);

  if (isLoading || onboardingLoading || !fontsReady || !themeLoaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
        <Stack key={scheme} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.dark } }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="barcode-scanner" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="coach" />
          <Stack.Screen name="profile/[id]" />
          <Stack.Screen name="challenge/[id]" />
          <Stack.Screen name="challenges/join/[code]" />
          <Stack.Screen name="settings/goals" />
          <Stack.Screen name="settings/notifications" />
          <Stack.Screen name="settings/account" />
          <Stack.Screen name="reset-password" />
          <Stack.Screen name="auth-callback" />
          <Stack.Screen name="plan" />
          <Stack.Screen name="friends" />
          <Stack.Screen name="connections" />
          <Stack.Screen name="settings/privacy" />
          <Stack.Screen name="notifications" />
        </Stack>
        <Toast />
        <OfflineBanner />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
