import { create } from 'zustand';
import { storage } from '@/lib/storage';

export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'grit_theme';

interface ThemeState {
  preference: ThemePreference;
  loaded: boolean;
  load: () => Promise<void>;
  setPreference: (p: ThemePreference) => void;
}

/** Light, dark, or follow the phone. Saved on the device. */
export const useThemeStore = create<ThemeState>((set) => ({
  preference: 'system',
  loaded: false,
  load: async () => {
    const saved = await storage.getItem(KEY).catch(() => null);
    set({
      preference: saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system',
      loaded: true,
    });
  },
  setPreference: (preference) => {
    set({ preference });
    storage.setItem(KEY, preference).catch(() => {});
  },
}));
