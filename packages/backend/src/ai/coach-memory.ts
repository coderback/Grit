/**
 * What the coach remembers between chats: short facts that change how it
 * should coach (an injury, foods avoided, when they can train). The model
 * proposes changes after each message; these helpers decide what's kept.
 */

export const MAX_MEMORIES = 40;
export const MAX_MEMORY_LENGTH = 160;

export interface StoredMemory {
  id: string;
  text: string;
  source: string;
  createdAt: Date;
}

export interface MemoryUpdate {
  add: string[];
  remove: string[];
}

export const MEMORY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['add', 'remove'],
  properties: {
    add: { type: 'array', items: { type: 'string' } },
    remove: { type: 'array', items: { type: 'string' } },
  },
} as const;

export function memoryInstructions(existing: { id: string; text: string }[]) {
  const list = existing.length
    ? existing.map((m) => `- [${m.id}] ${m.text}`).join('\n')
    : '(none yet)';
  return `You keep the long-term notes of a fitness and nutrition coach about one person.

Current notes:
${list}

Read the person's latest message. Return:
- add: new lasting facts worth remembering for future coaching: injuries or health conditions, foods they avoid, dislike or are allergic to, foods they love, their schedule or when they can train, equipment they have, how they like to be coached, life context (shift work, new baby, training for an event). Write each as a short third-person note under 15 words, e.g. "Has a sore left knee; avoid jumping" or "Trains before work, around 6am".
- remove: ids of notes the message makes wrong or out of date (e.g. the knee has healed). If a fact changed, remove the old note and add the new one.

Don't note today's numbers, meals or workouts (the app tracks those), passing moods, questions, or anything already in the notes. Most messages contain nothing new: then return empty lists.`;
}

const key = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Cleans a note: one line, trimmed, within the length limit. */
export function cleanMemory(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, MAX_MEMORY_LENGTH);
}

/**
 * Turns the model's proposal into what to delete and create. Unknown ids
 * are ignored, duplicates skipped, and past the limit the oldest notes the
 * coach took go first (notes the user wrote are kept).
 */
export function planMemoryUpdate(
  existing: StoredMemory[],
  update: MemoryUpdate,
): { remove: string[]; add: string[] } {
  const ids = new Set(existing.map((m) => m.id));
  const remove = new Set(update.remove.filter((id) => ids.has(id)));
  const kept = existing.filter((m) => !remove.has(m.id));
  const seen = new Set(kept.map((m) => key(m.text)));

  const add: string[] = [];
  for (const raw of update.add) {
    const text = cleanMemory(raw);
    const k = key(text);
    if (k.length < 3 || seen.has(k)) continue;
    seen.add(k);
    add.push(text);
  }

  // Over the limit: drop the oldest of the coach's own notes
  let over = kept.length + add.length - MAX_MEMORIES;
  if (over > 0) {
    const oldestFirst = kept
      .filter((m) => m.source !== 'user')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (const m of oldestFirst) {
      if (over <= 0) break;
      remove.add(m.id);
      over--;
    }
    // Still over (all hand-written): add only what fits
    if (over > 0) add.splice(add.length - over, over);
  }
  return { remove: [...remove], add };
}

/** Worth asking the model about: more than a couple of words. */
export function mayHoldFacts(message: string): boolean {
  return message.trim().split(/\s+/).length >= 4;
}
