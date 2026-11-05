/**
 * "Say it" for workouts: turns "bench 80 for 8, 8, 7" into three sets.
 * Common phrasings are read here, without a model call; anything else goes
 * to the model with WORKOUT_SCHEMA.
 */

export interface SessionExercise {
  id: string;
  name: string;
}

export interface SpokenSet {
  exerciseId: string;
  reps: number;
  weightKg: number | null;
  durationSec: number | null;
}

const LB = 0.45359237;
const UNIT = '(kg|kgs|kilo|kilos|lb|lbs|pound|pounds)';
const NUM = '(\\d+(?:\\.\\d+)?)';
const LIST = '(\\d+(?:(?: ?, ?| and | )\\d+)*)';
const SEP = '(?: ?(?:for|x|@|,))?';
const AT = '(?: (?:at|@|with|x) ' + NUM + ' ?' + UNIT + '?)?';

const UNIT_RE = new RegExp(`^ ?${UNIT}`);

const RE = {
  // 100kg 5x5, 100 for 3 x 8
  weightSetsReps: new RegExp(
    `^${NUM} ?${UNIT}?${SEP} ?(\\d+) ?x ?(\\d+)(?: reps?)?$`,
  ),
  // 80 for 3 sets of 8
  weightSetsOf: new RegExp(
    `^${NUM} ?${UNIT}?${SEP} ?(\\d+) sets? of (\\d+)(?: reps?)?$`,
  ),
  // 80 for 8, 8, 7
  weightList: new RegExp(`^${NUM} ?${UNIT}?${SEP} ?${LIST}(?: reps?)?$`),
  // 3 x 10, 3x10 at 20kg
  setsReps: new RegExp(`^(\\d+) ?x ?(\\d+)(?: reps?)?${AT}$`),
  // 3 sets of 10 at 20
  setsOf: new RegExp(`^(\\d+) sets? of (\\d+)(?: reps?)?${AT}$`),
  // 10, 10, 8 or 8 8 7 at 80
  list: new RegExp(`^${LIST}(?: reps?)?${AT}$`),
  // 45 seconds, 3 x 30 s, 2 min
  timed: /^(?:(\d+) ?x ?)?(\d+) ?(s|sec|secs|seconds|min|mins|minutes)$/,
};

// Everyday names for lifts, matched against the session's exercise names
const ALIASES: Record<string, string[]> = {
  rdl: ['romanian deadlift'],
  rdls: ['romanian deadlift'],
  ohp: ['military press', 'shoulder press', 'overhead press'],
  dl: ['deadlift'],
  dls: ['deadlift'],
  bench: ['bench press'],
  pullups: ['pullup', 'pull-up', 'pull up'],
  chinups: ['chin-up', 'chinup'],
  pushups: ['pushup', 'push-up', 'push up'],
};

const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const stem = (w: string) => (w.length > 3 ? w.replace(/(es|s)$/, '') : w);

/**
 * The session exercise a spoken name means, or null. Every word said has to
 * be in the name (or be a known short name for it), so "leg press" doesn't
 * match the bench press.
 */
export function matchExercise(spoken: string, exercises: SessionExercise[]) {
  const words = spoken
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOP.has(w));
  if (!words.length) return null;
  let best: { e: SessionExercise; score: number } | null = null;
  for (const e of exercises) {
    const name = compact(e.name);
    let score = 0;
    for (const w of words) {
      const direct = name.includes(compact(stem(w)));
      const alias = (ALIASES[w] ?? []).some((a) => name.includes(compact(a)));
      if (!direct && !alias) {
        score = 0;
        break;
      }
      score += alias ? 2 : 1;
    }
    if (score > (best?.score ?? 0)) best = { e, score };
  }
  return best?.e ?? null;
}

const STOP = new Set([
  'the',
  'some',
  'my',
  'did',
  'then',
  'and',
  'of',
  'a',
  'on',
]);

const toKg = (n: number, unit?: string) =>
  unit?.startsWith('lb') || unit?.startsWith('pound')
    ? Math.round(n * LB * 10) / 10
    : n;
const listOf = (s: string) =>
  s
    .split(/ ?, ?| and | /)
    .filter(Boolean)
    .map(Number);

// A first number above this is a weight, not a rep count
const MAX_PLAIN_REPS = 30;

