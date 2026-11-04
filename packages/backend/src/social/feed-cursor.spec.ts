import { decodeFeedCursor, encodeFeedCursor } from './social.service';

describe('feed cursor', () => {
  const cursor = {
    time: new Date('2026-10-19T08:30:00.123Z'),
    type: 'habit_log' as const,
    id: 'clx123abc',
  };

  it('round-trips', () => {
    expect(decodeFeedCursor(encodeFeedCursor(cursor))).toEqual(cursor);
  });

  it.each([
    ['', 'empty'],
    ['2026-10-19T08:30:00Z', 'a bare timestamp'],
    ['nope|habit_log|abc', 'a bad time'],
    ['2026-10-19T08:30:00Z|weight_log|abc', 'an unknown type'],
    ['2026-10-19T08:30:00Z|food_log|', 'a missing id'],
  ])('rejects %p (%s)', (raw) => {
    expect(decodeFeedCursor(raw)).toBeNull();
  });
});
