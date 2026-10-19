import { AppState, Platform } from 'react-native';
import { focusManager, MutationCache, QueryClient } from '@tanstack/react-query';
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
