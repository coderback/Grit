import React, { useState } from 'react';
import {
  View,
  Platform,
  Text,
  KeyboardAvoidingView,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { Link, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { notify } from '@/lib/confirm';
import { sendPasswordReset } from '@/lib/passwordReset';
import { Colors } from '@/constants/colors';
import { afterSignIn } from '@/lib/postSignIn';
import { SocialSignIn } from '@/components/auth/SocialSignIn';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleEmailLogin() {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Creates the backend user on first login and saves any plan answered
      // before signing up (e.g. while the email was being confirmed)
      await afterSignIn(data.session);
      router.replace('/(tabs)/');
    } catch (err: any) {
      Alert.alert('Login failed', err.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      notify('Enter your email', "Type the email you signed up with, then tap 'Forgot password?' again.");
      return;
    }
    try {
      await sendPasswordReset(email);
      notify('Check your email', `If ${email.trim()} has a GRIT account, we've sent a link to set a new password.`);
    } catch (err: any) {
      notify("Couldn't send the email", err?.message ?? 'Try again in a minute.');
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

            <Pressable onPress={handleForgotPassword} hitSlop={8} style={{ alignSelf: 'flex-end' }} accessibilityRole="button">
              <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Medium', fontSize: 13 }}>Forgot password?</Text>
            </Pressable>

            <Button
              label="Log in"
              onPress={handleEmailLogin}
              loading={loading}
            />
          </View>

          {/* Google and Apple, once switched on in Supabase */}
          <SocialSignIn />

          {/* Sign up link */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular' }}>
              New here?
            </Text>
            <Link href="/onboarding" asChild>
              <Pressable accessibilityRole="button">
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
