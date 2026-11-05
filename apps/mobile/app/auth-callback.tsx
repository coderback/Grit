import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { Colors } from '@/constants/colors';
import { completeFromUrl } from '@/lib/socialAuth';
import { afterSignIn } from '@/lib/postSignIn';
import { Button } from '@/components/ui/Button';

/**
 * Where Google or Apple sign-in returns on web (and on phones if the app is
 * opened from the link). Exchanges the code for a session, then carries on.
 */
export default function AuthCallbackScreen() {
  const url = Linking.useURL();
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    completeFromUrl(url)
      .then(async (session) => {
        await afterSignIn(session);
        router.replace('/(tabs)/');
      })
      .catch((err: Error) => setProblem(err.message));
  }, [url]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.dark, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
      {problem ? (
        <>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 18, textAlign: 'center' }}>Couldn't sign you in</Text>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14, textAlign: 'center' }}>{problem}</Text>
          <Button label="Back to log in" onPress={() => router.replace('/(auth)/login')} />
        </>
      ) : (
        <>
          <ActivityIndicator color={Colors.orange} />
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 14 }}>Signing you in…</Text>
        </>
      )}
    </View>
  );
}
