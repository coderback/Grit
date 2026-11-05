import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import type { PrKind } from '@/lib/strength';

/**
 * The workout in progress, kept on the phone so it survives the app closing
 * and works offline. Finishing moves it to `pending` until the backend has
 * it; a workout is only ever edited on one phone, so nothing needs merging.
 */

export interface DraftSet {
  id: string;
  reps: number | null;
  weightKg: number | null;
  durationSec: number | null;
  warmup: boolean;
  done: boolean;
  pr: PrKind | null;
}

export interface DraftExercise {
  key: string;
  exerciseId: string;
  name: string;
  /** The plan's "3 × 8–12", if it came from the plan */
  detail: string | null;
  compound: boolean;
  /** Exercises sharing one are a superset or circuit */
  supersetId: string | null;
  /** Set once the targets are in, so they're only filled in once */
  prefilled: boolean;
  sets: DraftSet[];
}

export interface ActiveWorkout {
  clientId: string;
  /** The Supabase user it belongs to */
  ownerId: string;
  startedAt: string;
  planSession: number | null;
  title: string | null;
  activityType: string;
  exercises: DraftExercise[];
}

export interface SaveWorkoutBody {
  clientId: string;
  planSession?: number;
  title?: string;
  activityType?: string;
  startedAt: string;
  endedAt: string;
  sets: {
    exerciseId: string;
    reps: number;
    weightKg?: number | null;
    durationSec?: number | null;
    warmup?: boolean;
    supersetId?: string | null;
  }[];
}

export interface PendingWorkout {
  ownerId: string;
  body: SaveWorkoutBody;
  /** Shown if saving keeps failing for a reason other than the connection */
  error?: string;
}

export interface Rest {
  endsAt: number;
  totalSec: number;
  label: string;
}

const newId = () => Crypto.randomUUID();

const blankSet = (prev?: Partial<DraftSet>): DraftSet => ({
  id: newId(),
  reps: prev?.reps ?? null,
  weightKg: prev?.weightKg ?? null,
  durationSec: prev?.durationSec ?? null,
  warmup: prev?.warmup ?? false,
  done: false,
  pr: null,
});

export interface NewExercise {
  exerciseId: string;
  name: string;
  detail?: string | null;
  compound?: boolean;
}

const toDraft = (e: NewExercise): DraftExercise => ({
  key: newId(),
  exerciseId: e.exerciseId,
  name: e.name,
  detail: e.detail ?? null,
  compound: e.compound ?? true,
  supersetId: null,
  prefilled: false,
  sets: [],
});

interface WorkoutState {
  active: ActiveWorkout | null;
  rest: Rest | null;
  pending: PendingWorkout[];
  start(w: { ownerId: string; planSession?: number | null; title?: string | null; activityType?: string; exercises: NewExercise[] }): void;
  discard(): void;
  setTitle(title: string): void;
  addExercise(e: NewExercise): void;
  removeExercise(key: string): void;
  swapExercise(key: string, e: NewExercise): void;
  moveExercise(key: string, by: -1 | 1): void;
  /** Links an exercise with the next one as a superset, or unlinks it */
  toggleSuperset(key: string): void;
  /** Fills in the planned sets once, from the targets or last time */
  prefill(key: string, sets: Partial<DraftSet>[]): void;
  addSet(key: string, warmup?: boolean): void;
  insertSets(key: string, sets: Partial<DraftSet>[], where: 'start' | 'end'): void;
  updateSet(key: string, setId: string, patch: Partial<DraftSet>): void;
  removeSet(key: string, setId: string): void;
  startRest(totalSec: number, label: string): void;
  extendRest(sec: number): void;
  clearRest(): void;
  /** Ends the workout and queues it for saving; returns what will be sent */
  finish(endedAt?: Date): SaveWorkoutBody | null;
  markSaved(clientId: string): void;
  markFailed(clientId: string, error: string): void;
}

