import React from 'react';
import { View, Text, Linking, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { Colors } from '@/constants/colors';

const GITHUB_URL = 'https://github.com/coderback/Grit';

function Banner() {
  return (
    <View
      style={{ backgroundColor: Colors.surface3, paddingVertical: 6, paddingHorizontal: 12 }}
    >
      <Text style={{ color: Colors.text, fontFamily: 'DMSans-Medium', fontSize: 12, textAlign: 'center' }}>
        Demo mode: fictional data, kept in this tab. No account, backend or AI calls.
      </Text>
    </View>
  );
}

const POINTS = [
  'The real Expo Router screens from the mobile app, exported for the web.',
  'A local stand-in replaces the NestJS API and Supabase, so everything you log stays in this tab until you reload.',
  'Coach replies are saved samples. The real app streams them from an AI model through the backend.',
  'Camera scanning, push notifications and health sync need the native build, so they are off here.',
];

/** On wide screens, shows the app at phone width with notes beside it. On phones, it fills the screen. */
export function DemoFrame({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();

  if (width < 760) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.dark }}>
        <Banner />
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#050505', justifyContent: 'center', gap: 48, padding: 20 }}>
      <View style={{ width: 410, maxWidth: 410, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.dark }}>
        <Banner />
        <View style={{ flex: 1 }}>{children}</View>
      </View>
      <ScrollView style={{ maxWidth: 400, flexGrow: 0 }} contentContainerStyle={{ gap: 16, flexGrow: 1, justifyContent: 'center' }}>
        <Text accessibilityRole="header" style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 44, letterSpacing: -1.5 }}>
          GRIT
        </Text>
        <Text style={{ color: Colors.text, fontFamily: 'DMSans-Medium', fontSize: 18, lineHeight: 26 }}>
          A fitness and nutrition tracker for iOS and Android: macros, habits, workouts, social challenges and a coach.
        </Text>
        {POINTS.map((p) => (
          <Text key={p} style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14, lineHeight: 21 }}>
            {p}
          </Text>
        ))}
        <Pressable accessibilityRole="link" onPress={() => Linking.openURL(GITHUB_URL)}>
          <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 15 }}>View the code on GitHub</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
