import {
  calorieFloor,
  maxDailyDeficit,
  weightLossAllowed,
} from '../common/safety';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrendsService } from './trends.service';
import {
  estimateExpenditure,
  formulaTdee,
  isLoggedDay,
  MIN_LOGGED_DAYS,
  MIN_SPAN_DAYS,
  MIN_WEIGH_INS,
  suggestTarget,
  type AdaptiveDay,
} from './adaptive';

const WINDOW_DAYS = 35;
const SNOOZE_DAYS = 7;
// After a change, give it a week before suggesting another
const SETTLE_DAYS = 6;

@Injectable()
export class AdaptiveService {
  constructor(
    private prisma: PrismaService,
    private trends: TrendsService,
  ) {}

  /** The current estimate and, if it's worth it, a new target to suggest. */
  async checkIn(supabaseId: string, offset: number) {
    const user = await this.prisma.user.findUnique({ where: { supabaseId } });
    if (!user) throw new NotFoundException('User not found');
    const { days } = await this.trends.trends(supabaseId, WINDOW_DAYS, offset);

    const series: AdaptiveDay[] = days.map((d, i) => ({
      date: d.date,
      // Today isn't over, so its intake doesn't count
      intake:
        i < days.length - 1 &&
        isLoggedDay(d.calories, d.foodEntries, user.calorieGoal)
          ? d.calories
          : null,
      weightKg: d.weightKg,
    }));
    const prior = formulaTdee(user);
    const estimate = estimateExpenditure(series, prior);

    const now = new Date();
    const settled =
      !user.adaptiveAppliedAt ||
      now.getTime() - user.adaptiveAppliedAt.getTime() >
        SETTLE_DAYS * 86_400_000;
    const snoozed =
      !!user.adaptiveSnoozedUntil && user.adaptiveSnoozedUntil > now;
    const suggestion =
      estimate && settled && !snoozed
        ? suggestTarget(
            estimate,
            user.calorieGoal,
            // No weight-loss targets after a "yes" to the eating-disorder question
            weightLossAllowed(user.edScreen) ? user.primaryGoal : 'maintain',
            user.pace,
            {
              floor: calorieFloor(user.gender),
              maxDeficit: maxDailyDeficit(user.weightKg),
            },
          )
        : null;

    const firstWeigh = series.findIndex((d) => d.weightKg != null);
    const sinceWeigh = firstWeigh < 0 ? [] : series.slice(firstWeigh);
    return {
      estimate,
      suggestion,
      formulaTdee: prior,
      // What's still missing before there's an estimate
      progress: {
        loggedDays: series.filter((d) => d.intake != null).length,
        weighIns: series.filter((d) => d.weightKg != null).length,
        spanDays: sinceWeigh.length,
        needs: {
          loggedDays: MIN_LOGGED_DAYS,
          weighIns: MIN_WEIGH_INS,
          spanDays: MIN_SPAN_DAYS,
        },
      },
      snoozedUntil: snoozed ? user.adaptiveSnoozedUntil : null,
    };
  }

  /** Takes the suggested target (or one the user adjusted). */
  async apply(supabaseId: string, calorieGoal: number) {
    if (
      !Number.isInteger(calorieGoal) ||
      calorieGoal < 1200 ||
      calorieGoal > 10000
    ) {
      throw new BadRequestException(
        'calorieGoal must be a whole number from 1200 to 10000',
      );
    }
    return this.prisma.user.update({
      where: { supabaseId },
      data: {
        calorieGoal,
        adaptiveAppliedAt: new Date(),
        adaptiveSnoozedUntil: null,
      },
      select: { calorieGoal: true },
    });
  }

  /** Not now: ask again in a week. */
  async snooze(supabaseId: string) {
    const until = new Date(Date.now() + SNOOZE_DAYS * 86_400_000);
    await this.prisma.user.update({
      where: { supabaseId },
      data: { adaptiveSnoozedUntil: until },
    });
    return { snoozedUntil: until };
  }
}
