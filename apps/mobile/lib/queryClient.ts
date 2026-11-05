import { AppState, Platform } from 'react-native';
import { focusManager, MutationCache, onlineManager, QueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { showToast } from '@/stores/toastStore';

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      /** Shown as a toast if the mutation fails and the caller doesn't handle it */
      errorMessage?: string;
    };
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 2,
      // Offline, queries pause and keep showing what's cached, then refetch
      // on reconnect (the default 'online' mode)
    },
    mutations: {
      // Saving fails straight away when offline, so a sheet doesn't spin
      // until the connection returns; the offline banner explains why
      networkMode: 'always',
    },
  },
  mutationCache: new MutationCache({
    onError: (_error, _vars, _context, mutation) => {
      if (mutation.meta?.errorMessage) showToast(mutation.meta.errorMessage);
    },
  }),
});

// Refetch stale data when the app comes back to the foreground. React Query
// only knows about window focus on web.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (status) => focusManager.setFocused(status === 'active'));
}

// React Query follows the browser's online/offline events on web; phones need
// NetInfo. Only the connection itself counts: the reachability probe fetches a
// Google URL, which some networks block, and would then report offline for
// good. null means "not checked yet", which isn't offline.
if (Platform.OS !== 'web') {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)),
  );
}
