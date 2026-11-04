import type { Session } from '@supabase/supabase-js';
import { api } from './api';
import { syncOnboardingProfile } from './onboardingProfile';
import { useAuthStore } from '@/stores/authStore';

/**
 * Everything that follows a successful sign-in, by any method: create the
 * backend user (named from the account where the provider gave a name) and
 * save any onboarding answers given before signing up.
 */
export async function afterSignIn(session: Session | null) {
  await useAuthStore.getState().setOnboardingComplete();
  const meta = (session?.user.user_metadata ?? {}) as Record<string, unknown>;
  const name = [meta.full_name, meta.name].find((v): v is string => typeof v === 'string' && v.trim() !== '');
  await api.post('/auth/sync', name ? { displayName: name.trim().slice(0, 50) } : {});
  // Kept on the device and retried at the next sign-in if this fails
  await syncOnboardingProfile().catch(() => {});
}
