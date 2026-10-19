import { create } from 'zustand';
import { storage } from '@/lib/storage';
import type { Session, User } from '@supabase/supabase-js';

const ONBOARDING_KEY = 'grit_onboarding_complete';

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  onboardingLoading: boolean;
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
  onboardingLoading: true,
  onboardingComplete: false,
  setSession: (session) =>
    set({ session, user: session?.user ?? null, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  clearSession: () => set({ session: null, user: null, isLoading: false }),
  setOnboardingComplete: async () => {
    await storage.setItem(ONBOARDING_KEY, 'true');
    set({ onboardingComplete: true });
  },
  loadOnboardingState: async () => {
    const val = await storage.getItem(ONBOARDING_KEY);
    set({ onboardingComplete: val === 'true', onboardingLoading: false });
  },
}));
