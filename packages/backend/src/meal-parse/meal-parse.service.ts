import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { AI_MODEL } from '../ai/azure-openai';
import { localToday } from '../common/day';
import { assertAiConsent } from '../common/ai-consent';
import { giveBackParse, takeParse } from '../common/parse-quota';
import { FoodService } from '../food/food.service';
import { FoodDbService, queryWords } from '../food/food-db.service';
import { searchKey } from '../food/food-text';
import type { NormalizedFood } from '../food/food.types';
import type { NutrientSnapshot } from '../food/nutrients';
import {
  groundItem,
  mealInstructions,
  MEAL_SCHEMA,
  memoryKey,
  sameAsEaten,
  totals,
  type DbMatch,
  type Memory,
  type ModelItem,
} from './meal-parse';
import type { LogParsedMealDto, ParseMealDto } from './meal-parse.dto';

export { DAILY_PARSES } from '../common/parse-quota';
const MAX_ITEMS = 12;

@Injectable()
export class MealParseService {
  private readonly logger = new Logger(MealParseService.name);

  private readonly db: FoodDbService;

  constructor(
    private prisma: PrismaService,
    private food: FoodService,
    private openai: OpenAI,
    @Inject(AI_MODEL) private model: string,
    @Optional() db?: FoodDbService,
  ) {
    this.db = db ?? new FoodDbService(prisma);
  }

