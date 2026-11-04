import { registerDecorator, type ValidationOptions } from 'class-validator';

// Phone clocks drift, so allow a little slack before calling a time "future"
const CLOCK_SKEW_MS = 10 * 60_000;

/** An ISO date string that isn't in the future. */
export function IsNotFuture(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isNotFuture',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} can't be in the future`,
        ...options,
      },
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return true; // left to @IsISO8601
          const time = Date.parse(value);
          return Number.isNaN(time) || time <= Date.now() + CLOCK_SKEW_MS;
        },
      },
    });
  };
}
