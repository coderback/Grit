import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { Query } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { useWorkoutStore, type SaveWorkoutBody } from '@/stores/workoutStore';

/**
 * Saving finished workouts, online or not. Each finished workout waits in
 * the workout store's `pending` list until the backend has it. Sending is a
 * React Query mutation that pauses while offline; paused mutations are
 * persisted with the query cache, so they carry on after the app restarts.
 * The backend keys workouts on clientId, so sending one twice is harmless.
 */

export const SAVE_WORKOUT = ['save-workout'] as const;

// Queries kept on the phone, so a workout can start offline from a cold start
const PERSISTED_QUERIES = new Set(['workout-plan', 'workout-prepare', 'exercise']);

const isRetryable = (err: any) => !err?.response || err.response.status >= 500 || err.response.status === 429;

queryClient.setMutationDefaults(SAVE_WORKOUT, {
  mutationFn: (body: SaveWorkoutBody) => api.post('/workouts', body).then((r) => r.data),
  // Pause while offline instead of failing straight away
  networkMode: 'online',
  retry: (count, err) => count < 4 && isRetryable(err),
  retryDelay: (n) => Math.min(30_000, 2000 * 2 ** n),
  onSuccess: (_saved, body: SaveWorkoutBody) => {
    useWorkoutStore.getState().markSaved(body.clientId);
    for (const key of ['activity-logs', 'activity-week', 'workouts', 'workout-plan', 'workout-history', 'workout-prepare', 'feed', 'challenges', 'trends']) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  },
  onError: (err: any, body: SaveWorkoutBody) => {
    if (!isRetryable(err)) {
      useWorkoutStore.getState().markFailed(body.clientId, err?.response?.data?.message?.toString() ?? "Couldn't save this workout");
    }
  },
});

/** Sends a finished workout; resolves when saved (which may be after reconnecting). */
export function sendWorkout(body: SaveWorkoutBody) {
  const inFlight = queryClient
    .getMutationCache()
    .findAll({ mutationKey: SAVE_WORKOUT })
    .find((m) => (m.state.variables as SaveWorkoutBody | undefined)?.clientId === body.clientId && m.state.status !== 'error' && m.state.status !== 'success');
  if (inFlight) return;
  return queryClient
    .getMutationCache()
    .build(queryClient, { mutationKey: SAVE_WORKOUT })
    .execute(body)
    .catch(() => undefined);
}

/** Resolves once the workout store has loaded from the phone. */
function storeLoaded() {
  if (useWorkoutStore.persist.hasHydrated()) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const off = useWorkoutStore.persist.onFinishHydration(() => {
      off();
      resolve();
    });
  });
}

/** Re-sends this user's waiting workouts that nothing is sending yet. */
export async function flushPendingWorkouts() {
  await storeLoaded();
  const { data } = await supabase.auth.getSession();
  const me = data.session?.user.id;
  if (!me) return;
  await queryClient.resumePausedMutations().catch(() => undefined);
  for (const p of useWorkoutStore.getState().pending) {
    if (p.ownerId === me && !p.error) sendWorkout(p.body);
  }
}

/** Tries a workout that failed again. */
export function retryWorkout(clientId: string) {
  const store = useWorkoutStore.getState();
  const p = store.pending.find((x) => x.body.clientId === clientId);
  if (!p) return;
  useWorkoutStore.setState({ pending: store.pending.map((x) => (x.body.clientId === clientId ? { ...x, error: undefined } : x)) });
  sendWorkout(p.body);
}

export const queryPersister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'grit-query-cache' });

export const persistOptions = {
  persister: queryPersister,
  maxAge: 7 * 86_400_000,
  buster: 'workouts-1',
  dehydrateOptions: {
    shouldDehydrateQuery: (q: Query) => q.state.status === 'success' && PERSISTED_QUERIES.has(String(q.queryKey[0])),
    // The default: paused mutations, i.e. workouts waiting for a connection
    shouldDehydrateMutation: (m: { state: { isPaused: boolean } }) => m.state.isPaused,
  },
};
