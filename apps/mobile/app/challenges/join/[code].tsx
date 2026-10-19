import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useJoinChallenge } from '@/hooks/useChallenges';
import { Colors } from '@/constants/colors';

/** Opened by invite links: grit://challenges/join/<inviteCode> */
export default function JoinChallengeScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { mutateAsync: joinChallenge } = useJoinChallenge();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    joinChallenge(code)
      .then((participant) => router.replace(`/challenge/${participant.challengeId}`))
      .catch((err: any) => setError(err?.response?.data?.message ?? 'This invite link is not valid.'));
  }, [code, joinChallenge]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
      {error ? (
        <>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 18, textAlign: 'center' }}>
            Couldn't join this challenge
          </Text>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14, textAlign: 'center' }}>
            {error}
          </Text>
          <Pressable onPress={() => router.replace('/(tabs)/social')}>
            <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 15 }}>Go to challenges</Text>
          </Pressable>
        </>
      ) : (
        <View style={{ alignItems: 'center', gap: 12 }}>
          <ActivityIndicator color={Colors.orange} />
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular' }}>Joining challenge…</Text>
        </View>
      )}
    </SafeAreaView>
  );
}
