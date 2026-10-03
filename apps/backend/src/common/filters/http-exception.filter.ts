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

/** Map Prisma known errors to honest HTTP codes without importing Prisma here (keeps this testable). */
function prismaCode(error: unknown): string | undefined {
  const e = error as { name?: string; code?: unknown };
  if (e?.name !== 'PrismaClientKnownRequestError' || typeof e.code !== 'string') return undefined;
  switch (e.code) {
    case 'P2002':
      return 'CONFLICT';
    case 'P2025':
      return 'NOT_FOUND';
    case 'P2003':
      return 'CONFLICT';
    case 'P2023':
      return 'VALIDATION_ERROR';
    case 'P1001':
    case 'P1002':
    case 'P1008':
      return 'DB_UNAVAILABLE';
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
    } else {
      const prismaMapped = prismaCode(exception);
      if (prismaMapped) {
        code = prismaMapped;
        status =
          prismaMapped === 'DB_UNAVAILABLE'
            ? HttpStatus.SERVICE_UNAVAILABLE
            : prismaMapped === 'NOT_FOUND'
              ? HttpStatus.NOT_FOUND
              : prismaMapped === 'VALIDATION_ERROR'
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
