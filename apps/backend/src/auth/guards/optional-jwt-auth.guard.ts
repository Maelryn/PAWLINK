import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/auth.decorators';

/**
 * An access token that is *optional*.
 *
 * `GET /cases` is public, but a signed-in map should still show the reporter
 * their own held-back report — otherwise there is no way for them to find out
 * what happened to it. So this guard reads a bearer token when there is one and
 * attaches it to the request, and stays silent when there is not.
 *
 * It is paired with `@Public()` on the route, because the global `JwtAuthGuard`
 * runs first and would otherwise reject the anonymous caller before this guard
 * ever sees the request. Where it differs from `JwtAuthGuard` is only in
 * `handleRequest`: it never throws.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return super.canActivate(context);
    return true;
  }

  /** No token, or a bad one, is not an error here — the caller is just anonymous. */
  override handleRequest<TUser>(_error: unknown, user: TUser): TUser | undefined {
    return user ?? undefined;
  }
}
