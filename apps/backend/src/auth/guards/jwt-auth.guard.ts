import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { ApiError } from '../../common/filters/http-exception.filter';
import { IS_PUBLIC_KEY } from '../../common/decorators/auth.decorators';

/**
 * Global access-token guard. Registered as an APP_GUARD, so **every** route is
 * protected by default and a route must opt out with `@Public()` — the opposite
 * of a per-route guard you can forget to add.
 *
 * Failure is reported as `AUTH_UNAUTHORIZED`: no stack trace, and no hint about
 * which part of the token was wrong.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  override handleRequest<TUser>(error: unknown, user: TUser): TUser {
    if (error || !user) {
      throw new ApiError(401, 'AUTH_UNAUTHORIZED', 'Authentification requise.');
    }
    return user;
  }
}
