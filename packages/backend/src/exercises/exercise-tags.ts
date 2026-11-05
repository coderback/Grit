/**
 * Turns free-exercise-db entries into GRIT's exercise library: a movement
 * pattern (so swaps keep progression history), what the exercise stresses
 * (so the coach can avoid it for an injury), and simpler equipment names.
 * Rules over names and categories, checked by hand for the common lifts in
 * exercise-tags.spec.ts.
 */

export interface SourceExercise {
  id: string;
  name: string;
  force?: string | null;
  level?: string | null;
  mechanic?: string | null;
  equipment?: string | null;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  instructions?: string[];
  category?: string | null;
  images?: string[];
}

export const STRESSES = [
  'high_impact',
  'spinal_load',
  'overhead',
  'deep_knee_flexion',
  'wrist_load',
] as const;
export type Stress = (typeof STRESSES)[number];

/**
 * Bump when the tagging rules change, so existing databases reload the
 * library with the new tags on the next start.
 */
export const LIBRARY_VERSION = 'free-exercise-db:2';

export const IMAGE_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

const has = (name: string, ...words: string[]) =>
  words.some((w) => name.includes(w));

/** The movement pattern, or null for exercises that don't fit one. */
export function patternOf(e: SourceExercise): string | null {
  const n = e.name.toLowerCase();
  if (e.category === 'cardio') return 'cardio';
  if (e.category === 'stretching') return 'mobility';
  if (has(n, 'calf')) return 'calf_raise';
  if (has(n, 'lunge', 'split squat', 'step-up', 'step up')) return 'lunge';
  if (has(n, 'squat', 'leg press')) return 'squat';
  if (
    has(
      n,
      'deadlift',
      'good morning',
      'hip thrust',
      'glute bridge',
      'swing',
      'pull through',
    )
  )
    return 'hip_hinge';
  if (has(n, 'pull-up', 'pullup', 'chin-up', 'chinup', 'pulldown'))
    return 'vertical_pull';
  if (has(n, 'upright row')) return 'shoulder_raise';
  if (has(n, 'row', 'face pull')) return 'horizontal_pull';
  if (
    has(
      n,
      'shoulder press',
      'military press',
      'overhead press',
      'push press',
      'arnold',
      'handstand',
    )
  )
    return 'vertical_press';
  if (
    has(
      n,
      'bench press',
      'push-up',
      'pushup',
      'push up',
      'chest press',
      'floor press',
    ) ||
    (has(n, 'dip') && !has(n, 'triceps', 'tricep'))
  )
    return 'horizontal_press';
  if (has(n, 'curl') && !has(n, 'leg curl', 'wrist')) return 'elbow_flexion';
  if (has(n, 'triceps', 'tricep', 'pushdown', 'skull'))
    return 'elbow_extension';
  if (has(n, 'farmer', 'carry', 'yoke')) return 'carry';
  if (
    has(
      n,
      'plank',
      'crunch',
      'sit-up',
      'situp',
      'leg raise',
      'russian twist',
      'ab roller',
      'rollout',
    )
  )
    return 'core';
  if (e.category === 'plyometrics') return 'jump';
  return null;
}

/** What the exercise loads, for avoiding it around an injury. */
export function stressesOf(e: SourceExercise): Stress[] {
  const n = e.name.toLowerCase();
  const out = new Set<Stress>();
  const barbell = e.equipment === 'barbell';

  if (
    e.category === 'plyometrics' ||
    has(
      n,
      'jump',
      'hop',
      'bound',
      'sprint',
      'burpee',
      'skip',
      'running',
      'jogging',
      'mountain climber',
    )
  )
    out.add('high_impact');
  if (
    has(n, 'deadlift', 'good morning') ||
    (barbell &&
      has(
        n,
        'squat',
        'bent over',
        'military press',
        'shoulder press',
        'overhead',
      )) ||
    has(n, 't-bar row') ||
    e.category === 'olympic weightlifting' ||
    e.category === 'strongman'
  )
    out.add('spinal_load');
  if (
    has(
      n,
      'shoulder press',
      'military press',
      'overhead',
      'push press',
      'jerk',
      'snatch',
      'handstand',
      'pull-up',
      'pullup',
      'chin-up',
      'pulldown',
      'pullover',
    )
  )
    out.add('overhead');
  if (
    has(
      n,
      'squat',
      'lunge',
      'leg press',
      'pistol',
      'sissy',
      'step-up',
      'step up',
      'leg extension',
      'wall sit',
    )
  )
    out.add('deep_knee_flexion');
  if (
    has(
      n,
      'push-up',
      'pushup',
      'push up',
      'plank',
      'handstand',
      'dip',
      'burpee',
      'mountain climber',
    )
  )
    out.add('wrist_load');
  return [...out];
}

