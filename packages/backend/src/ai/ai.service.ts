import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  addDays,
  dateMarker,
  dayRange,
  localDateOf,
  localToday,
} from '../common/day';
import OpenAI from 'openai';
import { AI_MODEL } from './azure-openai';
import {
  AIM_LABELS,
  DIET_LABELS,
  FOCUS_LABELS,
  FRICTION_LABELS,
} from './profile-labels';
import { macroTargets } from '../common/nutrition';
import { assertAiConsent } from '../common/ai-consent';
import { AdaptiveService } from '../progress/adaptive.service';
import { WorkoutsService } from '../workouts/workouts.service';
import { recoveryLines, summarizeMetrics } from '../health/health.service';
import { CYCLE_METRICS } from '../health/heart-rate';
import {
  MAX_MEMORIES,
  MEMORY_SCHEMA,
  cleanMemory,
  mayHoldFacts,
  memoryInstructions,
  planMemoryUpdate,
  type MemoryUpdate,
} from './coach-memory';

const DAILY_LIMIT = 10;
const FALLBACK_NUDGE = 'Keep showing up — consistency is the whole game.';
// How long a finished reply waits for the note-taking call before moving on
const MEMORY_WAIT_MS = 5000;

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private nudgesInFlight = new Map<string, Promise<string>>();

  constructor(
    private prisma: PrismaService,
    private openai: OpenAI,
    @Inject(AI_MODEL) private model: string,
    private adaptive: AdaptiveService,
    private workouts: WorkoutsService,
  ) {}

  private async resolveUser(supabaseId: string) {
    const user = await this.prisma.user.findUnique({ where: { supabaseId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async buildContext(userId: string, offset: number): Promise<string> {
    const todayDate = localToday(offset);
    const today = dayRange(todayDate, offset).start;
    const weekAgo = dayRange(addDays(todayDate, -7), offset).start;

    const [
      user,
      todayFood,
      weekActivity,
      habits,
      habitLogs,
      healthDays,
      weekFood,
      memories,
      metrics,
    ] = await Promise.all([
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
      // From Apple Health / Health Connect, if connected
      this.prisma.healthDay.findMany({
        where: {
          userId,
          day: {
            gte: dateMarker(addDays(todayDate, -1)),
            lte: dateMarker(todayDate),
          },
        },
      }),
      // The last 7 full days, for averages
      this.prisma.foodLog.findMany({
        where: { userId, loggedAt: { gte: weekAgo, lt: today } },
        select: { loggedAt: true, calories: true, proteinG: true },
      }),
      this.prisma.coachMemory.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: { text: true },
      }),
      // Recovery metrics from the health app; cycle data never reaches the coach
      this.prisma.healthMetric.findMany({
        where: {
          userId,
          day: { gte: dateMarker(addDays(todayDate, -30)) },
          metric: { notIn: [...CYCLE_METRICS] },
        },
        orderBy: { day: 'asc' },
      }),
    ]);

    const todayCalories = todayFood.reduce((s, f) => s + f.calories, 0);
    const todayProtein = todayFood.reduce((s, f) => s + f.proteinG, 0);
    const todayCarbs = todayFood.reduce((s, f) => s + f.carbsG, 0);
    const todayFat = todayFood.reduce((s, f) => s + f.fatG, 0);
    const todayCaffeine = todayFood.reduce(
      (s, f) => s + (f.caffeineMg ?? 0),
      0,
    );
    const todayAlcohol = todayFood.reduce((s, f) => s + (f.alcoholG ?? 0), 0);

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

    const targets = macroTargets(
      user?.calorieGoal ?? 2000,
      user?.goalFocus ?? 'balanced',
    );
    const profileLines = [
      `- Name: ${user?.displayName}`,
      `- Goal: ${user?.primaryGoal}${user?.aim ? ` (main aim: ${AIM_LABELS[user.aim] ?? user.aim})` : ''}`,
      `- Calorie target: ${user?.calorieGoal} kcal/day${user?.earnbackCalories ? ', plus calories burned through exercise' : ''}`,
      `- Macro targets: ${targets.proteinG}g protein, ${targets.carbsG}g carbs, ${targets.fatG}g fat (${FOCUS_LABELS[user?.goalFocus ?? ''] ?? 'balanced'})`,
      `- Weight: ${user?.weightKg ? `${user.weightKg}kg` : 'not set'}${user?.goalWeightKg ? `, goal ${user.goalWeightKg}kg` : ''}${user?.pace ? ` at a ${user.pace} pace` : ''}`,
      user?.dietType && user.dietType !== 'none'
        ? `- Diet: ${DIET_LABELS[user.dietType] ?? user.dietType} (only suggest foods that fit)`
        : null,
      user?.friction
        ? `- Biggest obstacle: ${FRICTION_LABELS[user.friction] ?? user.friction}`
        : null,
      `- Active-minutes goal: ${user?.activeMinutesGoal ?? 60} min/day`,
      user?.edScreen === 'yes'
        ? "- They told GRIT they have or have had an eating disorder. Don't discuss weight loss, calorie cutting or foods as good or bad. Focus on regular, adequate meals, training and how they feel, and gently suggest professional support if eating comes up as a struggle."
        : null,
    ].filter(Boolean);

    const todayHealth = healthDays.find(
      (d) => d.day.toISOString().slice(0, 10) === todayDate,
    );
    const healthLines = [
      todayHealth?.steps != null ? `- Steps today: ${todayHealth.steps}` : null,
      todayHealth?.sleepMinutes != null
        ? `- Sleep last night: ${Math.floor(todayHealth.sleepMinutes / 60)}h ${todayHealth.sleepMinutes % 60}m`
        : null,
      ...recoveryLines(summarizeMetrics(metrics), todayDate),
    ].filter(Boolean);

    // Averages over the days they logged, so unlogged days don't drag them down
    const byDay = new Map<string, { calories: number; protein: number }>();
    for (const f of weekFood) {
      const d = localDateOf(f.loggedAt, offset);
      const day = byDay.get(d) ?? { calories: 0, protein: 0 };
      day.calories += f.calories;
      day.protein += f.proteinG;
      byDay.set(d, day);
    }
    const logged = [...byDay.values()];
    const avg = (pick: (d: { calories: number; protein: number }) => number) =>
      Math.round(logged.reduce((t, d) => t + pick(d), 0) / logged.length);
    const weekLines = logged.length
      ? [
          `- Food logged on ${logged.length} of the last 7 days`,
          `- On those days: ${avg((d) => d.calories)} kcal and ${avg((d) => d.protein)}g protein on average`,
        ]
      : ['- No food logged in the last 7 days'];

    const checkIn = user
      ? await this.adaptive.checkIn(user.supabaseId, offset).catch(() => null)
      : null;
    if (checkIn?.estimate) {
      weekLines.push(
        `- Estimated daily burn from their logs and weigh-ins: ${checkIn.estimate.tdee} kcal`,
      );
    }
    if (checkIn?.suggestion) {
      weekLines.push(
        `- The app is suggesting they change their calorie target to ${checkIn.suggestion.suggested} kcal (they can accept it on the Stats tab)`,
      );
    }

    // What the progression rules say about the next session, and recent PRs
    const strengthLines = user
      ? await this.workouts.coachLines(user, offset).catch(() => [])
      : [];

    const memoryBlock = memories.length
      ? `\nWhat you know about them from earlier chats (use it naturally; don't list it back to them):\n${memories.map((m) => `- ${m.text}`).join('\n')}\n`
      : '';

    return `User profile:
${profileLines.join('\n')}
${memoryBlock}${healthLines.length ? `\nFrom their health app:\n${healthLines.join('\n')}\n` : ''}
Last 7 days:
${weekLines.join('\n')}

Today's nutrition:
- Calories: ${Math.round(todayCalories)} / ${user?.calorieGoal} kcal
- Protein: ${Math.round(todayProtein)}g | Carbs: ${Math.round(todayCarbs)}g | Fat: ${Math.round(todayFat)}g
- Meals logged: ${todayFood.length}${todayCaffeine >= 1 ? `\n- Caffeine: ${Math.round(todayCaffeine)} mg` : ''}${todayAlcohol >= 1 ? `\n- Alcohol: ${Math.round(todayAlcohol)} g` : ''}

Habits today:
${habitLines}

Activity (last 7 days):
${activityLines}${
      strengthLines.length
        ? `\n\nStrength training (the app's progression rules, not your guesses; explain them in these words when asked why a weight changed or held):\n${strengthLines.join('\n')}`
        : ''
    }`;
  }

  private getSystemPrompt(context: string): string {
    return `You are GRIT Coach, a personal fitness and wellness AI inside the GRIT app. You are encouraging, direct, and non-judgmental. You give concise, actionable advice based on the user's real data.

${context}

Keep responses to 2–4 sentences unless detail is needed. Reference specific numbers from their data when relevant. Never shame food choices or missed habits — always frame positively. Suggest one concrete next action when appropriate.

Safety rules, which always apply:
- You are an AI coach, not a doctor, dietitian, nutritionist or therapist. Never say or imply you are one.
- Don't diagnose conditions or interpret symptoms, lab results, blood pressure or glucose as medical findings. Suggest they speak to a doctor or pharmacist instead.
- Don't give medication advice: no doses, timing or changes for any medicine, including GLP-1 drugs and supplements taken as treatment.
- Never suggest eating below the target the app has set, skipping meals to compensate, or making up for food with exercise.
- If they mention self-harm, suicidal thoughts, purging, or being unable to stop restricting or bingeing, respond with warmth, don't coach, and encourage them to contact local emergency services or a crisis or eating disorder helpline, or their doctor.`;
  }

  /**
   * Saves the user's message if they are under today's limit. The count and
   * insert run under a per-user lock, so parallel requests can't all slip
   * past the limit.
   */
  private async saveUserMessage(
    userId: string,
    content: string,
    offset: number,
  ): Promise<void> {
    const { start: today, end: tomorrow } = dayRange(
      localToday(offset),
      offset,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ai:${userId}`}))`;

      const count = await tx.aIMessage.count({
        where: {
          userId,
          role: 'user',
          createdAt: { gte: today, lt: tomorrow },
        },
      });
      if (count >= DAILY_LIMIT) {
        throw new HttpException(
          'Daily message limit reached (10/day)',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      await tx.aIMessage.create({ data: { userId, role: 'user', content } });
    });
  }

  /** Throws a 403 the app understands if the user hasn't allowed AI features. */
  async ensureConsent(supabaseId: string) {
    assertAiConsent(await this.resolveUser(supabaseId));
  }

  async *streamMessage(
    supabaseId: string,
    userMessage: string,
    offset: number,
  ): AsyncGenerator<{ type: string; text?: string; items?: string[] }> {
    const user = await this.resolveUser(supabaseId);
    assertAiConsent(user);
    await this.saveUserMessage(user.id, userMessage, offset);
    // Note-taking runs alongside the reply; it never holds the reply up
    const noting = mayHoldFacts(userMessage)
      ? this.updateMemories(user.id, userMessage).catch((err: Error) => {
          this.logger.warn(`Coach memory update failed: ${err.message}`);
          return [] as string[];
        })
      : Promise.resolve([] as string[]);

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

    let finished = false;
    for await (const event of stream) {
      if (event.type === 'response.output_text.delta') {
        fullResponse += event.delta;
        yield { type: 'delta', text: event.delta };
      } else if (
        event.type === 'response.completed' ||
        event.type === 'response.incomplete'
      ) {
        finished = true;
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

    // Tell the app what was noted, if the notes are ready by now
    const noted = await Promise.race([
      noting,
      new Promise<string[]>((r) => setTimeout(() => r([]), MEMORY_WAIT_MS)),
    ]);
    if (noted.length) yield { type: 'remembered', items: noted };
    if (finished) yield { type: 'done' };
  }

  /**
   * Asks the model whether the message holds anything worth remembering,
   * and applies its answer. Returns the notes added.
   */
  async updateMemories(userId: string, message: string): Promise<string[]> {
    const existing = await this.prisma.coachMemory.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    const response = await this.openai.responses.create({
      model: this.model,
      instructions: memoryInstructions(existing),
      input: message,
      max_output_tokens: 2000,
      reasoning: { effort: 'low' },
      store: false,
      text: {
        format: {
          type: 'json_schema',
          name: 'coach_notes',
          strict: true,
          schema: MEMORY_SCHEMA as unknown as Record<string, unknown>,
        },
      },
    });
    const update = JSON.parse(response.output_text) as MemoryUpdate;
    const plan = planMemoryUpdate(existing, {
      add: Array.isArray(update.add) ? update.add.map(String) : [],
      remove: Array.isArray(update.remove) ? update.remove.map(String) : [],
    });
    if (!plan.add.length && !plan.remove.length) return [];
    await this.prisma.$transaction([
      this.prisma.coachMemory.deleteMany({
        where: { userId, id: { in: plan.remove } },
      }),
      this.prisma.coachMemory.createMany({
        data: plan.add.map((text) => ({ userId, text, source: 'chat' })),
      }),
    ]);
    return plan.add;
  }

  async listMemories(supabaseId: string) {
    const user = await this.resolveUser(supabaseId);
    return this.prisma.coachMemory.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, text: true, source: true, createdAt: true },
    });
  }

  /** A note the user writes themselves; these are never dropped automatically. */
  async addMemory(supabaseId: string, text: string) {
    const user = await this.resolveUser(supabaseId);
    const existing = await this.prisma.coachMemory.findMany({
      where: { userId: user.id },
    });
    const plan = planMemoryUpdate(existing, { add: [text], remove: [] });
    if (!plan.add.length) {
      throw new HttpException(
        existing.length >= MAX_MEMORIES
          ? 'Your coach is full: delete a note first'
          : 'Your coach already knows that',
        HttpStatus.CONFLICT,
      );
    }
    const [, created] = await this.prisma.$transaction([
      this.prisma.coachMemory.deleteMany({
        where: { userId: user.id, id: { in: plan.remove } },
      }),
      this.prisma.coachMemory.create({
        data: { userId: user.id, text: cleanMemory(text), source: 'user' },
        select: { id: true, text: true, source: true, createdAt: true },
      }),
    ]);
    return created;
  }

  async deleteMemory(supabaseId: string, id: string) {
    const user = await this.resolveUser(supabaseId);
    const { count } = await this.prisma.coachMemory.deleteMany({
      where: { id, userId: user.id },
    });
    if (!count) throw new NotFoundException('Note not found');
    return { ok: true };
  }

  async clearMemories(supabaseId: string) {
    const user = await this.resolveUser(supabaseId);
    const { count } = await this.prisma.coachMemory.deleteMany({
      where: { userId: user.id },
    });
    return { deleted: count };
  }

  async getMessages(supabaseId: string) {
    const user = await this.resolveUser(supabaseId);
    // The latest 50, returned oldest first for display
    const messages = await this.prisma.aIMessage.findMany({
      where: { userId: user.id, content: { not: { startsWith: '[NUDGE]' } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, role: true, content: true, createdAt: true },
    });
    return messages.reverse();
  }

  async getNudge(supabaseId: string, offset: number): Promise<string> {
    const user = await this.resolveUser(supabaseId);
    // Without permission to use the AI, a fixed nudge instead of a model call
    if (!user.aiConsentAt) return FALLBACK_NUDGE;

    // Several screens ask for the nudge at once on launch; generate it once
    const pending = this.nudgesInFlight.get(user.id);
    if (pending) return pending;

    const nudge = this.findOrCreateNudge(user.id, offset).finally(() =>
      this.nudgesInFlight.delete(user.id),
    );
    this.nudgesInFlight.set(user.id, nudge);
    return nudge;
  }

  private async findOrCreateNudge(
    userId: string,
    offset: number,
  ): Promise<string> {
    const today = dayRange(localToday(offset), offset).start;

    const existing = await this.prisma.aIMessage.findFirst({
      where: {
        userId,
        role: 'assistant',
        content: { startsWith: '[NUDGE]' },
        createdAt: { gte: today },
      },
    });

    if (existing) {
      return existing.content.replace('[NUDGE] ', '');
    }

    const context = await this.buildContext(userId, offset);
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

    const nudgeText = response.output_text.trim() || FALLBACK_NUDGE;

    await this.prisma.aIMessage.create({
      data: {
        userId,
        role: 'assistant',
        content: `[NUDGE] ${nudgeText}`,
      },
    });

    return nudgeText;
  }
}
