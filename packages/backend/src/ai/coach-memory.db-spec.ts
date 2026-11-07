import type OpenAI from 'openai';
import { TestDb } from '../test-utils/db';
import { AdaptiveService } from '../progress/adaptive.service';
import { TrendsService } from '../progress/trends.service';
import { AIService } from './ai.service';
import type { WorkoutsService } from '../workouts/workouts.service';
import { addDays, dayRange, localToday } from '../common/day';

// The coach's strength lines aren't what these tests are about
const noWorkouts = {
  coachLines: () => Promise.resolve([]),
} as unknown as WorkoutsService;

/**
 * A model that streams a fixed reply for chat requests and returns `notes`
 * for note-taking requests, recording what it was asked.
 */
function fakeModel(notes: unknown) {
  const calls: { instructions: string; stream?: boolean }[] = [];
  const client = {
    responses: {
      create: (req: { instructions: string; stream?: boolean }) => {
        calls.push(req);
        if (req.stream) {
          return Promise.resolve(
            (async function* () {
              await Promise.resolve();
              yield { type: 'response.output_text.delta', delta: 'Got it. ' };
              yield {
                type: 'response.output_text.delta',
                delta: 'Low impact today.',
              };
              yield { type: 'response.completed' };
            })(),
          );
        }
        return Promise.resolve({ output_text: JSON.stringify(notes) });
      },
    },
  } as unknown as OpenAI;
  return { client, calls };
}

async function collect<T>(gen: AsyncGenerator<T>) {
  const out: T[] = [];
  for await (const x of gen) out.push(x);
  return out;
}

