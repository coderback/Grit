import type { Challenge } from '@/hooks/useChallenges';

const UNITS: Record<string, [string, string]> = {
  steps: ['step', 'steps'],
  group_steps: ['step', 'steps'],
  active_minutes: ['min', 'min'],
  workouts: ['workout', 'workouts'],
};

/** "12,400 steps", "95 min", "1 workout" */
export function amount(type: string, n: number): string {
  const [one, many] = UNITS[type] ?? UNITS.steps;
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

/** Short name of what counts, for labels like "My steps". */
export function measureName(type: string): string {
  return type === 'active_minutes' ? 'active minutes' : type === 'workouts' ? 'workouts' : 'steps';
}

export function hasEnded(c: Pick<Challenge, 'endedAt' | 'endDate'>): boolean {
  return !!c.endedAt || new Date(c.endDate).getTime() <= Date.now();
}

export function daysLeftLabel(endDate: string): string {
  const ms = new Date(endDate).getTime() - Date.now();
  if (ms <= 0) return 'Ended';
  const days = Math.ceil(ms / 86_400_000);
  return days === 1 ? 'Last day' : `${days}d left`;
}
