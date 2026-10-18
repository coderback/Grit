// The 20 activity types supported for manual logging
export const ACTIVITY_TYPES = [
  'running', 'cycling', 'walking', 'swimming', 'strength_training',
  'yoga', 'hiit', 'rowing', 'elliptical', 'stair_climbing',
  'basketball', 'tennis', 'soccer', 'dancing', 'hiking',
  'jump_rope', 'pilates', 'boxing', 'rock_climbing', 'other',
] as const;

// Rough MET-based calorie estimate: MET * weight_kg * duration_hours
// Using a fixed 70 kg estimate when user weight is unavailable
export const MET: Record<string, number> = {
  running: 9.8, cycling: 7.5, walking: 3.5, swimming: 8.0,
  strength_training: 5.0, yoga: 2.5, hiit: 8.0, rowing: 7.0,
  elliptical: 5.0, stair_climbing: 8.0, basketball: 6.5, tennis: 7.0,
  soccer: 7.0, dancing: 4.5, hiking: 6.0, jump_rope: 11.0,
  pilates: 3.0, boxing: 7.8, rock_climbing: 8.0, other: 5.0,
};
