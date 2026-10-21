import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';

/**
 * Global error envelope (BACKEND_PROMPT §3.1): every failed request answers
 *   { statusCode: number, message: string, code: string }
 * `code` is a stable machine string clients can switch on. Stack traces never leave the server.
 */

export interface ErrorBody {
  statusCode: number;
  message: string;
  code: string;
}

const STATUS_CODES: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'AUTH_UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'UNPROCESSABLE',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  502: 'UPSTREAM_ERROR',
  503: 'SERVICE_UNAVAILABLE',
  504: 'UPSTREAM_TIMEOUT',
};

/** Throw this anywhere: `throw new ApiError(409, 'AUTH_EMAIL_TAKEN', 'This email is already registered.')` */
export class ApiError extends HttpException {
  constructor(statusCode: number, code: string, message?: string) {
    super(
      { statusCode, code, message: message ?? defaultMessage(statusCode) },
      statusCode,
    );
  }
}

function defaultMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Invalid request';
    case 401:
      return 'Authentication required';
    case 403:
      return 'You do not have access to this resource';
    case 404:
      return 'Resource not found';
    case 409:
      return 'Conflict';
    case 429:
      return 'Too many requests, please slow down';
    case 500:
      return 'Internal server error';
    case 503:
      return 'Service temporarily unavailable';
    default:
      return 'Request failed';
  }
}

/** Flatten whatever Nest (or ValidationPipe) put in `message` into one readable string. */
function readMessage(response: unknown): string | undefined {
  if (typeof response === 'string') return response;
  if (response && typeof response === 'object' && 'message' in response) {
    const m = (response as { message?: unknown }).message;
    if (typeof m === 'string') return m;
    if (Array.isArray(m)) return m.filter((x) => typeof x === 'string').join(', ');
  }
  return undefined;
}

/** Read a machine `code` off the response object if the thrower supplied one. */
function readCode(response: unknown): string | undefined {
  if (response && typeof response === 'object' && 'code' in response) {
    const c = (response as { code?: unknown }).code;
    if (typeof c === 'string' && c.length > 0) return c;
  }
  return undefined;
}

/**
 * Prisma error codes that mean "the database is not talking to us".
 * Covers both the classic Prisma codes and the raw `pg` codes that surface when
 * the client runs through a driver adapter (`@prisma/adapter-pg`), where Prisma
 * does not wrap the failure in a `PrismaClientKnownRequestError` at all.
 */
const DB_UNAVAILABLE_CODES = new Set([
  'P1001', // can't reach database server
  'P1002', // server timed out
  'P1008', // operation timed out
  'P2024', // timed out fetching a new connection from the pool
  'P1017', // server closed the connection
  '57P01', // pg: admin shutdown
  '08006', // pg: connection failure
  '08000',
  '08003',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'EPIPE',
]);

const CONNECTION_MESSAGE = /sasl|scram|can(?:no|')?t reach database|connection (?:refused|reset|closed|failed|terminated)|timeout|timed out|econnrefused|enotfound|getaddrinfo|socket hang up|pool/i;

const CONNECTION_ERROR_NAMES = new Set([
  'PrismaClientInitializationError',
  'PrismaClientRustPanicError',
  'PrismaClientUnknownRequestError',
]);

/** True when the error is "the database is unreachable" rather than "a bad query". */
function isDatabaseUnavailable(error: unknown): boolean {
  const e = error as { name?: string; code?: unknown; message?: unknown; cause?: unknown };
  if (e?.name && CONNECTION_ERROR_NAMES.has(e.name)) return true;
  if (typeof e?.code === 'string' && DB_UNAVAILABLE_CODES.has(e.code)) return true;

  // With a driver adapter the failure arrives as a bare `Error`, so the message
  // is the only signal left: "SASL: …", "connect ECONNREFUSED …", …
  if (e instanceof Error && CONNECTION_MESSAGE.test(e.message)) return true;

  // …and one level down, for errors wrapped by the driver.
  const cause = e?.cause as { code?: unknown; message?: unknown } | undefined;
  if (cause) {
    if (typeof cause.code === 'string' && DB_UNAVAILABLE_CODES.has(cause.code)) return true;
    if (typeof cause.message === 'string' && CONNECTION_MESSAGE.test(cause.message)) return true;
  }
  return false;
}

/** Map Prisma known errors to honest HTTP codes without importing Prisma here (keeps this testable). */
function prismaCode(error: unknown): string | undefined {
  const e = error as { name?: string; code?: unknown };
  if (typeof e?.code !== 'string') return undefined;
  switch (e.code) {
    case 'P2002':
      return 'CONFLICT';
    case 'P2025':
      return 'NOT_FOUND';
    case 'P2003':
      return 'CONFLICT';
    case 'P2023':
      return 'VALIDATION_ERROR';
    default:
      return undefined;
  }
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | undefined;
    let code: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      code = readCode(body);
      message = readMessage(body);
    } else if (isDatabaseUnavailable(exception)) {
      // A raw driver failure (SASL, ECONNREFUSED, pool timeout …): the API is
      // alive, the database is not — 503, never a 500.
      status = HttpStatus.SERVICE_UNAVAILABLE;
      code = 'DB_UNAVAILABLE';
    } else {
      const mapped = prismaCode(exception);
      if (mapped) {
        code = mapped;
        status =
          mapped === 'NOT_FOUND'
            ? HttpStatus.NOT_FOUND
            : mapped === 'VALIDATION_ERROR'
              ? HttpStatus.BAD_REQUEST
              : HttpStatus.CONFLICT;
      }
    }

    if (!code) code = STATUS_CODES[status] ?? 'INTERNAL_ERROR';

    if (status >= 500) {
      // Full detail stays server-side; the client only ever sees the envelope.
      this.logger.error(
        `Unhandled ${status} ${code}: ${exception instanceof Error ? exception.message : String(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
      if (status === HttpStatus.SERVICE_UNAVAILABLE && !message) {
        message = 'Database unavailable, please retry shortly';
      }
    }

    const body: ErrorBody = {
      statusCode: status,
      message: message ?? defaultMessage(status),
      code,
    };

    res.status(status).json(body);
  }
}
