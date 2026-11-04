import { create } from 'zustand';

export type ToastKind = 'error' | 'info';

interface ToastState {
  message: string | null;
  kind: ToastKind;
  id: number;
  show: (message: string, kind?: ToastKind) => void;
  hide: () => void;
}

/** One short message at a time: a failed action (the default) or a confirmation. */
export const useToastStore = create<ToastState>((set) => ({
  message: null,
  kind: 'error',
  id: 0,
  show: (message, kind = 'error') => set((s) => ({ message, kind, id: s.id + 1 })),
  hide: () => set({ message: null }),
}));

export const showToast = (message: string, kind?: ToastKind) => useToastStore.getState().show(message, kind);