describe('Coach memory (database)', () => {
  const db = new TestDb();
  const adaptive = new AdaptiveService(db.prisma, new TrendsService(db.prisma));
  afterAll(() => db.cleanup());

  it('notes facts from a chat, tells the app, and uses them next time', async () => {
    const u = await db.user();
    const { client, calls } = fakeModel({
      add: ['Has a sore left knee; avoid jumping'],
      remove: [],
    });
    const ai = new AIService(db.prisma, client, 'test', adaptive, noWorkouts);

    const events = await collect(
      ai.streamMessage(u.supabaseId, 'My left knee hurts when I jump', 0),
    );
    expect(events.map((e) => e.type)).toEqual([
      'delta',
      'delta',
      'remembered',
      'done',
    ]);
    expect(events[2].items).toEqual(['Has a sore left knee; avoid jumping']);

    const notes = await ai.listMemories(u.supabaseId);
    expect(notes.map((n) => [n.text, n.source])).toEqual([
      ['Has a sore left knee; avoid jumping', 'chat'],
    ]);

    // The next reply's instructions carry the note
    await collect(ai.streamMessage(u.supabaseId, 'What should I do today?', 0));
    const chat = calls.filter((c) => c.stream).pop()!;
    expect(chat.instructions).toContain('Has a sore left knee; avoid jumping');
    // and the note-taker sees it with its id, so it can remove it later
    const noteTaker = calls.filter((c) => !c.stream).pop()!;
    expect(noteTaker.instructions).toContain(`[${notes[0].id}]`);
  });

  it('replaces a note the user contradicts', async () => {
    const u = await db.user();
    const old = await db.prisma.coachMemory.create({
      data: { userId: u.id, text: 'Has a sore left knee' },
    });
    const { client } = fakeModel({
      add: ['Knee has healed; back to running'],
      remove: [old.id],
    });
    const ai = new AIService(db.prisma, client, 'test', adaptive, noWorkouts);
    await ai.updateMemories(u.id, 'My knee is all better now, running again');
    expect((await ai.listMemories(u.supabaseId)).map((n) => n.text)).toEqual([
      'Knee has healed; back to running',
    ]);
  });

  it("doesn't ask about short messages, and skips the event when nothing is new", async () => {
    const u = await db.user();
    const { client, calls } = fakeModel({ add: [], remove: [] });
    const ai = new AIService(db.prisma, client, 'test', adaptive, noWorkouts);
    const short = await collect(ai.streamMessage(u.supabaseId, 'thanks!', 0));
    expect(short.map((e) => e.type)).toEqual(['delta', 'delta', 'done']);
    expect(calls.filter((c) => !c.stream)).toHaveLength(0);

    const long = await collect(
      ai.streamMessage(u.supabaseId, 'How much protein should I eat?', 0),
    );
    expect(long.map((e) => e.type)).not.toContain('remembered');
    expect(calls.filter((c) => !c.stream)).toHaveLength(1);
  });

  it('lets the user add, delete and clear notes', async () => {
    const u = await db.user();
    const ai = new AIService(
      db.prisma,
      fakeModel({}).client,
      'test',
      adaptive,
      noWorkouts,
    );
    const note = await ai.addMemory(u.supabaseId, '  Allergic to   peanuts ');
    expect([note.text, note.source]).toEqual(['Allergic to peanuts', 'user']);
    await expect(
      ai.addMemory(u.supabaseId, 'allergic to peanuts'),
    ).rejects.toThrow('already knows');

    const other = await db.user();
    await expect(ai.deleteMemory(other.supabaseId, note.id)).rejects.toThrow(
      'Note not found',
    );
    await ai.deleteMemory(u.supabaseId, note.id);
    await ai.addMemory(u.supabaseId, 'Trains at lunch');
    await ai.addMemory(u.supabaseId, 'Has dumbbells at home');
    expect(await ai.clearMemories(u.supabaseId)).toEqual({ deleted: 2 });
  });

  it("gives the coach the week's averages over logged days", async () => {
    const u = await db.user();
    const day = (n: number) => new Date(Date.now() - n * 86_400_000);
    await db.prisma.foodLog.createMany({
      data: [
        {
          userId: u.id,
          name: 'a',
          mealType: 'lunch',
          calories: 1500,
          proteinG: 80,
          loggedAt: day(1),
        },
        {
          userId: u.id,
          name: 'b',
          mealType: 'dinner',
          calories: 500,
          proteinG: 40,
          loggedAt: day(1),
        },
        {
          userId: u.id,
          name: 'c',
          mealType: 'lunch',
          calories: 1800,
          proteinG: 100,
          loggedAt: day(3),
        },
      ],
    });
    const { client, calls } = fakeModel({ add: [], remove: [] });
    const ai = new AIService(db.prisma, client, 'test', adaptive, noWorkouts);
    await collect(ai.streamMessage(u.supabaseId, 'hi', 0));
    const chat = calls.find((c) => c.stream)!;
    expect(chat.instructions).toContain('Food logged on 2 of the last 7 days');
    expect(chat.instructions).toContain(
      '1900 kcal and 110g protein on average',
    );
    // No nutrient data: nothing to say about vitamins and minerals
    expect(chat.instructions).not.toContain('Often low');
    expect(chat.instructions).not.toContain('No nutrients were often low');
  });

  it('tells the coach which nutrients were often low, in plain words', async () => {
    const u = await db.user();
    await db.prisma.user.update({
      where: { id: u.id },
      data: {
        gender: 'female',
        dateOfBirth: new Date('1990-05-01T00:00:00Z'),
        calorieGoal: 2000,
        dietType: 'vegetarian',
      },
    });
    const today = localToday(0);
    const at = (daysAgo: number, hour: number) =>
      new Date(
        dayRange(addDays(today, -daysAgo), 0).start.getTime() +
          hour * 3_600_000,
      );
    const measured = (values: Record<string, number>) =>
      Object.fromEntries(
        Object.entries(values).map(([code, amount]) => [
          code,
          { amount, basis: 'measured' },
        ]),
      );
    // Three fully logged days with iron and fibre well under target
    for (const n of [1, 2, 3]) {
      await db.prisma.foodLog.createMany({
        data: [
          ['White toast', 300, { iron_mg: 1.0, fibre_g: 2.4 }],
          ['Cheddar', 400, { iron_mg: 0.2, calcium_mg: 720 }],
          ['Pasta', 500, { iron_mg: 1.5, fibre_g: 3 }],
        ].map(([name, calories, values], i) => ({
          userId: u.id,
          name: name as string,
          mealType: 'lunch',
          calories: calories as number,
          loggedAt: at(n, 8 + i),
          nutrients: measured(values as Record<string, number>),
        })),
      });
    }
    // Today: half the calories have vitamin or mineral data
    await db.prisma.foodLog.createMany({
      data: [
        {
          userId: u.id,
          name: 'Oats',
          mealType: 'breakfast',
          calories: 300,
          loggedAt: at(0, 0),
          nutrients: measured({ iron_mg: 3 }),
        },
        {
          userId: u.id,
          name: 'Sandwich',
          mealType: 'lunch',
          calories: 300,
          loggedAt: at(0, 0),
        },
      ],
    });

    const { client, calls } = fakeModel({ add: [], remove: [] });
    const ai = new AIService(db.prisma, client, 'test', adaptive, noWorkouts);
    await collect(ai.streamMessage(u.supabaseId, 'hi', 0));
    const { instructions } = calls.find((c) => c.stream)!;

    const line = instructions
      .split('\n')
      .find((l) => l.startsWith('- Often low'))!;
    expect(line).toBe(
      '- Often low on days with enough food data (measured values only): iron (3 of 3 days, about 15% of 18 mg), fibre (3 of 3 days, about 22% of 25 g). If it comes up, suggest everyday foods that fit their diet; say "low", never "deficient"; don\'t suggest supplements.',
    );
    // It sits with the week's lines, after the averages
    expect(instructions.indexOf(line)).toBeGreaterThan(
      instructions.indexOf('Last 7 days:'),
    );
    expect(instructions.indexOf(line)).toBeLessThan(
      instructions.indexOf("Today's nutrition:"),
    );
    // The data itself is plain: no diagnoses, and nothing about cycles
    const data = line.split('. If it comes up')[0];
    expect(data).not.toMatch(/deficien|diagnos|anaemi|anemi|supplement/i);
    expect(instructions).not.toMatch(/menstrua|period/i);
    expect(instructions).toContain(
      "- Vitamin and mineral data (measured values only) covers 50% of today's calories",
    );
  });
});
