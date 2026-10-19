import * as Linking from 'expo-linking';
import { supabase } from './supabase';

/**
 * Emails a password reset link. The link opens the app's reset-password
 * screen (grit://reset-password in builds, the dev server URL in Expo Go and
 * on web). That URL must be in Supabase Auth's list of redirect URLs.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: Linking.createURL('reset-password'),
  });
  if (error) throw error;
}
