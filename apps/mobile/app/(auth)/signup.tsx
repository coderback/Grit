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
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/colors';

export default function SignupScreen() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    if (!displayName.trim() || !email || !password) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Weak password', 'Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName.trim() },
        },
      });
      if (error) throw error;

      // Create user record in our backend
      await api.post('/auth/sync', { displayName: displayName.trim() });
      router.replace('/onboarding');
    } catch (err: any) {
      Alert.alert('Signup failed', err.message ?? 'Something went wrong.');
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
          {/* Header */}
          <View style={{ gap: 8 }}>
            <Text
              style={{
                fontSize: 36,
                fontFamily: 'DMSans-Bold',
                color: Colors.text,
                letterSpacing: -1,
              }}
            >
              Create your account
            </Text>
            <Text
              style={{
                fontSize: 15,
                fontFamily: 'DMSans-Regular',
                color: Colors.muted,
              }}
            >
              Start building your streak today.
            </Text>
          </View>

          {/* Form */}
          <View style={{ gap: 16 }}>
            <Input
              label="Your name"
              placeholder="Jane Smith"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              autoComplete="name"
            />
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
              placeholder="8+ characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
            />

            <View style={{ height: 4 }} />

            <Button
              label="Create account"
              onPress={handleSignup}
              loading={loading}
            />
          </View>

          {/* Fine print */}
          <Text
            style={{
              textAlign: 'center',
              color: Colors.muted,
              fontFamily: 'DMSans-Regular',
              fontSize: 12,
              lineHeight: 18,
            }}
          >
            By signing up you agree to our Terms of Service and Privacy Policy.
          </Text>

          {/* Login link */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular' }}>
              Already have an account?
            </Text>
            <Link href="/(auth)/login" asChild>
              <Pressable>
                <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold' }}>
                  Log in
                </Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
