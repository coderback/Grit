import { useSyncExternalStore } from 'react';
import { onlineManager } from '@tanstack/react-query';

const subscribe = (cb: () => void) => onlineManager.subscribe(cb);
const isOnline = () => onlineManager.isOnline();

/** Whether the phone is online, as React Query sees it. */
export function useOnlineManager() {
  return useSyncExternalStore(subscribe, isOnline, isOnline);
}
