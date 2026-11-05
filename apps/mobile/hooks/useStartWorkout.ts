import { useCallback } from 'react';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useWorkoutStore, type NewExercise } from '@/stores/workoutStore';
import { confirmAction } from '@/lib/confirm';
import type { PlanDay } from '@/hooks/useWorkoutPlan';

const COMPOUND = new Set(['squat', 'hip_hinge', 'lunge', 'horizontal_press', 'vertical_press', 'horizontal_pull', 'vertical_pull', 'carry']);
export const isCompound = (pattern: string | null | undefined) => !!pattern && COMPOUND.has(pattern);

/**
 * Opens the workout screen with a plan session (or an empty workout). If a
 * workout is already in progress, offers to carry on with it instead.
 */
export function useStartWorkout() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useCallback(
    async (from?: { session: number; day: PlanDay }) => {
      if (!userId) return;
      const { active, start, discard } = useWorkoutStore.getState();
      if (active && active.ownerId === userId) {
        const carryOn = await confirmAction({
          title: 'Workout in progress',
          message: 'You have a workout going. Carry on with it, or start this one instead?',
          confirmLabel: 'Carry on',
        });
        if (carryOn) {
          router.push('/workout');
          return;
        }
        const replace = await confirmAction({
          title: 'Start a new workout?',
          message: "The one in progress will be discarded. Sets you've ticked won't be saved.",
          confirmLabel: 'Discard and start',
          destructive: true,
        });
        if (!replace) return;
        discard();
      }
      const exercises: NewExercise[] = (from?.day.exercises ?? [])
        .filter((e) => e.exerciseId)
        .map((e) => ({ exerciseId: e.exerciseId!, name: e.name, detail: e.detail || null }));
      start({
        ownerId: userId,
        planSession: from?.session ?? null,
        title: from?.day.title ?? null,
        exercises,
      });
      router.push('/workout');
    },
    [userId],
  );
}
