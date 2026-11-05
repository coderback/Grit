import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { AI_MODEL } from '../ai/azure-openai';
import { localToday } from '../common/day';
import { assertAiConsent } from '../common/ai-consent';
import { giveBackParse, takeParse } from '../common/parse-quota';
import { FoodService } from '../food/food.service';
import {
  groundItem,
  mealInstructions,
  MEAL_SCHEMA,
  memoryKey,
  totals,
  type Memory,
  type ModelItem,
  type Per100,
} from './meal-parse';
import type { LogParsedMealDto, ParseMealDto } from './meal-parse.dto';

export { DAILY_PARSES } from '../common/parse-quota';
const MAX_ITEMS = 12;

@Injectable()
export class MealParseService {
  private readonly logger = new Logger(MealParseService.name);

  constructor(
    private prisma: PrismaService,
    private food: FoodService,
    private openai: OpenAI,
    @Inject(AI_MODEL) private model: string,
  ) {}

  private async resolveUserId(supabaseId: string) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user.id;
  }

  /** The first database product with calories for a branded item. */
  private async lookupBranded(item: ModelItem): Promise<Per100 | undefined> {
    if (!item.brand) return undefined;
    try {
      const hits = await this.food.searchFoods(`${item.brand} ${item.name}`);
      const hit = hits.find((h) => h.calories > 0);
      return hit
        ? {
            kcal: hit.calories,
            protein: hit.proteinG,
            carbs: hit.carbsG,
            fat: hit.fatG,
          }
        : undefined;
    } catch {
      // The database being down just means we fall back to the estimate
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
        },
      ]),
    );
    const database = await Promise.all(
      modelItems.map((i, n) =>
        byKey.has(keys[n]) ? Promise.resolve(undefined) : this.lookupBranded(i),
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

    return this.prisma.$transaction(async (tx) => {
      const logs = [];
      for (const item of dto.items) {
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
        };
        await tx.foodMemory.upsert({
          where: { userId_key: { userId, key } },
          create: { userId, key, ...values },
          update: { ...values, uses: { increment: 1 } },
        });
      }
      return { logged: logs.length, logs };
    });
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
