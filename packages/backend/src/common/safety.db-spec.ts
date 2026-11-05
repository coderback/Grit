import type OpenAI from 'openai';
import type { ConfigService } from '@nestjs/config';
import { TestDb } from '../test-utils/db';
import { UsersService } from '../users/users.service';
import { WeightService } from '../progress/weight.service';
import { AdaptiveService } from '../progress/adaptive.service';
import { TrendsService } from '../progress/trends.service';
import { AIService } from '../ai/ai.service';
import { MealParseService } from '../meal-parse/meal-parse.service';
import type { FoodService } from '../food/food.service';

/** A model that must never be called. */
const noModel = {
  responses: {
    create: () => Promise.reject(new Error('the model was called')),
  },
} as unknown as OpenAI;

describe('Safety and consent (database)', () => {
  const db = new TestDb();
  const users = new UsersService(
    db.prisma,
    { get: () => undefined } as unknown as ConfigService,
    new WeightService(db.prisma),
  );
  const adaptive = new AdaptiveService(db.prisma, new TrendsService(db.prisma));
  afterAll(() => db.cleanup());

  it('refuses AI features without consent, and allows them after', async () => {
    const u = await db.user({ aiConsent: false });
    const ai = new AIService(db.prisma, noModel, 'test', adaptive);
    const meals = new MealParseService(
      db.prisma,
      {} as FoodService,
      noModel,
      'test',
    );
    await expect(ai.ensureConsent(u.supabaseId)).rejects.toMatchObject({
      response: { code: 'ai_consent_required' },
    });
    await expect(
      meals.parse(u.supabaseId, { text: 'toast' }, 0),
    ).rejects.toMatchObject({ response: { code: 'ai_consent_required' } });
    // The nudge falls back to fixed text instead of calling the model
    await expect(ai.getNudge(u.supabaseId, 0)).resolves.toMatch(/consistency/);

    await users.setAiConsent(u.supabaseId, true);
    await expect(ai.ensureConsent(u.supabaseId)).resolves.toBeUndefined();
    await users.setAiConsent(u.supabaseId, false);
    await expect(ai.ensureConsent(u.supabaseId)).rejects.toThrow();
  });

  it('keeps targets above the floor for their sex', async () => {
    const u = await db.user();
    await expect(
      users.updateUser(u.supabaseId, { gender: 'male', calorieGoal: 1400 }),
    ).rejects.toThrow('below 1,500 kcal');
    await users.updateUser(u.supabaseId, { gender: 'female' });
    await expect(
      users.updateUser(u.supabaseId, { calorieGoal: 1100 }),
    ).rejects.toThrow('below 1,200 kcal');
    await expect(
      users.updateUser(u.supabaseId, { calorieGoal: 1300 }),
    ).resolves.toMatchObject({ calorieGoal: 1300 });
  });

  it('is for adults only', async () => {
    const u = await db.user();
    const fifteen = new Date();
    fifteen.setUTCFullYear(fifteen.getUTCFullYear() - 15);
    await expect(
      users.updateUser(u.supabaseId, {
        dateOfBirth: fifteen.toISOString(),
      }),
    ).rejects.toThrow('adults aged 18');
  });

  it('turns off weight-loss goals after a yes to the eating-disorder question', async () => {
    const u = await db.user();
    await users.updateUser(u.supabaseId, { primaryGoal: 'lose_weight' });
    const after = await users.updateUser(u.supabaseId, { edScreen: 'yes' });
    expect(after.primaryGoal).toBe('maintain');
    await expect(
      users.updateUser(u.supabaseId, { primaryGoal: 'lose_weight' }),
    ).rejects.toThrow("doesn't set weight-loss goals");
  });

  it('rejects pro-eating-disorder display names', async () => {
    const u = await db.user();
    await expect(
      users.updateUser(u.supabaseId, { displayName: 'thinspo queen' }),
    ).rejects.toThrow("isn't allowed");
  });
});
