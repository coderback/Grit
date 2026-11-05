/**
 * Safety rules shared by targets, profiles, the coach and social text.
 * The calorie numbers are the clinical rules of thumb the research found
 * (no law sets them); have a dietitian review them before launch.
 */

export const KCAL_PER_KG = 7700;
/** Lowest daily target GRIT sets or accepts. */
export const FLOOR_FEMALE_KCAL = 1200;
export const FLOOR_MALE_KCAL = 1500;
/** Fastest planned loss: 1% of body weight a week. */
export const MAX_WEEKLY_LOSS_FRACTION = 0.01;
export const MIN_AGE = 18;

/** The floor for this person. Without a known sex, the lower one. */
export function calorieFloor(gender: string | null | undefined): number {
  return gender === 'male' ? FLOOR_MALE_KCAL : FLOOR_FEMALE_KCAL;
}

/** The largest daily deficit planned for this body weight, or none if unknown. */
export function maxDailyDeficit(weightKg: number | null | undefined): number {
  if (!weightKg || weightKg <= 0) return Infinity;
  return Math.round((weightKg * MAX_WEEKLY_LOSS_FRACTION * KCAL_PER_KG) / 7);
}

/** Full years between a date of birth and `now`. */
export function ageOn(dateOfBirth: Date, now = new Date()): number {
  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const m = now.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dateOfBirth.getUTCDate())) age--;
  return age;
}

export function isUnderMinimumAge(dateOfBirth: Date, now = new Date()) {
  return ageOn(dateOfBirth, now) < MIN_AGE;
}

/** Someone who said they have (or had) an eating disorder gets no weight-loss targets. */
export function weightLossAllowed(edScreen: string | null | undefined) {
  return edScreen !== 'yes';
}

// Pro-eating-disorder terms, kept out of names that other people see
// (display names, challenge names). Matched on whole words, also when split
// up ("thin-spo", "pro_ana"), so ordinary names like "Pro Analysis Club"
// pass.
const PRO_ED_TERMS = new Set([
  'proana',
  'promia',
  'thinspo',
  'thinspiration',
  'bonespo',
  'meanspo',
  'skinnyspo',
  'edtwt',
  'anatips',
]);

export function hasProEdTerm(text: string | null | undefined): boolean {
  if (!text) return false;
  const words = text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    // The word alone, or joined with the next one or two
    for (let n = 1; n <= 3 && i + n <= words.length; n++) {
      const joined = words.slice(i, i + n).join('');
      if (
        PRO_ED_TERMS.has(joined) ||
        PRO_ED_TERMS.has(joined.replace(/s$/, ''))
      ) {
        return true;
      }
    }
  }
  return false;
}
