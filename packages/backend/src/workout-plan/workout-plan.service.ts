import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { localToday } from '../common/day';
import { ACTIVITY_TYPES } from '../activity/activity.constants';
import { AI_MODEL } from '../ai/azure-openai';
import { AIM_LABELS, FRICTION_LABELS } from '../ai/profile-labels';
import { defaultDaysPerWeek, normalizePlanDays } from './plan-days';
import {
  WEEKDAYS,
  type GeneratePlanDto,
  type PlanDayContentDto,
  type Weekday,
} from './workout-plan.dto';

// Generating costs a model call, so cap it per user per day
const DAILY_GENERATIONS = 5;

// Strict JSON schema for the model's reply; the result is validated again after
const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'days'],
  properties: {
    summary: { type: 'string' },
    days: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'day',
          'rest',
          'title',
          'activityType',
          'durationMin',
          'exercises',
        ],
        properties: {
          day: { type: 'string', enum: [...WEEKDAYS] },
          rest: { type: 'boolean' },
          title: { type: 'string' },
          activityType: { type: 'string', enum: [...ACTIVITY_TYPES] },
          durationMin: { type: 'integer' },
          exercises: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'detail'],
              properties: {
                name: { type: 'string' },
                detail: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
} as const;

const GOAL_LABELS: Record<string, string> = {
  lose_weight: 'lose weight',
  build_muscle: 'build muscle',
  maintain: 'maintain weight',
  recomp: 'lose fat and gain muscle',
};

const ACTIVITY_LEVEL_LABELS: Record<string, string> = {
  sedentary: 'sedentary',
  lightly_active: 'lightly active',
  active: 'active',
  very_active: 'very active',
};

@Injectable()
export class WorkoutPlanService {
  private readonly logger = new Logger(WorkoutPlanService.name);

  constructor(
    private prisma: PrismaService,
    private openai: OpenAI,
    @Inject(AI_MODEL) private model: string,
  ) {}

  private async resolveUser(supabaseId: string) {
    const user = await this.prisma.user.findUnique({ where: { supabaseId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getPlan(supabaseId: string) {
    const user = await this.resolveUser(supabaseId);
    return this.prisma.workoutPlan.findUnique({ where: { userId: user.id } });
  }

  /** Asks the coach for a new weekly plan and saves it, replacing any existing one. */
  async generate(supabaseId: string, dto: GeneratePlanDto, offset: number) {
    const user = await this.resolveUser(supabaseId);
    const today = localToday(offset);
    const existing = await this.prisma.workoutPlan.findUnique({
      where: { userId: user.id },
    });
    const usedToday =
      existing?.generationDay === today ? existing.generationsToday : 0;
    if (usedToday >= DAILY_GENERATIONS) {
      throw new HttpException(
        `You can regenerate your plan ${DAILY_GENERATIONS} times a day`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const daysPerWeek =
      dto.daysPerWeek ??
      existing?.daysPerWeek ??
      defaultDaysPerWeek(user.activityLevel);
    const location = dto.location ?? existing?.location ?? 'home';

    const profile = [
      `Goal: ${GOAL_LABELS[user.primaryGoal] ?? user.primaryGoal}${user.aim ? ` (main aim: ${AIM_LABELS[user.aim] ?? user.aim})` : ''}`,
      `Current activity level: ${ACTIVITY_LEVEL_LABELS[user.activityLevel ?? ''] ?? 'unknown'}`,
      `Daily active-minutes goal: ${user.activeMinutesGoal}`,
      user.friction
        ? `Biggest obstacle: ${FRICTION_LABELS[user.friction] ?? user.friction}`
        : null,
      user.gender ? `Gender: ${user.gender}` : null,
      user.weightKg ? `Weight: ${user.weightKg} kg` : null,
    ].filter(Boolean);

    const instructions = `You are GRIT Coach, building a weekly workout plan for the user of a fitness app.

User profile:
${profile.map((l) => `- ${l}`).join('\n')}

Rules:
- Return exactly 7 days, "mon" to "sun", with exactly ${daysPerWeek} training days and the rest as rest days. Spread training days out; avoid more than 3 in a row.
- Training happens ${location === 'gym' ? 'at a gym with standard equipment' : 'at home with no equipment beyond a mat'}.
- Keep each session close to the active-minutes goal, never over 90 minutes. Match the level: a sedentary beginner gets gentle, short sessions.
- Address the obstacle: short efficient sessions for "not enough time", the same simple routine on fixed days for consistency, variety for low motivation, clear progression for "no clear plan".
- Each training day has a short title, an activityType from the allowed list that best describes it, a durationMin, and 3 to 8 exercises. Each exercise has a name and a short detail like "3 × 12", "20 min easy pace" or "4 × 30 s on / 30 s off".
- Rest days: rest true, title "Rest" (or "Active recovery" with a light walk or stretch), activityType "other", durationMin 0, no exercises.
- summary: one or two encouraging sentences describing the week's structure, addressed to the user.`;

    const input = dto.feedback
      ? `Build my plan. Please also take this into account: ${dto.feedback}`
      : 'Build my plan.';

    let parsed: { summary: string; days: unknown };
    try {
      const response = await this.openai.responses.create({
        model: this.model,
        instructions,
        input,
        // Reasoning tokens count toward this cap, so leave room beyond the JSON
        max_output_tokens: 8000,
        reasoning: { effort: 'low' },
        store: false,
        text: {
          format: {
            type: 'json_schema',
            name: 'workout_plan',
            strict: true,
            schema: PLAN_SCHEMA as unknown as Record<string, unknown>,
          },
        },
      });
      parsed = JSON.parse(response.output_text) as typeof parsed;
    } catch (err) {
      this.logger.warn(`Plan generation failed: ${(err as Error).message}`);
      throw new BadGatewayException(
        "The coach couldn't build a plan right now. Try again in a moment.",
      );
    }

    let days;
    try {
      days = normalizePlanDays(parsed.days);
    } catch (err) {
      this.logger.warn(
        `Plan from the model was invalid: ${(err as Error).message}`,
      );
      throw new BadGatewayException(
        "The coach's plan didn't come out right. Try again.",
      );
    }

    const data = {
      summary: String(parsed.summary ?? '').slice(0, 400),
      daysPerWeek,
      location,
      days: days as unknown as Prisma.InputJsonValue,
      generationDay: today,
      generationsToday: usedToday + 1,
    };
    return this.prisma.workoutPlan.upsert({
      where: { userId: user.id },
      update: data,
      create: { userId: user.id, ...data },
    });
  }

  /** Replaces one day of the plan with the user's own edits. */
  async updateDay(supabaseId: string, day: Weekday, dto: PlanDayContentDto) {
    const user = await this.resolveUser(supabaseId);
    const plan = await this.prisma.workoutPlan.findUnique({
      where: { userId: user.id },
    });
    if (!plan) throw new NotFoundException("You don't have a workout plan yet");

    const current = normalizePlanDays(plan.days);
    const days = normalizePlanDays(
      current.map((d) => (d.day === day ? { ...dto, day } : d)),
    );
    return this.prisma.workoutPlan.update({
      where: { id: plan.id },
      data: {
        days: days as unknown as Prisma.InputJsonValue,
        daysPerWeek: days.filter((d) => !d.rest).length,
      },
    });
  }
}