  private async resolveUserId(supabaseId: string) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user.id;
  }

  /**
   * The database food for an item, if a good one exists:
   * - branded items: the top branded product whose brand matches;
   * - plain foods: the best measured food whose name has every word the
   *   reading used and whose calories are close to the reading's (so raw
   *   rice isn't used for cooked rice).
   * While GRIT's database is missing products (FOOD_LIVE_SEARCH isn't
   * "off"), a branded item it can't match is looked up live, as before.
   * Any failure falls back to the estimate.
   */
  private async lookupDatabase(
    item: ModelItem,
    country?: string,
  ): Promise<DbMatch | undefined> {
    const name = item.name.trim();
    const brand = item.brand?.trim();
    try {
      if (brand) {
        const branded = await this.db.search(`${brand} ${name}`, {
          kinds: ['branded'],
          country,
          limit: 5,
        });
        const brandWord = queryWords(searchKey(brand))[0] ?? searchKey(brand);
        const hit = branded.find(
          (h) =>
            h.calories > 0 &&
            searchKey(`${h.brand ?? ''} ${h.name}`).includes(brandWord),
        );
        if (hit) return matchOf(hit);
        if (process.env.FOOD_LIVE_SEARCH !== 'off') {
          const live = await this.food.searchLive(`${brand} ${name}`);
          const first = live.find((h) => h.calories > 0);
          if (first) return matchOf(first);
        }
      }

      const words = queryWords(searchKey(name));
      if (!words.length) return undefined;
      const generic = await this.db.search(name, {
        kinds: ['generic', 'dish'],
        country,
        limit: 8,
      });
      const pick = generic.find((h) => {
        const text = searchKey(h.name);
        return (
          h.basis === 'measured' &&
          words.every((w) => text.includes(w)) &&
          sameAsEaten(h.calories, item.kcalPer100g)
        );
      });
      return pick ? matchOf(pick) : undefined;
    } catch (err) {
      // The database being down just means we fall back to the estimate
      this.logger.warn(`Smart log database lookup failed: ${String(err)}`);
      return undefined;
    }
  }

  async parse(supabaseId: string, dto: ParseMealDto, offset: number) {
    const text = dto.text?.trim() ?? '';
    const image = dto.imageBase64?.replace(/\s+/g, '');
    if (!text && !image) {
      throw new BadRequestException('Describe the meal or add a photo');
    }

    const user = await this.prisma.user.findUnique({
      where: { supabaseId },
      select: { id: true, aiConsentAt: true },
    });
    if (!user) throw new NotFoundException('User not found');
    assertAiConsent(user);
    const userId = user.id;
    const today = localToday(offset);
    await takeParse(this.prisma, userId, today);
    const known = await this.prisma.foodMemory.findMany({
      where: { userId },
      orderBy: [{ uses: 'desc' }, { updatedAt: 'desc' }],
      take: 60,
      select: { name: true },
    });

    const content: OpenAI.Responses.ResponseInputContent[] = [
      {
        type: 'input_text',
        text: text || 'What did I eat? (Photo attached.)',
      },
    ];
    if (image) {
      content.push({
        type: 'input_image',
        image_url: `data:${dto.imageType ?? 'image/jpeg'};base64,${image}`,
        detail: 'auto',
      });
    }

    let parsed: {
      items: ModelItem[];
      question: string | null;
      cookingFatUnclear?: boolean;
    };
    try {
      const response = await this.openai.responses.create({
        model: this.model,
        instructions: mealInstructions(known.map((m) => m.name)),
        input: [{ role: 'user', content }],
        max_output_tokens: 6000,
        reasoning: { effort: 'low' },
        store: false,
        text: {
          format: {
            type: 'json_schema',
            name: 'meal',
            strict: true,
            schema: MEAL_SCHEMA as unknown as Record<string, unknown>,
          },
        },
      });
      parsed = JSON.parse(response.output_text) as typeof parsed;
      if (!Array.isArray(parsed.items)) throw new Error('No items');
    } catch (err) {
      this.logger.warn(`Meal parse failed: ${(err as Error).message}`);
      await giveBackParse(this.prisma, userId, today);
      throw new BadGatewayException(
        "Couldn't read that meal right now. Try again, or add it by hand.",
      );
    }

    const modelItems = parsed.items
      .slice(0, MAX_ITEMS)
      .filter((i) => i?.name?.trim());
    const keys = modelItems.map((i) => memoryKey(i.name));
    const memories = await this.prisma.foodMemory.findMany({
      where: { userId, key: { in: [...new Set(keys)] } },
    });
    const byKey = new Map<string, Memory>(
      memories.map((m) => [
        m.key,
        {
          kcal: m.kcalPer100g,
          protein: m.proteinPer100g,
          carbs: m.carbsPer100g,
          fat: m.fatPer100g,
          caffeine: m.caffeinePer100g ?? undefined,
          alcohol: m.alcoholPer100g ?? undefined,
          usualGrams: m.usualGrams,
          foodId: m.foodId,
        },
      ]),
    );
    const database = await Promise.all(
      modelItems.map((i, n) =>
        byKey.has(keys[n])
          ? Promise.resolve(undefined)
          : this.lookupDatabase(i, dto.country),
      ),
    );

    const items = modelItems.map((item, n) => {
      const grounded = groundItem(
        {
          ...item,
          name: item.name.trim().slice(0, 200),
          brand: item.brand?.trim().slice(0, 200) || null,
        },
        byKey.get(keys[n]),
        database[n],
      );
      return { ...grounded, ...totals(grounded.per100, grounded.grams) };
    });
    const total = items.reduce(
      (t, i) => ({
        calories: t.calories + i.calories,
        proteinG: Math.round((t.proteinG + i.proteinG) * 10) / 10,
        carbsG: Math.round((t.carbsG + i.carbsG) * 10) / 10,
        fatG: Math.round((t.fatG + i.fatG) * 10) / 10,
      }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    );
    const question = parsed.question?.trim()
      ? parsed.question.trim().slice(0, 200)
      : null;
    return {
      items,
      total,
      question,
      // The app asks "Cooked in oil?" and adds the oil itself
      cookingFatUnclear: parsed.cookingFatUnclear === true,
    };
  }

  /**
   * Logs the items the user confirmed, and remembers each food's nutrition
   * and portion so the next reading of it starts from their numbers.
   */
  async log(supabaseId: string, dto: LogParsedMealDto) {
    const userId = await this.resolveUserId(supabaseId);
    const loggedAt = dto.loggedAt ? new Date(dto.loggedAt) : new Date();
    // Each matched food's nutrients for the amount eaten, worked out before
    // the transaction; a food that's gone just isn't linked
    const links = await Promise.all(
      dto.items.map((item) => this.foodLink(item.foodId, item.grams)),
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const logs = [];
      for (const [n, item] of dto.items.entries()) {
        const link = links[n];
        const per100 = {
          kcal: item.kcalPer100g,
          protein: item.proteinPer100g,
          carbs: item.carbsPer100g,
          fat: item.fatPer100g,
          caffeine: item.caffeinePer100g,
          alcohol: item.alcoholPer100g,
        };
        const t = totals(per100, item.grams);
        logs.push(
          await tx.foodLog.create({
            data: {
              userId,
              name: item.name,
              brand: item.brand || null,
              mealType: dto.mealType,
              calories: t.calories,
              proteinG: t.proteinG,
              carbsG: t.carbsG,
              fatG: t.fatG,
              servingQty: Math.round(item.grams),
              servingUnit: 'g',
              caffeineMg: t.caffeineMg,
              alcoholG: t.alcoholG,
              loggedAt,
              foodId: link.foodId,
              grams: item.grams,
              nutrients: link.nutrients ?? undefined,
            },
          }),
        );

        const key = memoryKey(item.name);
        if (item.remember === false || !key) continue;
        const values = {
          name: item.name,
          kcalPer100g: per100.kcal,
          proteinPer100g: per100.protein,
          carbsPer100g: per100.carbs,
          fatPer100g: per100.fat,
          caffeinePer100g: per100.caffeine ?? null,
          alcoholPer100g: per100.alcohol ?? null,
          usualGrams: item.grams,
          foodId: link.foodId,
        };
        await tx.foodMemory.upsert({
          where: { userId_key: { userId, key } },
          create: { userId, key, ...values },
          update: { ...values, uses: { increment: 1 } },
        });
      }
      return { logged: logs.length, logs };
    });
    for (const link of links) {
      if (link.foodId) await this.db.countLog(link.foodId);
    }
    return result;
  }

  private async foodLink(
    foodId: string | undefined,
    grams: number,
  ): Promise<{ foodId: string | null; nutrients: NutrientSnapshot | null }> {
    if (!foodId) return { foodId: null, nutrients: null };
    try {
      if (!(await this.db.exists(foodId))) {
        return { foodId: null, nutrients: null };
      }
      return { foodId, nutrients: await this.db.snapshot(foodId, grams) };
    } catch (err) {
      this.logger.warn(`Couldn't link a Smart log item: ${String(err)}`);
      return { foodId: null, nutrients: null };
    }
  }

  /** The foods GRIT has learned, most used first. */
  listMemories(supabaseId: string) {
    return this.resolveUserId(supabaseId).then((userId) =>
      this.prisma.foodMemory.findMany({
        where: { userId },
        orderBy: [{ uses: 'desc' }, { updatedAt: 'desc' }],
        take: 200,
      }),
    );
  }

  async forget(supabaseId: string, id: string) {
    const userId = await this.resolveUserId(supabaseId);
    const { count } = await this.prisma.foodMemory.deleteMany({
      where: { id, userId },
    });
    if (!count) throw new NotFoundException('Food not found');
    return { ok: true };
  }
}

/** What Smart log takes from a database food, per 100 g. */
function matchOf(f: NormalizedFood): DbMatch {
  return {
    kcal: f.calories,
    protein: f.proteinG,
    carbs: f.carbsG,
    fat: f.fatG,
    ...(f.caffeineMg !== undefined ? { caffeine: f.caffeineMg } : {}),
    ...(f.alcoholG !== undefined ? { alcohol: f.alcoholG } : {}),
    ...(f.foodId ? { foodId: f.foodId } : {}),
    ...(f.basis ? { basis: f.basis } : {}),
    ...(f.verified !== undefined ? { verified: f.verified } : {}),
  };
}
