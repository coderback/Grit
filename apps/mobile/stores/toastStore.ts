import { create } from 'zustand';

interface ToastState {
  message: string | null;
  id: number;
  show: (message: string) => void;
  hide: () => void;
}

/** One short message at a time, e.g. when an action fails. */
export const useToastStore = create<ToastState>((set) => ({
  message: null,
  id: 0,
  show: (message) => set((s) => ({ message, id: s.id + 1 })),
  hide: () => set({ message: null }),
}));

export const showToast = (message: string) => useToastStore.getState().show(message);
