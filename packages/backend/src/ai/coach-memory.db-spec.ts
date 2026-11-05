import type OpenAI from 'openai';
import { TestDb } from '../test-utils/db';
import { AdaptiveService } from '../progress/adaptive.service';
import { TrendsService } from '../progress/trends.service';
import { AIService } from './ai.service';
import type { WorkoutsService } from '../workouts/workouts.service';

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
  });
});
