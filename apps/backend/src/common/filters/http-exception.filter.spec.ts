import { ArgumentsHost, BadRequestException, HttpException, Logger, NotFoundException } from '@nestjs/common';
import { ApiError, HttpExceptionFilter } from './http-exception.filter';

/** Minimal express-shaped Response double. */
function makeRes() {
  return {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

function makeHost(res: unknown): ArgumentsHost {
  return {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({}) }),
  } as unknown as ArgumentsHost;
}

describe('HttpExceptionFilter (BACKEND_PROMPT §3.1 envelope)', () => {
  let filter: HttpExceptionFilter;
  let res: ReturnType<typeof makeRes>;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    res = makeRes();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('wraps ApiError with its stable code', () => {
    filter.catch(new ApiError(409, 'AUTH_EMAIL_TAKEN', 'Already registered.'), makeHost(res));
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ statusCode: 409, message: 'Already registered.', code: 'AUTH_EMAIL_TAKEN' });
  });

  it('flattens ValidationPipe message arrays into one string with VALIDATION_ERROR', () => {
    filter.catch(
      new BadRequestException({ statusCode: 400, message: ['email must be an email', 'name should not be empty'], error: 'Bad Request' }),
      makeHost(res),
    );
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      statusCode: 400,
      message: 'email must be an email, name should not be empty',
      code: 'VALIDATION_ERROR',
    });
  });

  it('maps a plain NotFoundException to NOT_FOUND', () => {
    filter.catch(new NotFoundException(), makeHost(res));
    expect(res.body).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  it('maps ThrottlerException (429) to RATE_LIMITED', () => {
    filter.catch(new HttpException('Too Many Requests', 429), makeHost(res));
    expect(res.body).toMatchObject({ statusCode: 429, code: 'RATE_LIMITED' });
  });

  it('maps Prisma P2025 (record not found) to 404 NOT_FOUND', () => {
    const err = Object.assign(new Error('Record not found'), { name: 'PrismaClientKnownRequestError', code: 'P2025' });
    filter.catch(err, makeHost(res));
    expect(res.body).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  it('maps a dropped connection to 503 DB_UNAVAILABLE', () => {
    const err = Object.assign(new Error('can not reach database'), { name: 'PrismaClientKnownRequestError', code: 'P1001' });
    filter.catch(err, makeHost(res));
    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ code: 'DB_UNAVAILABLE' });
  });

  it('never leaks stack traces or raw messages for unknown errors', () => {
    const err = new Error('secret internal detail at C:\\very\\private\\file.ts:12');
    filter.catch(err, makeHost(res));
    expect(res.statusCode).toBe(500);
    const body = res.body as Record<string, unknown>;
    expect(body).toEqual({ statusCode: 500, message: 'Internal server error', code: 'INTERNAL_ERROR' });
    expect(JSON.stringify(body)).not.toContain('private');
  });

  it('ApiError without message falls back to a human default', () => {
    filter.catch(new ApiError(404, 'CASE_NOT_FOUND'), makeHost(res));
    expect(res.body).toEqual({ statusCode: 404, message: 'Resource not found', code: 'CASE_NOT_FOUND' });
  });
});
