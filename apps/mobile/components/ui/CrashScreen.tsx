import React, { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';
import { reportCrash } from '@/lib/crashReporter';
import { Colors } from '@/constants/colors';

/**
 * Shown instead of a blank screen when a screen crashes. The crash is
 * reported, and Try again re-renders the screen.
 */
export function CrashScreen({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    reportCrash(error);
  }, [error]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.dark, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
      <Text style={{ fontSize: 44 }}>😵</Text>
      <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 20, textAlign: 'center' }}>
        Something went wrong
      </Text>
      <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
        This screen hit an error. We've been told about it. Your data is safe.
      </Text>
      <Pressable
        onPress={() => retry()}
        accessibilityRole="button"
        style={({ pressed }) => ({ marginTop: 8, backgroundColor: Colors.orange, borderRadius: 999, paddingHorizontal: 28, paddingVertical: 13, opacity: pressed ? 0.85 : 1 })}
      >
        <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 15 }}>Try again</Text>
      </Pressable>
    </View>
  );
}
