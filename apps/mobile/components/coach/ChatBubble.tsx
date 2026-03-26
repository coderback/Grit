import React from 'react';
import { View, Text } from 'react-native';
import { Colors } from '@/constants/colors';
import type { AIMessage } from '@/hooks/useAICoach';

interface Props {
  message: AIMessage | { role: 'user' | 'assistant'; content: string; id: string };
}

export function ChatBubble({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 8,
      }}
    >
      {!isUser && (
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: Colors.orange,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 8,
            marginTop: 2,
          }}
        >
          <Text style={{ fontSize: 14 }}>🤖</Text>
        </View>
      )}
      <View
        style={{
          maxWidth: '78%',
          backgroundColor: isUser ? Colors.orange : Colors.surface,
          borderRadius: 18,
          borderBottomRightRadius: isUser ? 4 : 18,
          borderBottomLeftRadius: isUser ? 18 : 4,
          paddingHorizontal: 14,
          paddingVertical: 10,
        }}
      >
        <Text
          style={{
            color: isUser ? '#fff' : Colors.text,
            fontFamily: 'DMSans-Regular',
            fontSize: 15,
            lineHeight: 22,
          }}
        >
          {message.content}
        </Text>
      </View>
    </View>
  );
}
