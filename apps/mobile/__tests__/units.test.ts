import { formatHeight, formatWeight, kgToUnit, unitToKg } from '@/lib/units';

describe('units', () => {
  it('converts weight both ways to one decimal', () => {
    expect(kgToUnit(80, 'lb')).toBe(176.4);
    expect(unitToKg(176.4, 'lb')).toBe(80);
    expect(kgToUnit(80, 'kg')).toBe(80);
  });
  it('formats weight and height', () => {
    expect(formatWeight(78.46, 'kg')).toBe('78.5 kg');
    expect(formatWeight(null, 'lb')).toBe('—');
    expect(formatHeight(175, 'cm')).toBe('175 cm');
    expect(formatHeight(175, 'ft')).toBe('5′9″');
  });
});
