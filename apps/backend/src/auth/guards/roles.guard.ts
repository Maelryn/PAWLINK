import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@prisma/client';
import { ApiError } from '../../common/filters/http-exception.filter';
import { ROLES_KEY, type AuthenticatedUser } from '../../common/decorators/auth.decorators';

/**
 * Role check. Reads the roles the route asked for (`@Roles('admin')`) and
 * compares them with the role **inside the verified JWT** — the client never
 * gets a say. Routes with no `@Roles()` are open to any authenticated caller.
 *
 * Registered globally, so a future `/admin/*` route is protected the moment it
 * is annotated, without anyone remembering to add a guard.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.requiredRoles(context);
    if (required.length === 0) return true;

    const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
    if (!user) throw new ApiError(401, 'AUTH_UNAUTHORIZED', 'Authentification requise.');
    if (!required.includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Vous n\'avez pas accès à cette ressource.');
    }
    return true;
  }

  /** Overridden by `AdminGuard` so admin routes never depend on an annotation. */
  protected requiredRoles(context: ExecutionContext): Role[] {
    return (
      this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]) ?? []
    );
  }
}
