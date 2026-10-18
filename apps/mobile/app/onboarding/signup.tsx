import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { syncOnboardingProfile } from '../../lib/onboardingProfile';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { setOnboardingComplete } = useAuthStore();

  async function handleSignup() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) throw error;
      await setOnboardingComplete();

      // With email confirmation on there's no session yet. The onboarding
      // answers stay saved on the device and are synced at first login.
      if (!data.session) {
        Alert.alert(
          'Confirm your email',
          `We sent a confirmation link to ${email.trim()}. Open it, then log in to see your plan.`,
        );
        router.replace('/(auth)/login');
        return;
      }

      try {
        await syncOnboardingProfile();
      } catch {
        Alert.alert(
          "Couldn't save your plan",
          "Your account is ready, but your plan didn't save. We'll retry next time you log in.",
        );
      }
      router.replace('/(tabs)/');
    } catch (err: any) {
      Alert.alert('Sign up failed', err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    backgroundColor: Colors.surface2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: Colors.text,
    fontFamily: 'DMSans-Regular',
    fontSize: 16,
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 28, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <View style={{ gap: 6 }}>
          <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 28, letterSpacing: -0.5 }}>
            GRIT
          </Text>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 28, letterSpacing: -0.5 }}>
            Create your account
          </Text>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 15 }}>
            Save your plan and start tracking.
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          <View style={{ gap: 8 }}>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Email
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={Colors.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={inputStyle}
            />
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Password
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Min. 6 characters"
              placeholderTextColor={Colors.muted}
              secureTextEntry
              style={inputStyle}
            />
          </View>
        </View>

        <Pressable
          onPress={handleSignup}
          disabled={loading}
          style={({ pressed }) => ({
            backgroundColor: Colors.orange,
            borderRadius: 999,
            paddingVertical: 18,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 10,
            opacity: loading ? 0.7 : pressed ? 0.85 : 1,
          })}
        >
          {loading && <ActivityIndicator size="small" color="#fff" />}
          <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 17 }}>
            {loading ? 'Creating account…' : 'Create account'}
          </Text>
        </Pressable>

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14 }}>
            Already have an account?
          </Text>
          <Pressable onPress={() => router.push('/(auth)/login')}>
            <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Medium', fontSize: 14 }}>
              Sign in
            </Text>
          </Pressable>
        </View>

        <Pressable onPress={() => router.back()} style={{ alignItems: 'center', paddingBottom: 8 }}>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14 }}>← Back</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
