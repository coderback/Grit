import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogFoodSheet } from '@/components/food/LogFoodSheet';
import { SAMPLE_FOODS } from '@/lib/demo/backend';
import { Colors } from '@/constants/colors';

/** Replaces the camera view on the web. Picks a sample product, then uses the real logging sheet. */
export function DemoScanner() {
  const [picked, setPicked] = useState<(typeof SAMPLE_FOODS)[number] | null>(null);
  const samples = SAMPLE_FOODS.filter((f) => f.barcode);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark }}>
      <View style={{ flex: 1, padding: 24, gap: 16 }}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 15 }}>← Back</Text>
        </Pressable>
        <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 24 }}>Barcode scanner</Text>
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 15, lineHeight: 22 }}>
          The camera scanner runs in the native app. Choose a sample product to continue from the point after a scan.
        </Text>
        {samples.map((f) => (
          <Pressable
            key={f.barcode}
            accessibilityRole="button"
            onPress={() => setPicked(f)}
            style={{ backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 14 }}
          >
            <Text style={{ color: Colors.text, fontFamily: 'DMSans-Medium', fontSize: 15 }}>{f.name}</Text>
            <Text style={{ color: Colors.muted, fontFamily: 'JetBrainsMono-Regular', fontSize: 12, marginTop: 2 }}>{f.barcode}</Text>
          </Pressable>
        ))}
      </View>
      {picked && (
        <LogFoodSheet
          food={picked}
          onClose={() => {
            setPicked(null);
            router.back();
          }}
        />
      )}
    </SafeAreaView>
  );
}
