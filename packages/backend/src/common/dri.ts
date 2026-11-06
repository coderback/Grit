import type { NutrientCode } from '../food/nutrients';

/**
 * Daily targets for vitamins, minerals and fibre, from the US Dietary
 * Reference Intakes (National Academies; summary tables published by the
 * NIH Office of Dietary Supplements). Each is the RDA where one exists,
 * otherwise the Adequate Intake (vitamin K, potassium, fibre).
 *
 * GRIT is for adults (18+), so only the 14–18 group (for 18-year-olds) and
 * the adult groups are listed. Pregnancy and breastfeeding raise several
 * targets; GRIT doesn't ask about either, and the Nutrients screen says so.
 */

type Sex = 'male' | 'female';

// [age the band starts at, male, female], oldest band last
type Bands = readonly (readonly [number, number, number])[];

const DRI: Partial<Record<NutrientCode, Bands>> = {
  vit_a_ug: [[14, 900, 700]],
  vit_c_mg: [
    [14, 75, 65],
    [19, 90, 75],
  ],
  vit_d_ug: [
    [14, 15, 15],
    [71, 20, 20],
  ],
  vit_e_mg: [[14, 15, 15]],
  vit_k_ug: [
    [14, 75, 75],
    [19, 120, 90],
  ],
  b1_mg: [
    [14, 1.2, 1.0],
    [19, 1.2, 1.1],
  ],
  b2_mg: [
    [14, 1.3, 1.0],
    [19, 1.3, 1.1],
  ],
  b3_mg: [[14, 16, 14]],
  b6_mg: [
    [14, 1.3, 1.2],
    [19, 1.3, 1.3],
    [51, 1.7, 1.5],
  ],
  b12_ug: [[14, 2.4, 2.4]],
  folate_ug: [[14, 400, 400]],
  calcium_mg: [
    [14, 1300, 1300],
    [19, 1000, 1000],
    [51, 1000, 1200],
    [71, 1200, 1200],
  ],
  iron_mg: [
    [14, 11, 15],
    [19, 8, 18],
    [51, 8, 8],
  ],
  magnesium_mg: [
    [14, 410, 360],
    [19, 400, 310],
    [31, 420, 320],
  ],
  potassium_mg: [
    [14, 3000, 2300],
    [19, 3400, 2600],
  ],
  zinc_mg: [
    [14, 11, 9],
    [19, 11, 8],
  ],
  phosphorus_mg: [
    [14, 1250, 1250],
    [19, 700, 700],
  ],
  selenium_ug: [[14, 55, 55]],
  fibre_g: [
    [14, 38, 26],
    [19, 38, 25],
    [51, 30, 21],
  ],
};

/** Sodium: the level to stay under to lower long-term risk (CDRR), mg. */
export const SODIUM_LIMIT_MG = 2300;

/** Saturated fat: under 10% of calories (US Dietary Guidelines). */
export function satFatLimitG(calorieTarget: number) {
  return Math.round((calorieTarget * 0.1) / 9);
}

/** Whole years between a date of birth and a date (one definition, in safety). */
export { ageOn } from './safety';

/**
 * Daily targets for one person. Without a recorded sex, each target is the
 * lower of the male and female values, so nothing is called low that would
 * be fine for either; without an age, adult (19–30) values are used.
 */
export function driTargets(person: {
  gender?: string | null;
  age?: number | null;
}): Partial<Record<NutrientCode, number>> {
  const age = person.age && person.age >= 14 ? person.age : 19;
  const sex: Sex | null =
    person.gender === 'male' || person.gender === 'female'
      ? person.gender
      : null;
  const out: Partial<Record<NutrientCode, number>> = {};
  for (const [code, bands] of Object.entries(DRI) as [NutrientCode, Bands][]) {
    const band = [...bands].reverse().find(([from]) => age >= from)!;
    const [, male, female] = band;
    out[code] =
      sex === 'male'
        ? male
        : sex === 'female'
          ? female
          : Math.min(male, female);
  }
  return out;
}
