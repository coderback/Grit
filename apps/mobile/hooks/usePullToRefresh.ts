import { useCallback, useRef, useState } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';

/**
 * Pull-to-refresh state for a screen: refetches the given queries and keeps
 * the spinner up until they have all finished.
 */
export function usePullToRefresh(queryKeys: QueryKey[]) {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  // Callers pass a fresh array each render; read the latest without re-creating onRefresh
  const keys = useRef(queryKeys);
  keys.current = queryKeys;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all(
        keys.current.map((queryKey) => qc.invalidateQueries({ queryKey })),
      );
    } finally {
      setRefreshing(false);
    }
  }, [qc]);

  return { refreshing, onRefresh };
}
