import {
  Injectable, NotFoundException, HttpException, HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import Anthropic from '@anthropic-ai/sdk';

const DAILY_LIMIT = 10;
const MODEL = 'claude-sonnet-4-20250514';

@Injectable()
export class AIService {
  private anthropic: Anthropic;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: config.getOrThrow<string>('ANTHROPIC_API_KEY'),
    });
  }

  private async resolveUser(supabaseId: string) {
    const user = await this.prisma.user.findUnique({ where: { supabaseId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async buildContext(userId: string): Promise<string> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);

    const [user, todayFood, weekActivity, habits, habitLogs] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.foodLog.findMany({ where: { userId, loggedAt: { gte: today } } }),
      this.prisma.activityLog.findMany({
        where: { userId, loggedAt: { gte: weekAgo } },
        orderBy: { loggedAt: 'desc' },
        take: 10,
      }),
      this.prisma.habit.findMany({ where: { userId, isActive: true } }),
      this.prisma.habitLog.findMany({ where: { userId, loggedAt: { gte: today } } }),
    ]);

    const todayCalories = todayFood.reduce((s, f) => s + f.calories, 0);
    const todayProtein = todayFood.reduce((s, f) => s + f.proteinG, 0);
    const todayCarbs = todayFood.reduce((s, f) => s + f.carbsG, 0);
    const todayFat = todayFood.reduce((s, f) => s + f.fatG, 0);

    const completedHabitIds = new Set(habitLogs.map((l) => l.habitId));

    const habitLines = habits.length > 0
      ? habits.map((h) => `- ${h.emoji} ${h.name}: ${completedHabitIds.has(h.id) ? 'done' : 'pending'}`).join('\n')
      : '- No habits set up';

    const activityLines = weekActivity.length > 0
      ? weekActivity.map((a) => `- ${a.loggedAt.toISOString().split('T')[0]}: ${a.activityType}, ${a.durationMin} min`).join('\n')
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

  private async checkRateLimit(userId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const count = await this.prisma.aIMessage.count({
      where: { userId, role: 'user', createdAt: { gte: today, lt: tomorrow } },
    });

    if (count >= DAILY_LIMIT) {
      throw new HttpException('Daily message limit reached (10/day)', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  async *streamMessage(
    supabaseId: string,
    userMessage: string,
  ): AsyncGenerator<{ type: string; text?: string }> {
    const user = await this.resolveUser(supabaseId);
    await this.checkRateLimit(user.id);

    await this.prisma.aIMessage.create({
      data: { userId: user.id, role: 'user', content: userMessage },
    });

    const history = await this.prisma.aIMessage.findMany({
      where: { userId: user.id, content: { not: { startsWith: '[NUDGE]' } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    history.reverse();

    const context = await this.buildContext(user.id);
    const systemPrompt = this.getSystemPrompt(context);

    const messages = history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    let fullResponse = '';

    const stream = await this.anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [
        {
          type: 'text' as const,
          text: systemPrompt,
          // @ts-ignore — prompt caching field
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages,
      stream: true,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullResponse += event.delta.text;
        yield { type: 'delta', text: event.delta.text };
      } else if (event.type === 'message_stop') {
        yield { type: 'done' };
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

  async getNudge(supabaseId: string): Promise<string> {
    const user = await this.resolveUser(supabaseId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

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

    const context = await this.buildContext(user.id);
    const systemPrompt = this.getSystemPrompt(context);

    const response = await this.anthropic.messages.create({
      model: MODEL,
      max_tokens: 120,
      system: [
        {
          type: 'text' as const,
          text: systemPrompt,
          // @ts-ignore — prompt caching field
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: 'Give me a short motivational nudge based on my data right now. 1–2 sentences max, no questions.',
        },
      ],
    });

    const nudgeText =
      response.content[0].type === 'text'
        ? response.content[0].text
        : 'Keep showing up — consistency is the whole game.';

    await this.prisma.aIMessage.create({
      data: { userId: user.id, role: 'assistant', content: `[NUDGE] ${nudgeText}` },
    });

    return nudgeText;
  }
}
