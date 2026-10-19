import { defaultDaysPerWeek, normalizePlanDays } from './plan-days';

const session = (day: string, extra: object = {}) => ({
  day,
  rest: false,
  title: 'Full body',
  activityType: 'strength_training',
  durationMin: 40,
  exercises: [{ name: 'Squats', detail: '3 × 12' }],
  ...extra,
});

describe('normalizePlanDays', () => {
  it('returns seven days, Monday first, filling gaps with rest', () => {
    const days = normalizePlanDays([session('wed'), session('mon')]);
    expect(days.map((d) => d.day)).toEqual([
      'mon',
      'tue',
      'wed',
      'thu',
      'fri',
      'sat',
      'sun',
    ]);
    expect(days.filter((d) => !d.rest).map((d) => d.day)).toEqual([
      'mon',
      'wed',
    ]);
    expect(days[1]).toEqual({
      day: 'tue',
      rest: true,
      title: 'Rest',
      activityType: 'other',
      durationMin: 0,
      exercises: [],
    });
  });

  it('clears exercises and duration on rest days', () => {
    const [mon] = normalizePlanDays([
      session('mon', { rest: true, title: 'Active recovery' }),
    ]);
    expect(mon).toMatchObject({
      rest: true,
      title: 'Active recovery',
      durationMin: 0,
      exercises: [],
    });
  });

  it('trims text and fills an empty title', () => {
    const [mon] = normalizePlanDays([
      session('mon', {
        title: '  ',
        exercises: [{ name: ' Plank ', detail: ' 3 × 30 s ' }],
      }),
    ]);
    expect(mon.title).toBe('Workout');
    expect(mon.exercises).toEqual([{ name: 'Plank', detail: '3 × 30 s' }]);
  });

  it.each([
    ['a non-list', { mon: session('mon') }],
    ['an unknown day', [session('funday')]],
    ['a duplicate day', [session('mon'), session('mon')]],
    ['an unknown activity', [session('mon', { activityType: 'parkour' })]],
    ['a 5-hour session', [session('mon', { durationMin: 300 })]],
    [
      'too many exercises',
      [
        session('mon', {
          exercises: Array(13).fill({ name: 'x', detail: '' }),
        }),
      ],
    ],
    ['an extra field', [session('mon', { url: 'http://x' })]],
  ])('rejects %s', (_label, raw) => {
    expect(() => normalizePlanDays(raw)).toThrow();
  });
});

describe('defaultDaysPerWeek', () => {
  it('trains more often at higher activity levels', () => {
    expect(defaultDaysPerWeek('sedentary')).toBe(3);
    expect(defaultDaysPerWeek('active')).toBe(4);
    expect(defaultDaysPerWeek('very_active')).toBe(5);
    expect(defaultDaysPerWeek(null)).toBe(3);
  });
});
