import { api } from '@/lib/api';
import { storage } from '@/lib/storage';
import { queryClient } from '@/lib/queryClient';
import { healthSource } from './source';
import { toImportPayload } from './transform';

const ENABLED_KEY = 'grit_health_enabled';
const LAST_KEY = 'grit_health_last_sync';
const MIN_GAP_MS = 15 * 60_000;
const FIRST_SYNC_DAYS = 14;
// Re-read a little before the last sync: the watch may upload late
const OVERLAP_MS = 2 * 86_400_000;

export async function isHealthSyncOn() {
  return (await storage.getItem(ENABLED_KEY).catch(() => null)) === '1';
}

export async function lastHealthSync(): Promise<Date | null> {
  const raw = await storage.getItem(LAST_KEY).catch(() => null);
  return raw ? new Date(raw) : null;
}

/** Asks the health app for access and turns syncing on. False if refused or unavailable. */
export async function connectHealth(): Promise<boolean> {
  if (!(await healthSource.isAvailable())) return false;
  if (!(await healthSource.requestAccess())) return false;
  await storage.setItem(ENABLED_KEY, '1');
  return true;
}

/** Stops syncing. What was already imported stays. */
export async function disconnectHealth() {
  await storage.removeItem(ENABLED_KEY);
  await storage.removeItem(LAST_KEY);
}

export interface SyncResult {
  workouts: { created: number; updated: number };
  days: number;
  weights: number;
}

let running: Promise<SyncResult> | null = null;

/**
 * Reads new data from the health app and sends it to GRIT. Runs at most
 * every 15 minutes unless forced, and never twice at once. Returns what the
 * backend stored, or null if it didn't run.
 */
export async function syncHealth({ force = false } = {}): Promise<SyncResult | null> {
  if (running) return running;
  if (!healthSource.id || !(await isHealthSyncOn())) return null;
  const last = await lastHealthSync();
  const now = new Date();
  if (!force && last && now.getTime() - last.getTime() < MIN_GAP_MS) return null;

  running = (async () => {
    const since = last
      ? new Date(last.getTime() - OVERLAP_MS)
      : new Date(now.getTime() - FIRST_SYNC_DAYS * 86_400_000);
    const data = await healthSource.read(since, now);
    const payload = toImportPayload(healthSource.id!, data, now);
    const { data: result } = await api.post('/health/import', payload);
    await storage.setItem(LAST_KEY, now.toISOString());
    for (const key of ['activity-week', 'activity-logs', 'trends', 'weight', 'me', 'challenges', 'health-recent', 'leaderboard-weekly']) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
    return result as SyncResult;
  })();
  try {
    return await running;
  } finally {
    running = null;
  }
}
