import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Cookie guard for `POST /auth/refresh` and `POST /auth/logout`: the token must
 * arrive in the httpOnly cookie, verified with the refresh secret. A bearer
 * header cannot stand in for it, which is what stops a stolen access token from
 * being quietly promoted to a new session.
 *
 * **This guard does not decide — it reports.**
 *
 * `POST /auth/refresh` needs a live session, so the controller refuses when
 * there is no user. `POST /auth/logout` must work even with a dead cookie: a
 * client that cannot log out keeps a cookie it cannot use, and the server
 * cannot clear it on the client's behalf. So the guard attaches the verified
 * refresh user when there is one and stays silent when there is not, and each
 * route decides what that means for it.
 */
@Injectable()
export class RefreshAuthGuard extends AuthGuard('jwt-refresh') {
  override handleRequest<TUser>(error: unknown, user: TUser): TUser | undefined {
    if (error || !user) return undefined;
    return user;
  }
}
