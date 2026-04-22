import React, { useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { Link, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/colors';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { setOnboardingComplete } = useAuthStore();

  async function handleEmailLogin() {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await setOnboardingComplete();
      // Sync user record with backend (creates if first login)
      await api.post('/auth/sync');
      router.replace('/(tabs)/');
    } catch (err: any) {
      Alert.alert('Login failed', err.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.dark }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center', gap: 32 }}>
          {/* Wordmark */}
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Text
              style={{
                fontSize: 56,
                fontFamily: 'DMSans-Bold',
                color: Colors.orange,
                letterSpacing: -2,
              }}
            >
              GRIT
            </Text>
            <Text
              style={{
                fontSize: 15,
                fontFamily: 'DMSans-Regular',
                color: Colors.muted,
              }}
            >
              Social fitness accountability
            </Text>
          </View>

          {/* Form */}
          <View style={{ gap: 16 }}>
            <Input
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <Input
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
            />

            <View style={{ height: 4 }} />

            <Button
              label="Log in"
              onPress={handleEmailLogin}
              loading={loading}
            />
          </View>

          {/* Divider */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: Colors.border }} />
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13 }}>
              or
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: Colors.border }} />
          </View>

          {/* OAuth */}
          <View style={{ gap: 12 }}>
            <Button
              label="Continue with Google"
              variant="secondary"
              onPress={() => {
                // TODO Phase A+: implement Google OAuth via expo-auth-session
                Alert.alert('Coming soon', 'Google sign-in coming soon.');
              }}
            />
            {Platform.OS === 'ios' && (
              <Button
                label="Continue with Apple"
                variant="secondary"
                onPress={() => {
                  // TODO Phase A+: implement Apple Sign-In via expo-apple-authentication
                  Alert.alert('Coming soon', 'Apple sign-in coming soon.');
                }}
              />
            )}
          </View>

          {/* Sign up link */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular' }}>
              New here?
            </Text>
            <Link href="/onboarding" asChild>
              <Pressable>
                <Text
                  style={{
                    color: Colors.orange,
                    fontFamily: 'DMSans-Bold',
                  }}
                >
                  Create account
                </Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
