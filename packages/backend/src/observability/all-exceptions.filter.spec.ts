import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AllExceptionsFilter } from './all-exceptions.filter';

function run(exception: unknown, headersSent = false) {
  const res = {
    headersSent,
    statusCode: 0,
    body: undefined as unknown,
    ended: false,
    status: (code: number) => {
      res.statusCode = code;
      return res;
    },
    json: (b: unknown) => {
      res.body = b;
      return res;
    },
    end: () => {
      res.ended = true;
    },
  };
  const req = { requestId: 'req-123', method: 'GET', originalUrl: '/x?y=1' };
  const host = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
  };
  const filter = new AllExceptionsFilter();
  (filter as unknown as { logger: { error: jest.Mock } }).logger = {
    error: jest.fn(),
  };
  filter.catch(exception, host as never);
  return {
    res,
    logged: (filter as unknown as { logger: { error: jest.Mock } }).logger
      .error,
  };
}

describe('AllExceptionsFilter', () => {
  it('keeps HTTP error bodies and adds the request ID', () => {
    const { res, logged } = run(
      new BadRequestException(['name must be a string']),
    );
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      message: ['name must be a string'],
      requestId: 'req-123',
    });
    expect(logged).not.toHaveBeenCalled();
    expect(run(new NotFoundException('User not found')).res.body).toMatchObject(
      { message: 'User not found' },
    );
  });

  it('maps missing and duplicate records', () => {
    const err = (code: string) =>
      new Prisma.PrismaClientKnownRequestError('x', {
        code,
        clientVersion: '5',
      });
    expect(run(err('P2025')).res.statusCode).toBe(404);
    expect(run(err('P2002')).res.statusCode).toBe(409);
  });

  it('hides unexpected errors and logs them', () => {
    const { res, logged } = run(new Error('connection refused at 10.0.0.3'));
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.3');
    expect(logged).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req-123',
        path: '/x',
        error: 'connection refused at 10.0.0.3',
      }),
    );
  });

  it('ends a response that already started streaming', () => {
    const { res } = run(new Error('stream broke'), true);
    expect(res.ended).toBe(true);
    expect(res.body).toBeUndefined();
  });
});
