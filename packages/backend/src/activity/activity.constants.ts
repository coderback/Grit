// The 20 activity types supported for manual logging
export const ACTIVITY_TYPES = [
  'running',
  'cycling',
  'walking',
  'swimming',
  'strength_training',
  'yoga',
  'hiit',
  'rowing',
  'elliptical',
  'stair_climbing',
  'basketball',
  'tennis',
  'soccer',
  'dancing',
  'hiking',
  'jump_rope',
  'pilates',
  'boxing',
  'rock_climbing',
  'other',
] as const;

// Rough MET-based calorie estimate: MET * weight_kg * duration_hours
// Using a fixed 70 kg estimate when user weight is unavailable
export const MET: Record<string, number> = {
  running: 9.8,
  cycling: 7.5,
  walking: 3.5,
  swimming: 8.0,
  strength_training: 5.0,
  yoga: 2.5,
  hiit: 8.0,
  rowing: 7.0,
  elliptical: 5.0,
  stair_climbing: 8.0,
  basketball: 6.5,
  tennis: 7.0,
  soccer: 7.0,
  dancing: 4.5,
  hiking: 6.0,
  jump_rope: 11.0,
  pilates: 3.0,
  boxing: 7.8,
  rock_climbing: 8.0,
  other: 5.0,
};

export const INTENSITIES = ['light', 'moderate', 'vigorous'] as const;
export type Intensity = (typeof INTENSITIES)[number];

// Light and vigorous values for each activity, from the Compendium of
// Physical Activities (e.g. walking 3.0 at 2.5 mph and 5.0 at 4 mph;
// cycling 4.0 at under 10 mph and 10.0 at 14–16 mph; running 7.0 jogging
// and 11.5 at about 7 mph). "Moderate" keeps the MET table above, so logs
// without an intensity, and health imports, are unchanged. Check against the
// 2024 Adult Compendium before relying on them.
const LIGHT_VIGOROUS: Record<string, [number, number]> = {
  running: [7.0, 11.5],
  cycling: [4.0, 10.0],
  walking: [3.0, 5.0],
  swimming: [5.8, 9.8],
  strength_training: [3.5, 6.0],
  yoga: [2.3, 4.0],
  hiit: [5.0, 9.0],
  rowing: [4.8, 8.5],
  elliptical: [4.0, 7.0],
  stair_climbing: [4.0, 9.0],
  basketball: [4.5, 8.0],
  tennis: [5.0, 8.0],
  soccer: [5.0, 10.0],
  dancing: [3.0, 7.3],
  hiking: [5.3, 7.8],
  jump_rope: [8.8, 12.3],
  pilates: [2.8, 4.0],
  boxing: [5.5, 12.8],
  rock_climbing: [5.8, 8.0],
  other: [3.0, 7.0],
};

/** The MET value for an activity at an intensity (moderate when not given). */
export function metFor(activityType: string, intensity?: string | null) {
  const moderate = MET[activityType] ?? 5.0;
  const [light, vigorous] = LIGHT_VIGOROUS[activityType] ?? [
    moderate,
    moderate,
  ];
  if (intensity === 'light') return light;
  if (intensity === 'vigorous') return vigorous;
  return moderate;
}