/** free-exercise-db's equipment as GRIT's simpler names. */
export function equipmentOf(e: SourceExercise): string[] {
  switch (e.equipment) {
    case 'barbell':
    case 'e-z curl bar':
      return ['barbell'];
    case 'dumbbell':
      return ['dumbbell'];
    case 'cable':
      return ['cable'];
    case 'machine':
      return ['machine'];
    case 'kettlebells':
      return ['kettlebell'];
    case 'bands':
      return ['band'];
    case 'body only':
    case null:
    case undefined:
      return ['bodyweight'];
    default:
      return ['other']; // medicine ball, exercise ball, foam roll, other
  }
}

/** The row GRIT stores for a free-exercise-db entry. */
export function toLibraryRow(e: SourceExercise) {
  return {
    id: e.id,
    name: e.name,
    aliases: [] as string[],
    primary: e.primaryMuscles ?? [],
    secondary: e.secondaryMuscles ?? [],
    equipment: equipmentOf(e),
    mechanics: e.mechanic ?? null,
    level: e.level ?? null,
    category: e.category ?? null,
    pattern: patternOf(e),
    stresses: stressesOf(e),
    instructions: (e.instructions ?? []).join('\n') || null,
    imageUrl: e.images?.[0] ? `${IMAGE_BASE}${e.images[0]}` : null,
    source: LIBRARY_VERSION,
  };
}

// Coach-memory notes that mean "avoid these stresses". A note saying the
// problem has passed ("knee has healed") doesn't count.
const RESTRICTIONS: { words: RegExp; stresses: Stress[] }[] = [
  {
    words: /\bknees?\b|\bacl\b|\bmeniscus\b|\bpatell/i,
    stresses: ['high_impact', 'deep_knee_flexion'],
  },
  {
    words: /\bback\b|\bspine\b|\bspinal\b|\bdisc\b|\bsciatica\b|\blumbar\b/i,
    stresses: ['spinal_load'],
  },
  { words: /\bshoulders?\b|\brotator\b/i, stresses: ['overhead'] },
  { words: /\bwrists?\b|\bcarpal\b/i, stresses: ['wrist_load'] },
  {
    words: /\bankles?\b|\bshins?\b|\bjump(ing)?\b|\bimpact\b|\bpregnan/i,
    stresses: ['high_impact'],
  },
];
const RESOLVED =
  /\b(healed|recovered|better now|no longer|fully fit|cleared)\b/i;

/** The stresses to avoid, from the coach's notes about the user. */
export function restrictedStresses(notes: string[]): Stress[] {
  const out = new Set<Stress>();
  for (const note of notes) {
    if (RESOLVED.test(note)) continue;
    for (const r of RESTRICTIONS) {
      if (r.words.test(note)) r.stresses.forEach((s) => out.add(s));
    }
  }
  return [...out];
}

// Common exercises tried first when building a plan's shortlist, so plans
// use familiar movements before obscure variations
export const COMMON_EXERCISES = [
  'Barbell_Squat',
  'Barbell_Full_Squat',
  'Bodyweight_Squat',
  'Dumbbell_Squat',
  'Leg_Press',
  'Barbell_Deadlift',
  'Romanian_Deadlift',
  'Barbell_Hip_Thrust',
  'Single_Leg_Glute_Bridge',
  'Barbell_Glute_Bridge',
  'Barbell_Walking_Lunge',
  'Dumbbell_Lunges',
  'Bodyweight_Walking_Lunge',
  'Step-up_with_Knee_Raise',
  'Barbell_Bench_Press_-_Medium_Grip',
  'Dumbbell_Bench_Press',
  'Barbell_Incline_Bench_Press_-_Medium_Grip',
  'Pushups',
  'Incline_Push-Up',
  'Dips_-_Triceps_Version',
  'Bench_Dips',
  'Standing_Military_Press',
  'Dumbbell_Shoulder_Press',
  'Bent_Over_Barbell_Row',
  'Bent_Over_Two-Dumbbell_Row',
  'Pullups',
  'Chin-Up',
  'Band_Assisted_Pull-Up',
  'Wide-Grip_Lat_Pulldown',
  'Face_Pull',
  'Barbell_Curl',
  'Alternate_Hammer_Curl',
  'Standing_Calf_Raises',
  'Plank',
  'Crunches',
  'Mountain_Climbers',
  'One-Arm_Kettlebell_Swings',
  'Farmers_Walk',
  'Walking_Treadmill',
  'Jogging_Treadmill',
  'Running_Treadmill',
  'Trail_Running_Walking',
  'Bicycling',
  'Bicycling_Stationary',
  'Rowing_Stationary',
  'Elliptical_Trainer',
  'Rope_Jumping',
];
