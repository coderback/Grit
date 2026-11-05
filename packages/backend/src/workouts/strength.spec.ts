import {
  epley,
  markPrs,
  NO_RECORDS,
  parseDetail,
  recordsOf,
  volumeKg,
} from './strength';
import { matchExercise, parseSpokenSets, readSets } from './say-it';
import { cleanTitle } from './workouts.service';

describe('estimated one-rep max', () => {
  it('uses Epley up to 10 reps', () => {
    expect(epley(100, 1)).toBe(100);
    expect(epley(100, 5)).toBe(116.7);
    expect(epley(80, 10)).toBe(106.7);
    expect(epley(80, 11)).toBeNull();
    expect(epley(null, 5)).toBeNull();
  });
});

describe('personal records', () => {
  const sets = [
    { exerciseId: 'bench', reps: 10, weightKg: 40, warmup: true },
    { exerciseId: 'bench', reps: 8, weightKg: 80 },
    { exerciseId: 'bench', reps: 6, weightKg: 85 },
    { exerciseId: 'pullups', reps: 12 },
  ];

  it('ignores warm-ups in the records', () => {
    expect(recordsOf(sets.filter((s) => s.exerciseId === 'bench'))).toEqual({
      e1rm: 102,
      weightKg: 85,
      reps: null,
    });
  });

  it("doesn't mark a first session as a page of PRs", () => {
    expect(markPrs(sets, new Map())).toEqual([null, null, null, null]);
  });

  it('marks heavier sets, better estimates and more bodyweight reps', () => {
    const history = new Map([
      ['bench', { e1rm: 100, weightKg: 82.5, reps: null }],
      ['pullups', { e1rm: null, weightKg: null, reps: 10 }],
    ]);
    expect(markPrs(sets, history)).toEqual([null, 'e1rm', 'weight', 'reps']);
  });

  it('updates as the session goes, so a repeat of a new PR is not one', () => {
    const history = new Map([
      ['bench', { ...NO_RECORDS, e1rm: 90, weightKg: 75 }],
    ]);
    const repeat = [
      { exerciseId: 'bench', reps: 5, weightKg: 80 },
      { exerciseId: 'bench', reps: 5, weightKg: 80 },
    ];
    expect(markPrs(repeat, history)).toEqual(['weight', null]);
  });

  it('adds up volume from working sets', () => {
    expect(volumeKg(sets)).toBe(80 * 8 + 85 * 6);
  });
});

describe('plan details', () => {
  it('reads sets and rep ranges', () => {
    expect(parseDetail('3 × 8–12')).toEqual({
      kind: 'reps',
      target: { sets: 3, repsLow: 8, repsHigh: 12 },
    });
    expect(parseDetail('4x6')).toEqual({
      kind: 'reps',
      target: { sets: 4, repsLow: 6, repsHigh: 6 },
    });
    expect(parseDetail('3 x 10-15 each side')?.target).toEqual({
      sets: 3,
      repsLow: 10,
      repsHigh: 15,
    });
  });

  it('reads timed sets and ignores the rest', () => {
    expect(parseDetail('3 × 30 s')).toEqual({
      kind: 'timed',
      target: { sets: 3, seconds: 30 },
    });
    expect(parseDetail('4 × 30 s on / 30 s off')?.kind).toBe('timed');
    expect(parseDetail('20 min easy pace')).toBeNull();
    expect(parseDetail('3 × 20 min')).toBeNull();
  });
});

describe('Say it', () => {
  const session = [
    {
      id: 'Barbell_Bench_Press_-_Medium_Grip',
      name: 'Barbell Bench Press - Medium Grip',
    },
    { id: 'Barbell_Squat', name: 'Barbell Squat' },
    { id: 'Pullups', name: 'Pullups' },
    { id: 'Romanian_Deadlift', name: 'Romanian Deadlift' },
    { id: 'Plank', name: 'Plank' },
  ];
  const sets = (text: string) =>
    parseSpokenSets(text, session)?.map((s) =>
      [s.exerciseId, s.reps, s.weightKg, s.durationSec].join(' '),
    ) ?? null;

  it('reads "bench 80 for 8, 8, 7" as three sets', () => {
    expect(sets('bench 80 for 8, 8, 7')).toEqual([
      'Barbell_Bench_Press_-_Medium_Grip 8 80 ',
      'Barbell_Bench_Press_-_Medium_Grip 8 80 ',
      'Barbell_Bench_Press_-_Medium_Grip 7 80 ',
    ]);
  });

  it('reads the common ways of saying sets', () => {
    expect(sets('squat 100kg 5x5')).toHaveLength(5);
    expect(sets('squat 100 for 3 sets of 8')?.[0]).toBe('Barbell_Squat 8 100 ');
    expect(sets('3 sets of 10 pull ups')).toBeNull(); // the name comes first
    expect(sets('pull ups 3x10')).toEqual(Array(3).fill('Pullups 10  '));
    expect(sets('pullups 12, 10, 8')).toEqual([
      'Pullups 12  ',
      'Pullups 10  ',
      'Pullups 8  ',
    ]);
    expect(sets('rdl 8 8 8 at 60')).toEqual(
      Array(3).fill('Romanian_Deadlift 8 60 '),
    );
    expect(sets('plank 45 seconds')).toEqual(['Plank 0  45']);
    expect(sets('plank 3 x 30 s')).toHaveLength(3);
  });

  it('converts pounds and carries on with "then"', () => {
    expect(sets('bench 185 lbs for 5 then 195 for 3')).toEqual([
      'Barbell_Bench_Press_-_Medium_Grip 5 83.9 ',
      'Barbell_Bench_Press_-_Medium_Grip 3 195 ',
    ]);
  });

  it('leaves what it cannot read to the model', () => {
    expect(sets('did a few heavy ones')).toBeNull();
    expect(sets('leg press 200 for 10')).toBeNull(); // not in the session
    expect(readSets('for a while')).toBeNull();
    expect(matchExercise('curls', session)).toBeNull();
  });
});

describe('workout titles', () => {
  it('drops pro-eating-disorder titles, which followers would see', () => {
    expect(cleanTitle('  Push day ')).toBe('Push day');
    expect(cleanTitle('thinspo legs')).toBeNull();
    expect(cleanTitle('')).toBeNull();
  });
});
