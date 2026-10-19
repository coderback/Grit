import { useEffect } from 'react';
import { create } from 'zustand';

interface UIState {
  // Bottom sheets currently open; the floating tab bar hides while any are
  openSheets: number;
  sheetOpened: () => void;
  sheetClosed: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  openSheets: 0,
  sheetOpened: () => set((s) => ({ openSheets: s.openSheets + 1 })),
  sheetClosed: () => set((s) => ({ openSheets: Math.max(0, s.openSheets - 1) })),
}));

/**
 * Hides the floating tab bar while `open` is true. The tab bar floats over
 * the screen, so it would otherwise cover the bottom of a sheet and its
 * action button.
 */
export function useHideTabBar(open = true) {
  const sheetOpened = useUIStore((s) => s.sheetOpened);
  const sheetClosed = useUIStore((s) => s.sheetClosed);
  useEffect(() => {
    if (!open) return;
    sheetOpened();
    return sheetClosed;
  }, [open, sheetOpened, sheetClosed]);
}
