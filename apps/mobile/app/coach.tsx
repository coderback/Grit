import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, Pressable, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAIMessages, useStreamMessage } from '@/hooks/useAICoach';
import { ChatBubble } from '@/components/coach/ChatBubble';
import { Colors } from '@/constants/colors';

interface LocalMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function CoachScreen() {
  const { data: history, isLoading: historyLoading } = useAIMessages();
  const { sendMessage, isStreaming } = useStreamMessage();

  const [input, setInput] = useState('');
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  // Sync history into local messages once loaded
  useEffect(() => {
    if (history && localMessages.length === 0) {
      setLocalMessages(history.map((m) => ({ id: m.id, role: m.role, content: m.content })));
    }
  }, [history]);

  function scrollToBottom() {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput('');

    const userMsg: LocalMessage = { id: `local-u-${Date.now()}`, role: 'user', content: text };
    setLocalMessages((prev) => [...prev, userMsg]);
    setStreamingContent('');
    scrollToBottom();

    await sendMessage(
      text,
      (chunk) => {
        setStreamingContent((prev) => prev + chunk);
        scrollToBottom();
      },
      () => {
        setStreamingContent((prev) => {
          if (prev) {
            setLocalMessages((msgs) => [
              ...msgs,
              { id: `local-a-${Date.now()}`, role: 'assistant', content: prev },
            ]);
          }
          return '';
        });
        scrollToBottom();
      },
      (err) => {
        setLocalMessages((msgs) => [
          ...msgs,
          { id: `local-err-${Date.now()}`, role: 'assistant', content: `Sorry, something went wrong: ${err}` },
        ]);
      },
    );
  }

  const displayMessages = localMessages;
  const showStreaming = isStreaming && streamingContent.length > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark }} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: Colors.border,
          gap: 12,
        }}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 15 }}>
              ←
            </Text>
          </Pressable>
          <View style={{
            width: 34, height: 34, borderRadius: 17,
            backgroundColor: Colors.orange,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 18 }}>🤖</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 16 }}>
              GRIT Coach
            </Text>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12 }}>
              10 messages / day
            </Text>
          </View>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          onContentSizeChange={scrollToBottom}
          keyboardDismissMode="on-drag"
        >
          {historyLoading && displayMessages.length === 0 ? (
            <ActivityIndicator color={Colors.orange} style={{ marginTop: 40 }} />
          ) : displayMessages.length === 0 && !historyLoading ? (
            <View style={{ alignItems: 'center', marginTop: 60, gap: 12 }}>
              <Text style={{ fontSize: 40 }}>🤖</Text>
              <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 18 }}>
                Hey, I'm your GRIT Coach
              </Text>
              <Text style={{
                color: Colors.muted, fontFamily: 'DMSans-Regular',
                fontSize: 14, textAlign: 'center', lineHeight: 22,
              }}>
                Ask me anything about your nutrition, activity, or habits. I have your data.
              </Text>
            </View>
          ) : (
            displayMessages.map((msg) => <ChatBubble key={msg.id} message={msg} />)
          )}

          {/* Live streaming bubble */}
          {showStreaming && (
            <ChatBubble
              message={{ id: 'streaming', role: 'assistant', content: streamingContent }}
            />
          )}

          {/* Typing indicator when waiting for first chunk */}
          {isStreaming && !showStreaming && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <View style={{
                width: 28, height: 28, borderRadius: 14,
                backgroundColor: Colors.orange,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 14 }}>🤖</Text>
              </View>
              <View style={{
                backgroundColor: Colors.surface,
                borderRadius: 18,
                borderBottomLeftRadius: 4,
                paddingHorizontal: 16,
                paddingVertical: 12,
                flexDirection: 'row',
                gap: 4,
              }}>
                {[0, 1, 2].map((i) => (
                  <View
                    key={i}
                    style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.muted }}
                  />
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          paddingHorizontal: 16,
          paddingVertical: 12,
          paddingBottom: Platform.OS === 'ios' ? 20 : 12,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          gap: 10,
        }}>
          <TextInput
            style={{
              flex: 1,
              backgroundColor: Colors.surface,
              borderRadius: 22,
              paddingHorizontal: 16,
              paddingVertical: 10,
              color: Colors.text,
              fontFamily: 'DMSans-Regular',
              fontSize: 15,
              maxHeight: 120,
              borderWidth: 1.5,
              borderColor: Colors.border,
            }}
            placeholder="Ask your coach..."
            placeholderTextColor={Colors.muted}
            value={input}
            onChangeText={setInput}
            multiline
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
            editable={!isStreaming}
          />
          <Pressable
            onPress={handleSend}
            disabled={!input.trim() || isStreaming}
            style={({ pressed }) => ({
              opacity: !input.trim() || isStreaming ? 0.4 : pressed ? 0.7 : 1,
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: Colors.orange,
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            <Text style={{ fontSize: 18 }}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
