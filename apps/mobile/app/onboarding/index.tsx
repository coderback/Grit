import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark }}>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingVertical: 16, justifyContent: 'center', gap: 32 }}>
        <View style={{ gap: 12 }}>
          <Text
            style={{
              color: Colors.orange,
              fontFamily: 'DMSans-Bold',
              fontSize: 56,
              letterSpacing: -2,
            }}
          >
            GRIT
          </Text>
          <Text
            style={{
              color: Colors.text,
              fontFamily: 'DMSans-Bold',
              fontSize: 30,
              letterSpacing: -0.5,
              lineHeight: 36,
            }}
          >
            Track your nutrition.{'\n'}Hit your goals.
          </Text>
          <Text
            style={{
              color: Colors.muted,
              fontFamily: 'DMSans-Regular',
              fontSize: 16,
              lineHeight: 24,
            }}
          >
            Set a daily calorie target and start logging your food today.
          </Text>
        </View>

        <Pressable
          onPress={() => router.push('/onboarding/setup')}
          style={({ pressed }) => ({
            backgroundColor: Colors.orange,
            borderRadius: 999,
            paddingVertical: 16,
            alignItems: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 17 }}>
            Get started →
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
