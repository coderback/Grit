import React, { useState } from 'react';
import {
  TextInput,
  View,
  Text,
  Pressable,
  type TextInputProps,
} from 'react-native';
import { Colors } from '@/constants/colors';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  rightElement?: React.ReactNode;
}

export function Input({
  label,
  error,
  rightElement,
  style,
  ...props
}: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ gap: 6 }}>
      {label && (
        <Text
          style={{
            color: Colors.muted,
            fontSize: 13,
            fontFamily: 'DMSans-Medium',
          }}
        >
          {label}
        </Text>
      )}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: Colors.surface2,
          borderRadius: 16,
          borderWidth: 1.5,
          borderColor: focused ? Colors.orange : error ? '#FF453A' : Colors.border,
          height: 52,
          paddingHorizontal: 16,
        }}
      >
        <TextInput
          style={[
            {
              flex: 1,
              color: Colors.text,
              fontSize: 16,
              fontFamily: 'DMSans-Regular',
            },
            style,
          ]}
          placeholderTextColor={Colors.muted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        {rightElement}
      </View>
      {error && (
        <Text
          style={{
            color: '#FF453A',
            fontSize: 12,
            fontFamily: 'DMSans-Regular',
          }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
