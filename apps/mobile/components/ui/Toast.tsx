import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore } from '@/stores/toastStore';
import { Colors } from '@/constants/colors';

const VISIBLE_MS = 3500;

/** Shows the latest toast at the top of the screen, then fades it out. */
export function Toast() {
  const { message, id, hide } = useToastStore();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return;
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => hide());
    }, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [id, message, opacity, hide]);

  if (!message) return null;
  return (
    <Animated.View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, opacity, zIndex: 1000 }}>
      <Pressable onPress={hide} accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ backgroundColor: Colors.surface3, borderRadius: 14, borderWidth: 1, borderColor: `${Colors.error}55`, paddingHorizontal: 16, paddingVertical: 12 }}>
        <Text style={{ color: Colors.text, fontFamily: 'DMSans-Medium', fontSize: 14 }}>{message}</Text>
      </Pressable>
    </Animated.View>
  );
}
