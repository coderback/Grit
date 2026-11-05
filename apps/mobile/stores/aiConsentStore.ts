import { create } from 'zustand';

interface AiConsentState {
  /** Set while the consent sheet is open; called with the user's answer */
  resolve: ((granted: boolean) => void) | null;
  ask: () => Promise<boolean>;
  answer: (granted: boolean) => void;
}

/** Opens the AI consent sheet (mounted once in the root layout) and waits for the answer. */
export const useAiConsentStore = create<AiConsentState>((set, get) => ({
  resolve: null,
  ask: () =>
    new Promise<boolean>((resolve) => {
      get().resolve?.(false); // a sheet already open counts as declined
      set({ resolve });
    }),
  answer: (granted) => {
    get().resolve?.(granted);
    set({ resolve: null });
  },
}));
