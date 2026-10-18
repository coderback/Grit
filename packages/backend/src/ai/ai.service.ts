import {
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  addDays,
  dateMarker,
  dayRange,
  localDateOf,
  localToday,
} from '../common/day';
import OpenAI from 'openai';

const DAILY_LIMIT = 10;
const DEFAULT_DEPLOYMENT = 'gpt-6-luna';

// Accepts the resource endpoint as shown in the Foundry portal and points it at
// Azure's OpenAI-compatible v1 API, which the standard OpenAI client can call directly.
function toV1BaseUrl(endpoint: string): string {
  const base = endpoint.replace(/\/+$/, '');
  return base.endsWith('/openai/v1') ? `${base}/` : `${base}/openai/v1/`;
}

@Injectable()
export class AIService {
  private openai: OpenAI;
  private model: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.openai = new OpenAI({
      apiKey: config.getOrThrow<string>('AZURE_OPENAI_API_KEY'),
      baseURL: toV1BaseUrl(config.getOrThrow<string>('AZURE_OPENAI_ENDPOINT')),
    });
    // On Azure the model field is the deployment name, not the catalog model ID
    this.model =
      config.get<string>('AZURE_OPENAI_DEPLOYMENT') ?? DEFAULT_DEPLOYMENT;
  }

  private async resolveUser(supabaseId: string) {
    const user = await this.prisma.user.findUnique({ where: { supabaseId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async buildContext(userId: string, offset: number): Promise<string> {
    const todayDate = localToday(offset);
    const today = dayRange(todayDate, offset).start;
    const weekAgo = dayRange(addDays(todayDate, -7), offset).start;

    const [user, todayFood, weekActivity, habits, habitLogs] =
      await Promise.all([
        this.prisma.user.findUnique({ where: { id: userId } }),
        this.prisma.foodLog.findMany({
          where: { userId, loggedAt: { gte: today } },
        }),
        this.prisma.activityLog.findMany({
          where: { userId, loggedAt: { gte: weekAgo } },
          orderBy: { loggedAt: 'desc' },
          take: 10,
        }),
        this.prisma.habit.findMany({ where: { userId, isActive: true } }),
        this.prisma.habitLog.findMany({
          where: { userId, loggedAt: dateMarker(todayDate) },
        }),
      ]);

    const todayCalories = todayFood.reduce((s, f) => s + f.calories, 0);
    const todayProtein = todayFood.reduce((s, f) => s + f.proteinG, 0);
    const todayCarbs = todayFood.reduce((s, f) => s + f.carbsG, 0);
    const todayFat = todayFood.reduce((s, f) => s + f.fatG, 0);

    const completedHabitIds = new Set(habitLogs.map((l) => l.habitId));

    const habitLines =
      habits.length > 0
        ? habits
            .map(
              (h) =>
                `- ${h.emoji} ${h.name}: ${completedHabitIds.has(h.id) ? 'done' : 'pending'}`,
            )
            .join('\n')
        : '- No habits set up';

    const activityLines =
      weekActivity.length > 0
        ? weekActivity
            .map(
              (a) =>
                `- ${localDateOf(a.loggedAt, offset)}: ${a.activityType}, ${a.durationMin} min`,
            )
            .join('\n')
        : '- No activity logged this week';

    return `User profile:
- Name: ${user?.displayName}
- Goal: ${user?.primaryGoal}
- Calorie target: ${user?.calorieGoal} kcal/day
- Weight: ${user?.weightKg ? `${user.weightKg}kg` : 'not set'}

Today's nutrition:
- Calories: ${Math.round(todayCalories)} / ${user?.calorieGoal} kcal
- Protein: ${Math.round(todayProtein)}g | Carbs: ${Math.round(todayCarbs)}g | Fat: ${Math.round(todayFat)}g
- Meals logged: ${todayFood.length}

Habits today:
${habitLines}

Activity (last 7 days):
${activityLines}`;
  }

  private getSystemPrompt(context: string): string {
    return `You are GRIT Coach, a personal fitness and wellness AI inside the GRIT app. You are encouraging, direct, and non-judgmental. You give concise, actionable advice based on the user's real data.

${context}

Keep responses to 2–4 sentences unless detail is needed. Reference specific numbers from their data when relevant. Never shame food choices or missed habits — always frame positively. Suggest one concrete next action when appropriate.`;
  }

  private async checkRateLimit(userId: string, offset: number): Promise<void> {
    const { start: today, end: tomorrow } = dayRange(
      localToday(offset),
      offset,
    );

    const count = await this.prisma.aIMessage.count({
      where: { userId, role: 'user', createdAt: { gte: today, lt: tomorrow } },
    });

    if (count >= DAILY_LIMIT) {
      throw new HttpException(
        'Daily message limit reached (10/day)',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async *streamMessage(
    supabaseId: string,
    userMessage: string,
    offset: number,
  ): AsyncGenerator<{ type: string; text?: string }> {
    const user = await this.resolveUser(supabaseId);
    await this.checkRateLimit(user.id, offset);

    await this.prisma.aIMessage.create({
      data: { userId: user.id, role: 'user', content: userMessage },
    });

    const history = await this.prisma.aIMessage.findMany({
      where: { userId: user.id, content: { not: { startsWith: '[NUDGE]' } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    history.reverse();

    const context = await this.buildContext(user.id, offset);
    const systemPrompt = this.getSystemPrompt(context);

    const messages = history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    let fullResponse = '';

    const stream = await this.openai.responses.create({
      model: this.model,
      instructions: systemPrompt,
      input: messages,
      // Reasoning tokens count toward this cap, so leave headroom beyond the visible reply
      max_output_tokens: 4096,
      reasoning: { effort: 'low' },
      store: false,
      stream: true,
    });

    for await (const event of stream) {
      if (event.type === 'response.output_text.delta') {
        fullResponse += event.delta;
        yield { type: 'delta', text: event.delta };
      } else if (
        event.type === 'response.completed' ||
        event.type === 'response.incomplete'
      ) {
        yield { type: 'done' };
      } else if (event.type === 'response.failed') {
        throw new Error(event.response.error?.message ?? 'AI response failed');
      } else if (event.type === 'error') {
        throw new Error(event.message);
      }
    }

    if (fullResponse) {
      await this.prisma.aIMessage.create({
        data: { userId: user.id, role: 'assistant', content: fullResponse },
      });
    }
  }

  async getMessages(supabaseId: string) {
    const user = await this.resolveUser(supabaseId);
    return this.prisma.aIMessage.findMany({
      where: { userId: user.id, content: { not: { startsWith: '[NUDGE]' } } },
      orderBy: { createdAt: 'asc' },
      take: 50,
      select: { id: true, role: true, content: true, createdAt: true },
    });
  }

  async getNudge(supabaseId: string, offset: number): Promise<string> {
    const user = await this.resolveUser(supabaseId);

    const today = dayRange(localToday(offset), offset).start;

    const existing = await this.prisma.aIMessage.findFirst({
      where: {
        userId: user.id,
        role: 'assistant',
        content: { startsWith: '[NUDGE]' },
        createdAt: { gte: today },
      },
    });

    if (existing) {
      return existing.content.replace('[NUDGE] ', '');
    }

    const context = await this.buildContext(user.id, offset);
    const systemPrompt = this.getSystemPrompt(context);

    const response = await this.openai.responses.create({
      model: this.model,
      instructions: systemPrompt,
      input:
        'Give me a short motivational nudge based on my data right now. 1–2 sentences max, no questions.',
      // Reasoning tokens count toward this cap, so a small value can leave no visible text
      max_output_tokens: 2048,
      reasoning: { effort: 'low' },
      store: false,
    });

    const nudgeText =
      response.output_text.trim() ||
      'Keep showing up — consistency is the whole game.';

    await this.prisma.aIMessage.create({
      data: {
        userId: user.id,
        role: 'assistant',
        content: `[NUDGE] ${nudgeText}`,
      },
    });

    return nudgeText;
  }
}
