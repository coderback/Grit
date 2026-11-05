import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import {
  COMMON_EXERCISES,
  LIBRARY_VERSION,
  restrictedStresses,
  toLibraryRow,
  type SourceExercise,
} from './exercise-tags';

// free-exercise-db's data, bundled with the backend (public domain)
const DATA_FILE = join(__dirname, '../../data/exercises.json');
const SHORTLIST_SIZE = 80;
const PLAN_CATEGORIES = ['strength', 'powerlifting', 'cardio', 'plyometrics'];

export interface ShortlistItem {
  id: string;
  name: string;
  equipment: string[];
  pattern: string | null;
  category: string | null;
}

@Injectable()
export class ExercisesService implements OnModuleInit {
  private readonly logger = new Logger(ExercisesService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Loads the library on first start, and again when the tagging rules
   * change, so a database never needs a manual step.
   */
  async onModuleInit() {
    try {
      const current = await this.prisma.exercise.count({
        where: { source: LIBRARY_VERSION },
      });
      if (current === 0) {
        const n = await this.seed();
        this.logger.log(`Loaded ${n} exercises into the library`);
      }
    } catch (err) {
      this.logger.warn(
        `Exercise library not loaded: ${(err as Error).message}`,
      );
    }
  }

  /** Replaces the library with the bundled data and the current tagging rules. */
  async seed() {
    const raw = JSON.parse(readFileSync(DATA_FILE, 'utf8')) as SourceExercise[];
    const rows = raw.filter((e) => e.id && e.name).map(toLibraryRow);
    await this.prisma.$transaction([
      this.prisma.exercise.deleteMany({}),
      this.prisma.exercise.createMany({ data: rows }),
    ]);
    return rows.length;
  }

  search(q?: string, muscle?: string, equipment?: string, limit = 50) {
    const terms = q?.trim();
    return this.prisma.exercise.findMany({
      where: {
        ...(terms
          ? { name: { contains: terms, mode: 'insensitive' as const } }
          : {}),
        ...(muscle ? { primary: { has: muscle } } : {}),
        ...(equipment ? { equipment: { has: equipment } } : {}),
      },
      orderBy: { name: 'asc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }

  async get(id: string) {
    const e = await this.prisma.exercise.findUnique({ where: { id } });
    if (!e) throw new NotFoundException('Exercise not found');
    return e;
  }

  /**
   * The exercises a plan may use for this person: right for where they train
   * and their level, and none that stress an injury in their coach notes.
   * Common movements come first, then other compound lifts.
   */
  async shortlist(opts: {
    location: string;
    activityLevel: string | null;
    notes: string[];
  }): Promise<ShortlistItem[]> {
    const avoid = restrictedStresses(opts.notes);
    const levels =
      opts.activityLevel === 'very_active'
        ? ['beginner', 'intermediate', 'expert']
        : opts.activityLevel === 'active'
          ? ['beginner', 'intermediate']
          : ['beginner'];
    const all = await this.prisma.exercise.findMany({
      where: {
        category: { in: PLAN_CATEGORIES },
        level: { in: levels },
        ...(opts.location === 'home'
          ? { equipment: { has: 'bodyweight' } }
          : {}),
        ...(avoid.length ? { NOT: { stresses: { hasSome: avoid } } } : {}),
      },
      select: {
        id: true,
        name: true,
        equipment: true,
        pattern: true,
        category: true,
        mechanics: true,
      },
    });
    const rank = (e: (typeof all)[number]) => {
      const common = COMMON_EXERCISES.indexOf(e.id);
      if (common >= 0) return common;
      if (e.category === 'cardio') return 1000;
      if (e.mechanics === 'compound' && e.pattern) return 2000;
      if (e.pattern) return 3000;
      return 4000;
    };
    return all
      .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
      .slice(0, SHORTLIST_SIZE)
      .map(({ id, name, equipment, pattern, category }) => ({
        id,
        name,
        equipment,
        pattern,
        category,
      }));
  }
}
