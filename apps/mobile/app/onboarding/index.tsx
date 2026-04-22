import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router, Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark }}>
      <View style={{ flex: 1, paddingHorizontal: 28, justifyContent: 'space-between', paddingTop: 60, paddingBottom: 40 }}>

        {/* Top content */}
        <View style={{ gap: 24 }}>
          <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 40, letterSpacing: -1.5 }}>
            GRIT
          </Text>

          <View style={{ gap: 12 }}>
            <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 34, letterSpacing: -0.8, lineHeight: 40 }}>
              Build your custom{'\n'}fitness & nutrition{'\n'}plan in 60 seconds.
            </Text>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 16, lineHeight: 24 }}>
              Personalised to your body, goals, and lifestyle.
            </Text>
          </View>

          {/* Feature pills */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {['Calorie tracking', 'Macro splits', 'Progress timeline', 'AI coaching'].map((label) => (
              <View
                key={label}
                style={{
                  backgroundColor: Colors.surface2,
                  borderRadius: 999,
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              >
                <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 13 }}>
                  {label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* CTA */}
        <View style={{ gap: 12 }}>
          <Pressable
            onPress={() => router.push('/onboarding/basics')}
            style={({ pressed }) => ({
              backgroundColor: Colors.orange,
              borderRadius: 999,
              paddingVertical: 18,
              alignItems: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 17 }}>
              Get started →
            </Text>
          </Pressable>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14 }}>
              Already have an account?
            </Text>
            <Link href="/(auth)/login" asChild>
              <Pressable>
                <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 14 }}>
                  Sign in
                </Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
