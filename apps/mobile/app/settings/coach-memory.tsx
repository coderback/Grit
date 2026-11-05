import React, { useState } from 'react';
import { ScrollView, Text, View, Pressable, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { ScreenHeader, Section } from '@/components/settings/SettingsUI';
import { ErrorNotice } from '@/components/ui/QueryStatus';
import {
  useAddCoachMemory, useClearCoachMemories, useCoachMemories, useDeleteCoachMemory,
} from '@/hooks/useAICoach';
import { confirmAction, notify } from '@/lib/confirm';

/** The notes the coach keeps between chats: see them, add your own, delete any. */
export default function CoachMemoryScreen() {
  const { data, isLoading, isError, refetch } = useCoachMemories();
  const { mutateAsync: add, isPending: adding } = useAddCoachMemory();
  const { mutate: remove } = useDeleteCoachMemory();
  const { mutate: clear } = useClearCoachMemories();
  const [text, setText] = useState('');

  async function handleAdd() {
    const note = text.trim();
    if (note.length < 3) return;
    try {
      await add(note);
      setText('');
    } catch (err: any) {
      notify("Couldn't add that", err?.response?.data?.message?.toString() ?? 'Check your connection and try again.');
    }
  }

  async function handleClear() {
    const ok = await confirmAction({
      title: 'Forget everything?',
      message: 'Your coach will lose every note, including ones you wrote. Your chat history stays.',
      confirmLabel: 'Forget all',
      destructive: true,
    });
    if (ok) clear();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark }} edges={['top']}>
      <ScreenHeader title="What your coach knows" />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Section footer="Your coach takes short notes when you mention something that matters for your training or eating: an injury, foods you avoid, when you can work out. They're used in every chat. Notes you add yourself are never dropped automatically.">
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="e.g. Allergic to peanuts"
              placeholderTextColor={Colors.muted}
              maxLength={160}
              onSubmitEditing={handleAdd}
              returnKeyType="done"
              accessibilityLabel="Add a note for your coach"
              style={{ flex: 1, backgroundColor: Colors.surface2, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: Colors.text, fontFamily: 'DMSans-Regular', fontSize: 15, borderWidth: 1.5, borderColor: Colors.border }}
            />
            <Pressable
              onPress={handleAdd}
              disabled={text.trim().length < 3 || adding}
              accessibilityRole="button"
              style={{ paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, backgroundColor: text.trim().length >= 3 ? Colors.orange : Colors.border }}
            >
              {adding ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 14 }}>Add</Text>}
            </Pressable>
          </View>
        </Section>

        {isError && !data ? (
          <ErrorNotice what="your coach's notes" onRetry={() => refetch()} />
        ) : isLoading ? (
          <ActivityIndicator color={Colors.orange} />
        ) : !data?.length ? (
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14, textAlign: 'center' }}>
            No notes yet. Chat with your coach, or add one above.
          </Text>
        ) : (
          <>
            <Section title={`${data.length} note${data.length === 1 ? '' : 's'}`}>
              {data.map((m) => (
                <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: Colors.text, fontFamily: 'DMSans-Medium', fontSize: 15 }}>{m.text}</Text>
                    <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12 }}>
                      {m.source === 'user' ? 'Added by you' : 'From a chat'} · {new Date(m.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <Pressable onPress={() => remove(m.id)} accessibilityRole="button" accessibilityLabel={`Delete note: ${m.text}`} hitSlop={8}>
                    <Text style={{ color: Colors.error, fontFamily: 'DMSans-Medium', fontSize: 13 }}>Delete</Text>
                  </Pressable>
                </View>
              ))}
            </Section>
            <Pressable onPress={handleClear} accessibilityRole="button" style={{ alignItems: 'center', paddingVertical: 6 }}>
              <Text style={{ color: Colors.error, fontFamily: 'DMSans-Bold', fontSize: 14 }}>Forget everything</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
