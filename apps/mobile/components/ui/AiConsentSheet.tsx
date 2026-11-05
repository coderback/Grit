import React from 'react';
import { Modal, View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useAiConsentStore } from '@/stores/aiConsentStore';
import { useSetAiConsent } from '@/hooks/useAiConsent';
import { showToast } from '@/stores/toastStore';
import { Colors } from '@/constants/colors';

const POINTS = [
  'Smart log, your AI coach and workout plans send what you type, say or photograph to Microsoft’s Azure OpenAI service, which reads meals and writes replies.',
  'For coach replies, it also gets a summary of your recent logs and goals, and steps and sleep if you connected a health app.',
  'Microsoft doesn’t use it to train its models. GRIT doesn’t sell it or use it for ads.',
  'You can turn this off any time in Settings → Privacy. Everything else in GRIT works without it.',
];

/**
 * Asks before anything goes to the AI provider (Apple guideline 5.1.2(i)).
 * Mounted once in the root layout; opened through useEnsureAiConsent().
 */
export function AiConsentSheet() {
  const open = useAiConsentStore((s) => s.resolve !== null);
  const answer = useAiConsentStore((s) => s.answer);
  const { mutateAsync: setConsent, isPending } = useSetAiConsent();

  async function allow() {
    try {
      await setConsent(true);
      answer(true);
    } catch {
      showToast("Couldn't save that. Check your connection and try again.");
    }
  }

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => answer(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <View style={{ backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%' }}>
          <ScrollView contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: 36 }}>
            <Text style={{ fontSize: 30 }}>🤖</Text>
            <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 21 }} accessibilityRole="header">
              Allow GRIT's AI features?
            </Text>
            <View style={{ gap: 10 }}>
              {POINTS.map((p) => (
                <View key={p} style={{ flexDirection: 'row', gap: 10 }}>
                  <Text style={{ color: Colors.orange, fontSize: 14, lineHeight: 21 }}>•</Text>
                  <Text style={{ flex: 1, color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14, lineHeight: 21 }}>{p}</Text>
                </View>
              ))}
            </View>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12, lineHeight: 18 }}>
              The coach is an AI, not a doctor or dietitian, and can make mistakes.
            </Text>
            <Pressable
              onPress={allow}
              disabled={isPending}
              accessibilityRole="button"
              style={{ backgroundColor: Colors.orange, borderRadius: 999, paddingVertical: 16, alignItems: 'center' }}
            >
              {isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 16 }}>Allow</Text>}
            </Pressable>
            <Pressable onPress={() => answer(false)} accessibilityRole="button" style={{ alignItems: 'center', paddingVertical: 6 }}>
              <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 15 }}>Not now</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
