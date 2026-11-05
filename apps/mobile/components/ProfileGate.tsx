import { useEffect } from 'react';
import { router, useSegments } from 'expo-router';
import { useMe } from '@/hooks/useMe';
import { ageFromDOB } from '@/lib/tdee';
import { MIN_AGE } from '@/lib/safety';

/** Signed-in users who haven't given their age or answered the wellbeing question (e.g. after Google or Apple sign-in), or who are under 18. */
export function needsWelcomeCheck(me: { dateOfBirth: string | null; edScreen: string | null }) {
  return !me.dateOfBirth || !me.edScreen || ageFromDOB(me.dateOfBirth) < MIN_AGE;
}

/** Sends those users to the welcome check before the rest of the app. */
export function ProfileGate() {
  const { data: me } = useMe();
  const segments = useSegments();
  const here = segments[0];
  const exempt = here === 'welcome-check' || here === 'onboarding' || here === '(auth)' || here === 'auth-callback' || here === 'reset-password';

  useEffect(() => {
    if (me && !exempt && needsWelcomeCheck(me)) router.replace('/welcome-check');
  }, [me, exempt]);
  return null;
}
