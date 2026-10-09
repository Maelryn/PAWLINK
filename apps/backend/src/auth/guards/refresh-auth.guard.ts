import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiError } from '../../common/filters/http-exception.filter';

/**
 * Cookie guard for `POST /auth/refresh` and `POST /auth/logout`: the token must
 * arrive in the httpOnly cookie, verified with the refresh secret. A bearer
 * header cannot stand in for it, which is what stops a stolen access token from
 * being quietly promoted to a new session.
 */
@Injectable()
export class RefreshAuthGuard extends AuthGuard('jwt-refresh') {
  override handleRequest<TUser>(error: unknown, user: TUser): TUser {
    if (error || !user) {
      throw new ApiError(401, 'AUTH_NO_REFRESH_COOKIE', 'Session expirée, reconnectez-vous.');
    }
    return user;
  }
}
