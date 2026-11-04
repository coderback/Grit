/** What a challenge counts, its goal limits and how results read. */

export const CHALLENGE_TYPES = ['steps', 'active_minutes', 'workouts'] as const;
export type ChallengeType = (typeof CHALLENGE_TYPES)[number];

/** Group goal limits per type: the smallest that's a challenge, the largest that's sane. */
export const GOAL_LIMITS: Record<ChallengeType, { min: number; max: number }> =
  {
    steps: { min: 1000, max: 10_000_000 },
    active_minutes: { min: 30, max: 100_000 },
    workouts: { min: 2, max: 1000 },
  };

export const UNIT: Record<ChallengeType, [string, string]> = {
  steps: ['step', 'steps'],
  active_minutes: ['active minute', 'active minutes'],
  workouts: ['workout', 'workouts'],
};

export function isChallengeType(t: string): t is ChallengeType {
  return (CHALLENGE_TYPES as readonly string[]).includes(t);
}

/** A participant's score from their workouts in the challenge window. */
export function scoreFor(
  type: string,
  totals: { steps: number; minutes: number; workouts: number },
): number {
  if (type === 'active_minutes') return totals.minutes;
  if (type === 'workouts') return totals.workouts;
  return totals.steps; // steps, and the old group_steps
}

export function formatAmount(type: string, n: number): string {
  const [one, many] = UNIT[isChallengeType(type) ? type : 'steps'];
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
}

/** The results alert for one participant when a challenge ends. */
export function endedAlert(c: {
  title: string;
  type: string;
  goalValue: number;
  total: number;
  rank: number;
  participants: number;
}): { title: string; body: string } {
  const place =
    c.participants > 1 ? ` You placed #${c.rank} of ${c.participants}.` : '';
  const result =
    c.total >= c.goalValue
      ? `Goal reached: ${formatAmount(c.type, c.total)} of ${c.goalValue.toLocaleString('en-US')}.`
      : `The group got to ${Math.floor((c.total / c.goalValue) * 100)}% (${formatAmount(c.type, c.total)} of ${c.goalValue.toLocaleString('en-US')}).`;
  return { title: `🏁 ${c.title} has ended`, body: `${result}${place}` };
}

/** Standard competition ranking: ties share a place (1, 2, 2, 4). */
export function ranks(values: number[]): number[] {
  return values.map((v) => values.filter((o) => o > v).length + 1);
}
