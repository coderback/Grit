import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMe, useUpdateMe } from '@/hooks/useMe';
import { ageFromDOB } from '@/lib/tdee';
import { MIN_AGE } from '@/lib/safety';
import { signOut } from '@/lib/session';
import { confirmAction, notify } from '@/lib/confirm';
import { deleteAccount } from '@/lib/deleteAccount';
import { Colors } from '@/constants/colors';

const ED_OPTIONS = [
  { value: 'no', label: 'No' },
  { value: 'yes', label: 'Yes, now or in the past' },
  { value: 'prefer_not', label: "I'd rather not say" },
] as const;

/**
 * Two questions for anyone who skipped onboarding (Google or Apple sign-in)
 * or joined before they were asked: age, since GRIT is for adults, and the
 * eating-disorder question, which turns off weight-loss targets.
 */
export default function WelcomeCheckScreen() {
  const { data: me } = useMe();
  const { mutateAsync: save, isPending } = useUpdateMe();
  const knownAge = me?.dateOfBirth ? ageFromDOB(me.dateOfBirth) : null;
  const [ageText, setAgeText] = useState(knownAge ? String(knownAge) : '');
  const [ed, setEd] = useState<(typeof ED_OPTIONS)[number]['value'] | null>(me?.edScreen ?? null);
  const [tooYoung, setTooYoung] = useState(knownAge != null && knownAge < MIN_AGE);

  const age = parseInt(ageText, 10);
  const valid = Number.isFinite(age) && age > 0 && age <= 120 && !!ed;

  async function handleContinue() {
    if (!valid) return;
    if (age < MIN_AGE) {
      setTooYoung(true);
      return;
    }
    try {
      await save({
        // Only the year is asked, as in onboarding
        dateOfBirth: knownAge === age && me?.dateOfBirth ? me.dateOfBirth.slice(0, 10) : `${new Date().getFullYear() - age}-01-01`,
        edScreen: ed!,
      });
      router.replace('/(tabs)/');
    } catch (err: any) {
      notify("Couldn't save", err?.response?.data?.message?.toString() ?? 'Check your connection and try again.');
    }
  }

  async function handleDelete() {
    const ok = await confirmAction({
      title: 'Delete account?',
      message: 'This permanently deletes your account and everything in it. It cannot be undone.',
      confirmLabel: 'Delete account',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteAccount(me?.avatarUrl);
    } catch (err: any) {
      notify("Couldn't delete your account", err?.response?.data?.message?.toString() ?? 'Check your connection and try again.');
    }
  }

  if (tooYoung) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark, padding: 24, justifyContent: 'center', gap: 16 }}>
        <Text style={{ fontSize: 40, textAlign: 'center' }}>👋</Text>
        <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 22, textAlign: 'center' }}>GRIT is for adults</Text>
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 15, lineHeight: 22, textAlign: 'center' }}>
          You need to be {MIN_AGE} or over to use GRIT. You can log out, or delete your account and everything in it.
        </Text>
        <Pressable onPress={() => signOut()} accessibilityRole="button" style={{ backgroundColor: Colors.surface2, borderRadius: 999, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 16 }}>Log out</Text>
        </Pressable>
        <Pressable onPress={handleDelete} accessibilityRole="button" style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Text style={{ color: Colors.error, fontFamily: 'DMSans-Bold', fontSize: 15 }}>Delete my account</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.dark }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 22, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 8, marginTop: 12 }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 26, letterSpacing: -0.5 }}>Before you start</Text>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 15, lineHeight: 22 }}>
            Two quick questions. Your answers are private and you can change them later.
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 16 }}>How old are you?</Text>
          <TextInput
            value={ageText}
            onChangeText={(t) => setAgeText(t.replace(/[^0-9]/g, '').slice(0, 3))}
            keyboardType="number-pad"
            placeholder="Age"
            placeholderTextColor={Colors.muted}
            accessibilityLabel="Your age"
            style={{ backgroundColor: Colors.surface2, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: Colors.text, fontFamily: 'DMSans-Regular', fontSize: 16, borderWidth: 1.5, borderColor: Colors.border, width: 120 }}
          />
        </View>

        <View style={{ gap: 10 }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 16 }}>
            Have you ever been diagnosed with, or treated for, an eating disorder?
          </Text>
          {ED_OPTIONS.map((o) => {
            const selected = ed === o.value;
            return (
              <Pressable
                key={o.value}
                onPress={() => setEd(o.value)}
                accessibilityRole="radio"
                aria-checked={selected}
                style={{ backgroundColor: selected ? `${Colors.teal}14` : Colors.surface, borderRadius: 16, borderWidth: 1.5, borderColor: selected ? Colors.teal : Colors.border, paddingVertical: 14, paddingHorizontal: 16 }}
              >
                <Text style={{ color: selected ? Colors.teal : Colors.text, fontFamily: 'DMSans-Bold', fontSize: 15 }}>{o.label}</Text>
              </Pressable>
            );
          })}
          {ed === 'yes' && (
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14, lineHeight: 21 }}>
              Thank you for telling us. GRIT won't set weight-loss targets or suggest eating less, and your coach will focus on regular meals, training and how you feel.
            </Text>
          )}
        </View>

        <Pressable
          onPress={handleContinue}
          disabled={!valid || isPending}
          accessibilityRole="button"
          style={{ backgroundColor: valid ? Colors.orange : Colors.surface2, borderRadius: 999, paddingVertical: 17, alignItems: 'center' }}
        >
          {isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: valid ? '#fff' : Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 16 }}>Continue</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
