import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { syncHealth } from '@/lib/health/sync';

/** Syncs the health app when the app opens and whenever it comes back to the foreground. */
export function useHealthSync(signedIn: boolean) {
  useEffect(() => {
    if (!signedIn || Platform.OS === 'web') return;
    syncHealth().catch(() => {});
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncHealth().catch(() => {});
    });
    return () => sub.remove();
  }, [signedIn]);
}
