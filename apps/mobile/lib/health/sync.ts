import { api } from '@/lib/api';
import { storage } from '@/lib/storage';
import { queryClient } from '@/lib/queryClient';
import { healthSource } from './source';
import { toImportPayload } from './transform';
import type { FoodEntry } from './types';

const ENABLED_KEY = 'grit_health_enabled';
const LAST_KEY = 'grit_health_last_sync';
const WRITE_FOOD_KEY = 'grit_health_write_food';
// Bumped when GRIT reads new kinds of data, so people who connected before
// are asked once for the new ones (Phase 6: heart rate, HRV, recovery)
const PERMISSIONS_KEY = 'grit_health_permissions';
const PERMISSIONS_VERSION = '2';
const MIN_GAP_MS = 15 * 60_000;
// The backend takes up to about two months
const FIRST_SYNC_DAYS = 60;
// Re-read a little before the last sync: the watch may upload late
const OVERLAP_MS = 2 * 86_400_000;

export async function isHealthSyncOn() {
  return (await storage.getItem(ENABLED_KEY).catch(() => null)) === '1';
}

export async function lastHealthSync(): Promise<Date | null> {
  const raw = await storage.getItem(LAST_KEY).catch(() => null);
  return raw ? new Date(raw) : null;
}

/** Whether menstrual data may be read: the user's separate consent in GRIT. */
function cycleAllowed() {
  return !!queryClient.getQueryData<{ consentCycleData?: boolean }>(['me'])?.consentCycleData;
}

export async function isFoodWriteOn() {
  return (await storage.getItem(WRITE_FOOD_KEY).catch(() => null)) === '1';
}

async function access(extra: { cycle?: boolean; writeFood?: boolean } = {}) {
  return healthSource.requestAccess({
    cycle: extra.cycle ?? cycleAllowed(),
    writeFood: extra.writeFood ?? (await isFoodWriteOn()),
  });
}

/** Asks the health app for access and turns syncing on. False if refused or unavailable. */
export async function connectHealth(): Promise<boolean> {
  if (!(await healthSource.isAvailable())) return false;
  if (!(await access())) return false;
  await storage.setItem(ENABLED_KEY, '1');
  await storage.setItem(PERMISSIONS_KEY, PERMISSIONS_VERSION);
  return true;
}

/** Asks again with menstrual data included, after the user turns on cycle consent. */
export async function requestCycleAccess() {
  if (!(await isHealthSyncOn())) return false;
  return access({ cycle: true });
}

/** Turns writing logged meals to the health app on (asking for permission) or off. */
export async function setFoodWrite(on: boolean): Promise<boolean> {
  if (!on) {
    await storage.removeItem(WRITE_FOOD_KEY);
    return true;
  }
  if (!(await access({ writeFood: true }))) return false;
  await storage.setItem(WRITE_FOOD_KEY, '1');
  return true;
}

/** Stops syncing. What was already imported stays. */
export async function disconnectHealth() {
  await storage.removeItem(ENABLED_KEY);
  await storage.removeItem(LAST_KEY);
  await storage.removeItem(WRITE_FOOD_KEY);
}

type LoggedFood = { id: string; name: string; loggedAt: string; calories: number; proteinG: number; carbsG: number; fatG: number; caffeineMg?: number | null; mealType?: string | null };

const toEntry = (f: LoggedFood): FoodEntry => ({ ...f, loggedAt: new Date(f.loggedAt) });

async function writingFood() {
  return !!healthSource.id && (await isHealthSyncOn()) && (await isFoodWriteOn());
}

/** Writes newly logged meals to the health app, if that's on. Never throws. */
export async function writeFoodsToHealth(foods: LoggedFood[]) {
  if (!foods.length || !(await writingFood())) return;
  for (const f of foods) await healthSource.writeFood(toEntry(f)).catch(() => undefined);
}

/** Replaces a meal GRIT wrote after it's edited. Never throws. */
export async function updateFoodInHealth(food: LoggedFood) {
  if (!(await writingFood())) return;
  await healthSource.deleteFood(food.id).catch(() => undefined);
  await healthSource.writeFood(toEntry(food)).catch(() => undefined);
}

/** Removes a meal GRIT wrote after it's deleted. Never throws. */
export async function deleteFoodFromHealth(id: string) {
  if (!(await writingFood())) return;
  await healthSource.deleteFood(id).catch(() => undefined);
}

export interface SyncResult {
  workouts: { created: number; updated: number };
  days: number;
  weights: number;
  metrics: { stored: number; skipped: number };
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
    if ((await storage.getItem(PERMISSIONS_KEY).catch(() => null)) !== PERMISSIONS_VERSION) {
      // Only shows the kinds of data not asked about before
      await access().catch(() => false);
      await storage.setItem(PERMISSIONS_KEY, PERMISSIONS_VERSION);
    }
    const since = last
      ? new Date(last.getTime() - OVERLAP_MS)
      : new Date(now.getTime() - FIRST_SYNC_DAYS * 86_400_000);
    const data = await healthSource.read(since, now, { cycle: cycleAllowed() });
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
