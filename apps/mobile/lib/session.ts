import { supabase } from '@/lib/supabase';
import { unregisterPushDevice } from '@/hooks/usePushNotifications';

/**
 * Signs out, first removing this phone from the account's push devices so it
 * stops getting that account's alerts. The auth listener in the root layout
 * then clears cached data and redirects.
 */
export async function signOut() {
  await unregisterPushDevice().catch(() => {});
  await supabase.auth.signOut();
}
