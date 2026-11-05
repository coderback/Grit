import { readFileSync } from 'fs';
import { metFor } from '../activity/activity.constants';
import { join } from 'path';
import {
  COMMON_EXERCISES,
  patternOf,
  restrictedStresses,
  toLibraryRow,
  type SourceExercise,
} from './exercise-tags';

const data = JSON.parse(
  readFileSync(join(__dirname, '../../data/exercises.json'), 'utf8'),
) as SourceExercise[];
const byId = new Map(data.map((e) => [e.id, e]));
const row = (id: string) => toLibraryRow(byId.get(id)!);

describe('exercise library tags', () => {
  it('has every common exercise in the data', () => {
    expect(COMMON_EXERCISES.filter((id) => !byId.has(id))).toEqual([]);
  });

  it('gives the common lifts the right patterns', () => {
    expect(
      Object.fromEntries(
        [
          'Barbell_Squat',
          'Leg_Press',
          'Barbell_Deadlift',
          'Romanian_Deadlift',
          'Barbell_Hip_Thrust',
          'Dumbbell_Lunges',
          'Barbell_Bench_Press_-_Medium_Grip',
          'Pushups',
          'Standing_Military_Press',
          'Bent_Over_Barbell_Row',
          'Pullups',
          'Wide-Grip_Lat_Pulldown',
          'Barbell_Curl',
          'Dips_-_Triceps_Version',
          'Plank',
          'Running_Treadmill',
        ].map((id) => [id, row(id).pattern]),
      ),
    ).toEqual({
      Barbell_Squat: 'squat',
      Leg_Press: 'squat',
      Barbell_Deadlift: 'hip_hinge',
      Romanian_Deadlift: 'hip_hinge',
      Barbell_Hip_Thrust: 'hip_hinge',
      Dumbbell_Lunges: 'lunge',
      'Barbell_Bench_Press_-_Medium_Grip': 'horizontal_press',
      Pushups: 'horizontal_press',
      Standing_Military_Press: 'vertical_press',
      Bent_Over_Barbell_Row: 'horizontal_pull',
      Pullups: 'vertical_pull',
      'Wide-Grip_Lat_Pulldown': 'vertical_pull',
      Barbell_Curl: 'elbow_flexion',
      'Dips_-_Triceps_Version': 'elbow_extension',
      Plank: 'core',
      Running_Treadmill: 'cardio',
    });
  });

  it('tags what each lift stresses', () => {
    expect(row('Barbell_Squat').stresses.sort()).toEqual([
      'deep_knee_flexion',
      'spinal_load',
    ]);
    expect(row('Barbell_Deadlift').stresses).toEqual(['spinal_load']);
    expect(row('Standing_Military_Press').stresses.sort()).toEqual([
      'overhead',
      'spinal_load',
    ]);
    expect(row('Pushups').stresses).toEqual(['wrist_load']);
    expect(row('Knee_Tuck_Jump').stresses).toContain('high_impact');
    expect(row('Running_Treadmill').stresses).toContain('high_impact');
    // A seated machine press doesn't load the spine
    expect(row('Leverage_Shoulder_Press').stresses).toEqual(['overhead']);
    expect(row('Barbell_Curl').stresses).toEqual([]);
    // Knee-loading exercises named without the usual words
    expect(row('Barbell_Step_Ups').stresses).toContain('deep_knee_flexion');
    expect(row('Leg_Extensions').stresses).toContain('deep_knee_flexion');
    expect(row('Barbell_Step_Ups').pattern).toBe('lunge');
  });

  it('simplifies equipment and builds image links', () => {
    expect(row('Pushups').equipment).toEqual(['bodyweight']);
    expect(row('One-Arm_Kettlebell_Swings').equipment).toEqual(['kettlebell']);
    expect(row('Barbell_Squat').imageUrl).toMatch(
      /^https:\/\/raw\.githubusercontent\.com\/.+\/Barbell_Squat\/0\.jpg$/,
    );
  });

  it('reads injuries from coach notes, ignoring ones that have passed', () => {
    expect(
      restrictedStresses(['Has a sore left knee; avoid jumping']).sort(),
    ).toEqual(['deep_knee_flexion', 'high_impact']);
    expect(restrictedStresses(['Lower back pain; no heavy deadlifts'])).toEqual(
      ['spinal_load'],
    );
    expect(restrictedStresses(['Knee has healed; back to running'])).toEqual(
      [],
    );
    expect(restrictedStresses(['Vegetarian', 'Trains at 6am'])).toEqual([]);
    expect(patternOf({ id: 'x', name: 'Mystery move' })).toBeNull();
  });
});

describe('calories by intensity', () => {
  it('keeps moderate as before and spreads light and vigorous around it', () => {
    expect(metFor('running')).toBe(9.8);
    expect(metFor('running', 'moderate')).toBe(9.8);
    expect(metFor('running', 'light')).toBe(7.0);
    expect(metFor('walking', 'vigorous')).toBe(5.0);
    expect(metFor('made_up', 'light')).toBe(5.0);
  });
});
