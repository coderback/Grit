import {
  MAX_MEMORIES,
  cleanMemory,
  mayHoldFacts,
  planMemoryUpdate,
  type StoredMemory,
} from './coach-memory';

const mem = (
  id: string,
  text: string,
  daysAgo = 0,
  source = 'chat',
): StoredMemory => ({
  id,
  text,
  source,
  createdAt: new Date(Date.now() - daysAgo * 86_400_000),
});

describe('planMemoryUpdate', () => {
  it('adds new notes and removes the ones it replaces', () => {
    const existing = [mem('a', 'Has a sore left knee'), mem('b', 'Vegetarian')];
    expect(
      planMemoryUpdate(existing, {
        add: ['Knee has healed; can run again'],
        remove: ['a', 'not-an-id'],
      }),
    ).toEqual({ remove: ['a'], add: ['Knee has healed; can run again'] });
  });

  it('skips duplicates and blanks', () => {
    const existing = [mem('a', 'Trains before work, around 6am')];
    expect(
      planMemoryUpdate(existing, {
        add: [
          'trains before work around 6am!',
          '  ',
          'Hates running',
          'hates running',
        ],
        remove: [],
      }),
    ).toEqual({ remove: [], add: ['Hates running'] });
  });

  it("past the limit, drops the coach's oldest notes but keeps the user's", () => {
    const existing = [
      mem('user-old', 'Allergic to peanuts', 100, 'user'),
      ...Array.from({ length: MAX_MEMORIES - 1 }, (_, i) =>
        mem(`c${i}`, `Note ${i}`, 50 - i),
      ),
    ];
    const plan = planMemoryUpdate(existing, {
      add: ['New one', 'Another'],
      remove: [],
    });
    expect(plan.add).toEqual(['New one', 'Another']);
    expect(plan.remove).toEqual(['c0', 'c1']);
  });

  it('when every note is hand-written, only adds what fits', () => {
    const existing = Array.from({ length: MAX_MEMORIES }, (_, i) =>
      mem(`u${i}`, `Mine ${i}`, 0, 'user'),
    );
    expect(planMemoryUpdate(existing, { add: ['x y z'], remove: [] })).toEqual({
      remove: [],
      add: [],
    });
  });
});

describe('helpers', () => {
  it('cleans notes to one short line', () => {
    expect(cleanMemory('  Has\n a  bad back ')).toBe('Has a bad back');
    expect(cleanMemory('x'.repeat(300))).toHaveLength(160);
  });

  it('only asks about messages with some substance', () => {
    expect(mayHoldFacts('thanks!')).toBe(false);
    expect(mayHoldFacts('ok cool')).toBe(false);
    expect(mayHoldFacts('I hurt my knee running yesterday')).toBe(true);
  });
});
