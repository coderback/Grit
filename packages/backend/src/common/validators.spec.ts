import { IsISO8601, IsOptional, validateSync } from 'class-validator';
import { IsNotFuture } from './validators';

class Dto {
  @IsOptional()
  @IsISO8601({ strict: true })
  @IsNotFuture()
  loggedAt?: string;
}

function errors(loggedAt?: string) {
  const dto = new Dto();
  dto.loggedAt = loggedAt;
  return validateSync(dto).flatMap((e) => Object.keys(e.constraints ?? {}));
}

const inMinutes = (min: number) =>
  new Date(Date.now() + min * 60_000).toISOString();

describe('IsNotFuture', () => {
  it('accepts past and present times', () => {
    expect(errors(inMinutes(-60 * 24))).toEqual([]);
    expect(errors(inMinutes(0))).toEqual([]);
  });

  it('allows a few minutes of clock drift', () => {
    expect(errors(inMinutes(5))).toEqual([]);
  });

  it('rejects times in the future', () => {
    expect(errors(inMinutes(60))).toEqual(['isNotFuture']);
    expect(errors('2099-01-01T00:00:00Z')).toEqual(['isNotFuture']);
  });

  it('leaves missing and malformed values to the other validators', () => {
    expect(errors(undefined)).toEqual([]);
    expect(errors('not a date')).toEqual(['isIso8601']);
  });
});
