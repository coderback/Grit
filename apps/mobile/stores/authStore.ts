import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { Session, User } from '@supabase/supabase-js';

const ONBOARDING_KEY = 'grit_onboarding_complete';

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  onboardingComplete: boolean;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  clearSession: () => void;
  setOnboardingComplete: () => Promise<void>;
  loadOnboardingState: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isLoading: true,
  onboardingComplete: false,
  setSession: (session) =>
    set({ session, user: session?.user ?? null, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  clearSession: () => set({ session: null, user: null, isLoading: false }),
  setOnboardingComplete: async () => {
    await SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
    set({ onboardingComplete: true });
  },
  loadOnboardingState: async () => {
    const val = await SecureStore.getItemAsync(ONBOARDING_KEY);
    set({ onboardingComplete: val === 'true' });
  },
}));
