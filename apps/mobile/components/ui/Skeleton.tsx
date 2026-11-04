import React, { useEffect, useRef } from 'react';
import { Animated, View, type DimensionValue } from 'react-native';
import { Colors } from '@/constants/colors';

/** A pulsing placeholder block shown while data loads. */
export function Skeleton({ width = '100%', height = 16, radius = 8 }: { width?: DimensionValue; height?: number; radius?: number }) {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={{ width, height, borderRadius: radius, backgroundColor: Colors.surface2, opacity }} />;
}

/** Placeholder cards for a screen's first load. */
export function ScreenSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <View style={{ gap: 14 }} accessibilityLabel="Loading" accessibilityRole="progressbar">
      {Array.from({ length: cards }, (_, i) => (
        <View key={i} style={{ backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, padding: 18, gap: 12 }}>
          <Skeleton width="40%" height={14} />
          <Skeleton height={i === 0 ? 90 : 44} radius={12} />
          <Skeleton width="70%" height={12} />
        </View>
      ))}
    </View>
  );
}
