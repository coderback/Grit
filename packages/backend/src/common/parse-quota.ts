import { HttpException, HttpStatus } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

// Each AI reading (a meal for Smart log, sets for Say it) is a model call, so
// they share one cap per day
export const DAILY_PARSES = 30;

/**
 * Takes one of today's AI readings, or refuses. Two conditional updates, so
 * parallel requests can't both take the last one.
 */
export async function takeParse(
  prisma: PrismaService,
  userId: string,
  today: string,
) {
  const fresh = await prisma.user.updateMany({
    where: {
      id: userId,
      OR: [{ aiParseDay: null }, { aiParseDay: { not: today } }],
    },
    data: { aiParseDay: today, aiParseCount: 1 },
  });
  if (fresh.count) return;
  const more = await prisma.user.updateMany({
    where: {
      id: userId,
      aiParseDay: today,
      aiParseCount: { lt: DAILY_PARSES },
    },
    data: { aiParseCount: { increment: 1 } },
  });
  if (!more.count) {
    throw new HttpException(
      `You can use smart logging ${DAILY_PARSES} times a day. Add the rest by hand for today.`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

/** A reading that failed on our side doesn't count. */
export async function giveBackParse(
  prisma: PrismaService,
  userId: string,
  today: string,
) {
  await prisma.user
    .updateMany({
      where: { id: userId, aiParseDay: today, aiParseCount: { gt: 0 } },
      data: { aiParseCount: { decrement: 1 } },
    })
    .catch(() => undefined);
}
