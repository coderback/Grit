import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { removeAvatarFile } from '@/lib/avatar';

/**
 * Permanently deletes the signed-in account and its data, then clears the
 * local session (the sign-in itself no longer exists).
 */
export async function deleteAccount(avatarUrl: string | null | undefined) {
  // While still signed in: storage only lets the owner delete their photo
  const authId = (await supabase.auth.getUser()).data.user?.id;
  if (authId && avatarUrl) await removeAvatarFile(authId).catch(() => {});
  await api.delete('/users/me');
  await supabase.auth.signOut({ scope: 'local' });
}