const mapExercise = (s: WorkoutState, key: string, fn: (e: DraftExercise) => DraftExercise) =>
  s.active ? { active: { ...s.active, exercises: s.active.exercises.map((e) => (e.key === key ? fn(e) : e)) } } : {};

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      active: null,
      rest: null,
      pending: [],

      start: ({ ownerId, planSession, title, activityType, exercises }) =>
        set({
          active: {
            clientId: newId(),
            ownerId,
            startedAt: new Date().toISOString(),
            planSession: planSession ?? null,
            title: title ?? null,
            activityType: activityType ?? 'strength_training',
            exercises: exercises.map(toDraft),
          },
          rest: null,
        }),
      discard: () => set({ active: null, rest: null }),
      setTitle: (title) => set((s) => (s.active ? { active: { ...s.active, title } } : {})),

      addExercise: (e) =>
        set((s) => (s.active ? { active: { ...s.active, exercises: [...s.active.exercises, toDraft(e)] } } : {})),
      removeExercise: (key) =>
        set((s) => (s.active ? { active: { ...s.active, exercises: s.active.exercises.filter((e) => e.key !== key) } } : {})),
      swapExercise: (key, e) =>
        set((s) =>
          mapExercise(s, key, (old) => ({
            ...toDraft({ ...e, detail: e.detail ?? old.detail }),
            key: old.key,
            supersetId: old.supersetId,
            // Done sets stay with the exercise they were done on
            sets: old.sets.filter((x) => !x.done).map((x) => ({ ...x, weightKg: null, pr: null })),
          })),
        ),
      moveExercise: (key, by) =>
        set((s) => {
          if (!s.active) return {};
          const list = [...s.active.exercises];
          const i = list.findIndex((e) => e.key === key);
          const j = i + by;
          if (i < 0 || j < 0 || j >= list.length) return {};
          [list[i], list[j]] = [list[j], list[i]];
          return { active: { ...s.active, exercises: list } };
        }),
      toggleSuperset: (key) =>
        set((s) => {
          if (!s.active) return {};
          const list = [...s.active.exercises];
          const i = list.findIndex((e) => e.key === key);
          const next = list[i + 1];
          if (i < 0) return {};
          if (list[i].supersetId) {
            const id = list[i].supersetId;
            const left = list.filter((e) => e.supersetId === id);
            // Unlink this one; a superset of one isn't a superset
            list[i] = { ...list[i], supersetId: null };
            if (left.length <= 2) for (let k = 0; k < list.length; k++) if (list[k].supersetId === id) list[k] = { ...list[k], supersetId: null };
          } else if (next) {
            const id = next.supersetId ?? newId().slice(0, 8);
            list[i] = { ...list[i], supersetId: id };
            list[i + 1] = { ...next, supersetId: id };
          }
          return { active: { ...s.active, exercises: list } };
        }),

      prefill: (key, sets) =>
        set((s) => mapExercise(s, key, (e) => (e.prefilled ? e : { ...e, prefilled: true, sets: e.sets.length ? e.sets : sets.map((x) => blankSet(x)) }))),
      addSet: (key, warmup = false) =>
        set((s) =>
          mapExercise(s, key, (e) => {
            const last = [...e.sets].reverse().find((x) => x.warmup === warmup) ?? e.sets[e.sets.length - 1];
            const added = blankSet({ ...last, warmup });
            return { ...e, sets: warmup ? [...e.sets.filter((x) => x.warmup), added, ...e.sets.filter((x) => !x.warmup)] : [...e.sets, added] };
          }),
        ),
      insertSets: (key, sets, where) =>
        set((s) =>
          mapExercise(s, key, (e) => {
            const added = sets.map((x) => ({ ...blankSet(x), done: x.done ?? false }));
            return { ...e, prefilled: true, sets: where === 'start' ? [...added, ...e.sets] : [...e.sets, ...added] };
          }),
        ),
      updateSet: (key, setId, patch) =>
        set((s) => mapExercise(s, key, (e) => ({ ...e, sets: e.sets.map((x) => (x.id === setId ? { ...x, ...patch } : x)) }))),
      removeSet: (key, setId) => set((s) => mapExercise(s, key, (e) => ({ ...e, sets: e.sets.filter((x) => x.id !== setId) }))),

      startRest: (totalSec, label) => set({ rest: totalSec > 0 ? { endsAt: Date.now() + totalSec * 1000, totalSec, label } : null }),
      extendRest: (sec) => set((s) => (s.rest ? { rest: { ...s.rest, endsAt: s.rest.endsAt + sec * 1000, totalSec: s.rest.totalSec + sec } } : {})),
      clearRest: () => set({ rest: null }),

      finish: (endedAt = new Date()) => {
        const a = get().active;
        if (!a) return null;
        const sets = a.exercises.flatMap((e) =>
          e.sets
            .filter((x) => x.done && ((x.reps ?? 0) > 0 || (x.durationSec ?? 0) > 0))
            .map((x) => ({
              exerciseId: e.exerciseId,
              reps: x.durationSec ? 0 : x.reps ?? 0,
              weightKg: x.weightKg && x.weightKg > 0 ? x.weightKg : null,
              durationSec: x.durationSec ?? null,
              warmup: x.warmup,
              supersetId: e.supersetId,
            })),
        );
        const body: SaveWorkoutBody = {
          clientId: a.clientId,
          ...(a.planSession ? { planSession: a.planSession } : {}),
          ...(a.title?.trim() ? { title: a.title.trim().slice(0, 60) } : {}),
          activityType: a.activityType,
          startedAt: a.startedAt,
          // Never in the future, even if the phone's clock moved
          endedAt: new Date(Math.max(new Date(a.startedAt).getTime(), Math.min(endedAt.getTime(), Date.now()))).toISOString(),
          sets,
        };
        set((s) => ({ active: null, rest: null, pending: [...s.pending.filter((p) => p.body.clientId !== a.clientId), { ownerId: a.ownerId, body }] }));
        return body;
      },
      markSaved: (clientId) => set((s) => ({ pending: s.pending.filter((p) => p.body.clientId !== clientId) })),
      markFailed: (clientId, error) =>
        set((s) => ({ pending: s.pending.map((p) => (p.body.clientId === clientId ? { ...p, error } : p)) })),
    }),
    {
      name: 'grit-workout',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ active: s.active, rest: s.rest, pending: s.pending }),
    },
  ),
);
