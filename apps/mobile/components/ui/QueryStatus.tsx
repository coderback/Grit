import React from 'react';
import { View, Text, Pressable } from 'react-native';
import type { UseQueryResult } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';

type AnyQuery = Pick<UseQueryResult<unknown>, 'isLoading' | 'isError' | 'data' | 'refetch'>;

/** Combined state of the queries a screen depends on. */
export function useQueriesStatus(...queries: AnyQuery[]) {
  return {
    // First load: nothing to show yet
    isLoading: queries.some((q) => q.isLoading),
    isError: queries.some((q) => q.isError),
    // Failed with nothing cached, so the screen would only show zeros
    isBlocked: queries.some((q) => q.isError && q.data === undefined),
    retry: () => queries.filter((q) => q.isError).forEach((q) => q.refetch()),
  };
}

/** Error card with a retry button, or a slim banner when older data is still on screen. */
export function ErrorNotice({ onRetry, compact, what = 'this' }: { onRetry: () => void; compact?: boolean; what?: string }) {
  if (compact) {
    return (
      <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: `${Colors.error}14`, borderRadius: 12, borderWidth: 1, borderColor: `${Colors.error}40`, paddingHorizontal: 14, paddingVertical: 10 }}>
        <Text style={{ flex: 1, color: Colors.text, fontFamily: 'DMSans-Regular', fontSize: 13 }}>Couldn't refresh. Showing saved data.</Text>
        <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button">
          <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 13 }}>Retry</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, padding: 24, alignItems: 'center', gap: 10 }}>
      <Text style={{ fontSize: 32 }}>📡</Text>
      <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 16 }}>Couldn't load {what}</Text>
      <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13, textAlign: 'center' }}>Check your connection and try again.</Text>
      <Pressable onPress={onRetry} accessibilityRole="button" style={({ pressed }) => ({ marginTop: 4, backgroundColor: Colors.orange, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 10, opacity: pressed ? 0.85 : 1 })}>
        <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 14 }}>Try again</Text>
      </Pressable>
    </View>
  );
}
