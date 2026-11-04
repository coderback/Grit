export type WeightUnit = 'kg' | 'lb';
export type HeightUnit = 'cm' | 'ft';

export const LB_PER_KG = 2.20462;
const CM_PER_IN = 2.54;

const round1 = (n: number) => Math.round(n * 10) / 10;

export function kgToUnit(kg: number, unit: WeightUnit): number {
  return round1(unit === 'lb' ? kg * LB_PER_KG : kg);
}

export function unitToKg(value: number, unit: WeightUnit): number {
  return round1(unit === 'lb' ? value / LB_PER_KG : value);
}

/** "78.5 kg" or "173.1 lb" */
export function formatWeight(kg: number | null | undefined, unit: WeightUnit): string {
  return kg == null ? '—' : `${kgToUnit(kg, unit)} ${unit}`;
}

/** "175 cm" or "5′9″" */
export function formatHeight(cm: number | null | undefined, unit: HeightUnit): string {
  if (cm == null) return '—';
  if (unit === 'cm') return `${Math.round(cm)} cm`;
  const totalIn = Math.round(cm / CM_PER_IN);
  return `${Math.floor(totalIn / 12)}′${totalIn % 12}″`;
}