/** The sets in what follows the exercise name, or null if it can't be read. */
export function readSets(
  rest: string,
):
  | { reps: number; weightKg: number | null; durationSec: number | null }[]
  | null {
  const r = rest
    .toLowerCase()
    .replace(/×/g, 'x')
    .replace(/(\d) ?x ?(\d)/g, '$1 x $2')
    .replace(/[.!?]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  const sets = (n: number, reps: number, w: number | null) =>
    Array.from({ length: n }, () => ({ reps, weightKg: w, durationSec: null }));
  let m: RegExpExecArray | null;

  if ((m = RE.timed.exec(r))) {
    const n = m[1] ? +m[1] : 1;
    const sec = +m[2] * (m[3].startsWith('m') ? 60 : 1);
    return Array.from({ length: n }, () => ({
      reps: 0,
      weightKg: null,
      durationSec: sec,
    }));
  }
  const explicitWeight = (first: string, unit?: string) =>
    !!unit || first.includes('.') || +first > MAX_PLAIN_REPS;
  // "25, 10" is two sets of reps; "25 for 10" is a weight and reps
  const hasSep = (s: string) => /^ ?(for|x|@)( |$)/.test(s);

  if ((m = RE.setsOf.exec(r))) {
    return sets(+m[1], +m[2], m[3] ? toKg(+m[3], m[4]) : null);
  }
  if ((m = RE.weightSetsOf.exec(r))) {
    return sets(+m[3], +m[4], toKg(+m[1], m[2]));
  }
  if ((m = RE.weightSetsReps.exec(r)) && explicitWeight(m[1], m[2])) {
    return sets(+m[3], +m[4], toKg(+m[1], m[2]));
  }
  if ((m = RE.setsReps.exec(r)) && +m[1] <= 10 && !explicitWeight(m[1])) {
    return sets(+m[1], +m[2], m[3] ? toKg(+m[3], m[4]) : null);
  }
  if (
    (m = RE.weightList.exec(r)) &&
    (explicitWeight(m[1], m[2]) ||
      hasSep(r.slice(m[1].length).replace(UNIT_RE, '')))
  ) {
    return listOf(m[3]).map((reps) => ({
      reps,
      weightKg: toKg(+m![1], m![2]),
      durationSec: null,
    }));
  }
  if ((m = RE.list.exec(r))) {
    const w = m[2] ? toKg(+m[2], m[3]) : null;
    return listOf(m[1]).map((reps) => ({
      reps,
      weightKg: w,
      durationSec: null,
    }));
  }
  return null;
}

const valid = (s: {
  reps: number;
  weightKg: number | null;
  durationSec: number | null;
}) =>
  (s.durationSec
    ? s.durationSec > 0 && s.durationSec <= 3600
    : s.reps >= 1 && s.reps <= 100) &&
  (s.weightKg == null || (s.weightKg > 0 && s.weightKg <= 500));

/**
 * Reads the whole phrase: one or more "<exercise> <sets>" parts, split on
 * "then", "and then", ";" or new lines. Null if any part can't be read,
 * so the caller can ask the model instead.
 */
export function parseSpokenSets(
  text: string,
  exercises: SessionExercise[],
): SpokenSet[] | null {
  const parts = text
    .split(/\n|;|\band then\b|\bthen\b|\. /i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length || parts.length > 12) return null;
  const out: SpokenSet[] = [];
  let lastExercise: SessionExercise | null = null;
  for (const part of parts) {
    const at = part.search(/\d/);
    if (at < 0) return null;
    const name = part.slice(0, at).trim();
    // "then 85 for 6" carries on with the last exercise
    const exercise: SessionExercise | null = name
      ? matchExercise(name, exercises)
      : lastExercise;
    if (!exercise) return null;
    const sets = readSets(part.slice(at));
    if (!sets?.length || sets.length > 10 || !sets.every(valid)) return null;
    out.push(...sets.map((s) => ({ ...s, exerciseId: exercise.id })));
    lastExercise = exercise;
  }
  return out.length ? out : null;
}

// For the model: sets as a list, with the session's exercise ids, or "" and
// a name for an exercise that isn't in the session
export function workoutSchema(exerciseIds: string[]) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['sets'],
    properties: {
      sets: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'exerciseId',
            'exerciseName',
            'reps',
            'weight',
            'unit',
            'durationSec',
          ],
          properties: {
            exerciseId: { type: 'string', enum: [...exerciseIds, ''] },
            exerciseName: { type: 'string' },
            reps: { type: 'integer' },
            weight: { type: ['number', 'null'] },
            unit: { type: 'string', enum: ['kg', 'lb'] },
            durationSec: { type: ['integer', 'null'] },
          },
        },
      },
    },
  };
}

export function workoutInstructions(exercises: SessionExercise[]) {
  return `You read what someone says about the sets they just lifted, for a workout log.

Exercises in today's session:
${exercises.map((e) => `- ${e.id}: ${e.name}`).join('\n') || '(none)'}

Return one entry per set, in order. "bench 80 for 8, 8, 7" is three sets of bench press at 80 with 8, 8 and 7 reps; "3x10 pull-ups" is three sets of 10 with no weight; "plank 45 seconds" is one set with durationSec 45 and reps 0.
- exerciseId: the matching exercise from the list, or "" if it isn't there (then give its usual name in exerciseName).
- weight: the number they said, or null for bodyweight; unit: "lb" only if they said pounds or lbs, otherwise "kg".
- Ignore anything that isn't a set. If they describe no sets, return an empty list.`;
}
