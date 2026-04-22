import '../global.css';
import React, { useEffect } from 'react';
import { Stack, SplashScreen, Redirect } from 'expo-router';
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

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { session, isLoading, onboardingLoading, setSession, onboardingComplete, loadOnboardingState, setOnboardingComplete } = useAuthStore();
  usePushNotifications();

  const [fontsLoaded] = useFonts({
    'DMSans-Regular': DMSans_400Regular,
    'DMSans-Medium': DMSans_500Medium,
    'DMSans-Bold': DMSans_700Bold,
    'JetBrainsMono-Regular': JetBrainsMono_400Regular,
  });

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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setSession(session);
    });

    return () => {
      mounted = false;
      clearTimeout(fallback);
      subscription.unsubscribe();
    };
  }, [setSession, loadOnboardingState]);

  useEffect(() => {
    if (!isLoading && !onboardingLoading && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [isLoading, onboardingLoading, fontsLoaded]);

  // If a session exists but the per-device flag is missing (new device / cleared storage),
  // the user already completed onboarding when they signed up — restore the flag silently.
  useEffect(() => {
    if (!isLoading && !onboardingLoading && session && !onboardingComplete) {
      setOnboardingComplete();
    }
  }, [isLoading, onboardingLoading, session, onboardingComplete, setOnboardingComplete]);

  if (isLoading || onboardingLoading || !fontsLoaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="barcode-scanner" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="coach" />
          <Stack.Screen name="profile/[id]" />
          <Stack.Screen name="challenge/[id]" />
        </Stack>
        {!onboardingComplete && !session && <Redirect href="/onboarding" />}
        {onboardingComplete && !session && <Redirect href="/(auth)/login" />}
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
