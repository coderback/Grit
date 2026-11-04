import { addDays, dateMarker, dayRange, localDateOf, weekStart } from './day';

describe('day helpers', () => {
  describe('localDateOf', () => {
    const instant = new Date('2026-10-19T23:30:00Z');

    it('uses the UTC date at offset 0', () => {
      expect(localDateOf(instant, 0)).toBe('2026-10-19');
    });

    it('rolls forward for zones ahead of UTC', () => {
      expect(localDateOf(instant, 60)).toBe('2026-10-20'); // UTC+1
      expect(localDateOf(instant, 330)).toBe('2026-10-20'); // India, UTC+5:30
    });

    it('rolls back for zones behind UTC', () => {
      expect(localDateOf(new Date('2026-10-19T03:00:00Z'), -300)).toBe(
        '2026-10-18',
      ); // UTC-5
    });

    it('handles the extreme offsets', () => {
      const noon = new Date('2026-10-19T12:00:00Z');
      expect(localDateOf(noon, 840)).toBe('2026-10-20'); // UTC+14
      expect(localDateOf(noon, -720)).toBe('2026-10-19'); // UTC-12, exactly midnight
    });
  });

  describe('addDays', () => {
    it('crosses month and year boundaries', () => {
      expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
      expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
      expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
      expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    });
  });

  describe('dayRange', () => {
    it('is the UTC day at offset 0', () => {
      const { start, end } = dayRange('2026-10-19', 0);
      expect(start.toISOString()).toBe('2026-10-19T00:00:00.000Z');
      expect(end.toISOString()).toBe('2026-10-20T00:00:00.000Z');
    });

    it('starts earlier in UTC for zones ahead of it', () => {
      const { start, end } = dayRange('2026-10-19', 330);
      expect(start.toISOString()).toBe('2026-10-18T18:30:00.000Z');
      expect(end.toISOString()).toBe('2026-10-19T18:30:00.000Z');
    });

    it('starts later in UTC for zones behind it', () => {
      const { start } = dayRange('2026-10-19', -300);
      expect(start.toISOString()).toBe('2026-10-19T05:00:00.000Z');
    });

    it('agrees with localDateOf at both ends', () => {
      for (const offset of [-720, -300, 0, 330, 840]) {
        const { start, end } = dayRange('2026-10-19', offset);
        expect(localDateOf(start, offset)).toBe('2026-10-19');
        expect(localDateOf(new Date(end.getTime() - 1), offset)).toBe(
          '2026-10-19',
        );
        expect(localDateOf(end, offset)).toBe('2026-10-20');
      }
    });
  });

  describe('weekStart', () => {
    it('returns the Monday of the week', () => {
      expect(weekStart('2026-10-19')).toBe('2026-10-19'); // Monday
      expect(weekStart('2026-10-21')).toBe('2026-10-19'); // Wednesday
      expect(weekStart('2026-10-25')).toBe('2026-10-19'); // Sunday
      expect(weekStart('2026-10-26')).toBe('2026-10-26'); // next Monday
    });
  });

  describe('dateMarker', () => {
    it('is midnight UTC of the date, whatever the offset', () => {
      expect(dateMarker('2026-10-19').toISOString()).toBe(
        '2026-10-19T00:00:00.000Z',
      );
    });
  });
});
