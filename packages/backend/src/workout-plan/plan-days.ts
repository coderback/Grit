import 'reflect-metadata'; // @Type() needs it outside Nest too (e.g. in unit tests)
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PlanDayDto, WEEKDAYS, type Weekday } from './workout-plan.dto';

export type PlanDay = Omit<PlanDayDto, never>;

const REST_DAY = (day: Weekday): PlanDay => ({
  day,
  rest: true,
  title: 'Rest',
  activityType: 'other',
  durationMin: 0,
  exercises: [],
});

/**
 * Turns the model's output (or stored JSON) into exactly seven valid days,
 * Monday first. Rest days are made consistent; anything that fails validation
 * throws, so a malformed plan is never saved.
 */
export function normalizePlanDays(raw: unknown): PlanDay[] {
  if (!Array.isArray(raw)) throw new Error('Plan days must be a list');

  const byDay = new Map<Weekday, PlanDay>();
  for (const item of raw) {
    const day = plainToInstance(PlanDayDto, item);
    const errors = validateSync(day, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length) {
      throw new Error(
        `Invalid plan day: ${errors.map((e) => e.property).join(', ')}`,
      );
    }
    if (byDay.has(day.day)) throw new Error(`Duplicate plan day: ${day.day}`);
    byDay.set(
      day.day,
      day.rest
        ? { ...REST_DAY(day.day), title: day.title.trim() || 'Rest' }
        : {
            day: day.day,
            rest: false,
            title: day.title.trim() || 'Workout',
            activityType: day.activityType,
            durationMin: day.durationMin,
            exercises: day.exercises.map((e) => ({
              name: e.name.trim(),
              detail: e.detail.trim(),
            })),
          },
    );
  }

  // Days the model left out are rest days
  return WEEKDAYS.map((d) => byDay.get(d) ?? REST_DAY(d));
}

/** Default training days per week for an activity level. */
export function defaultDaysPerWeek(activityLevel: string | null): number {
  return (
    { sedentary: 3, lightly_active: 3, active: 4, very_active: 5 }[
      activityLevel ?? ''
    ] ?? 3
  );
}
