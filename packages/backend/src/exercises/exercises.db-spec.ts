import type OpenAI from 'openai';
import { TestDb } from '../test-utils/db';
import { ExercisesService } from './exercises.service';
import { WorkoutPlanService } from '../workout-plan/workout-plan.service';

describe('Exercise library (database)', () => {
  const db = new TestDb();
  const exercises = new ExercisesService(db.prisma);
  beforeAll(() => exercises.seed(), 60_000);
  afterAll(() => db.cleanup());

  it('loads the library and searches it', async () => {
    expect(await db.prisma.exercise.count()).toBeGreaterThan(800);
    const squats = await exercises.search('squat', undefined, 'barbell');
    expect(squats.length).toBeGreaterThan(5);
    expect(squats.every((e) => e.equipment.includes('barbell'))).toBe(true);
    const legs = await exercises.search(undefined, 'quadriceps');
    expect(legs.every((e) => e.primary.includes('quadriceps'))).toBe(true);
    await expect(exercises.get('nope')).rejects.toThrow('Exercise not found');
  });

  it('shortlists for home, level and injuries', async () => {
    const home = await exercises.shortlist({
      location: 'home',
      activityLevel: 'sedentary',
      notes: [],
    });
    expect(home.length).toBeGreaterThan(10);
    expect(home.every((e) => e.equipment.includes('bodyweight'))).toBe(true);
    // Common movements first
    expect(home[0].id).toBe('Bodyweight_Squat');

    const gym = await exercises.shortlist({
      location: 'gym',
      activityLevel: 'active',
      notes: ['Has a sore left knee; avoid jumping'],
    });
    const ids = gym.map((e) => e.id);
    expect(ids).toContain('Barbell_Deadlift');
    expect(ids).not.toContain('Barbell_Squat');
    expect(ids).not.toContain('Dumbbell_Lunges');
    expect(ids).not.toContain('Running_Treadmill');
    expect(gym.length).toBeLessThanOrEqual(80);
  });

  it('builds plans only from the shortlist', async () => {
    const u = await db.user();
    await db.prisma.user.update({
      where: { id: u.id },
      data: { activityLevel: 'active' },
    });
    await db.prisma.coachMemory.create({
      data: { userId: u.id, text: 'Lower back pain; no heavy deadlifts' },
    });
    let instructions = '';
    const model = {
      responses: {
        create: (req: { instructions: string }) => {
          instructions = req.instructions;
          return Promise.resolve({
            output_text: JSON.stringify({
              summary: 'Three full-body days.',
              days: [
                {
                  day: 'mon',
                  rest: false,
                  title: 'Full body',
                  activityType: 'strength_training',
                  durationMin: 45,
                  exercises: [
                    { exerciseId: 'Leg_Press', detail: '3 × 10' },
                    { exerciseId: 'Barbell_Deadlift', detail: '3 × 5' },
                    { exerciseId: 'Pushups', detail: '3 × 12' },
                  ],
                },
              ],
            }),
          });
        },
      },
    } as unknown as OpenAI;
    const plans = new WorkoutPlanService(db.prisma, model, 'test', exercises);
    const plan = await plans.generate(
      u.supabaseId,
      { daysPerWeek: 3, location: 'gym' },
      0,
    );
    // The back note keeps deadlifts off the list the model sees
    expect(instructions).toContain('Leg_Press: Leg Press');
    expect(instructions).not.toContain('Barbell_Deadlift:');
    const monday = (
      plan.days as { exercises: { exerciseId?: string; name: string }[] }[]
    )[0];
    // ...and an id the model made up anyway is dropped
    expect(monday.exercises).toEqual([
      { exerciseId: 'Leg_Press', name: 'Leg Press', detail: '3 × 10' },
      { exerciseId: 'Pushups', name: 'Pushups', detail: '3 × 12' },
    ]);
  });
});
