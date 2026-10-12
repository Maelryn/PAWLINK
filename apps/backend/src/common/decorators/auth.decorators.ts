import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role } from '@prisma/client';

/** Metadata keys. Kept together so a typo cannot silently disable a guard. */
export const ROLES_KEY = 'pawlink:roles';
export const IS_PUBLIC_KEY = 'pawlink:public';

/** The JWT payload, as attached to the request by the auth guards. */
export interface AuthenticatedUser {
  sub: string;
  role: Role;
  name: string;
}

/**
 * `@Roles('admin')` — the route needs those roles. Checked by `RolesGuard`
 * against the role **in the JWT**, never against anything the client sent in a
 * body or header (docs/BACKEND_PROMPT.md §3.6: the server is the enforcement
 * point; UI hiding is cosmetic).
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/**
 * `@Public()` — opts one route out of the global `JwtAuthGuard`.
 *
 * This is what makes a global guard safe: the default is "protected", and a
 * route has to say out loud that it is open, so a forgotten guard cannot leak an
 * endpoint by accident.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** `@CurrentUser()` → `{ sub, role, name }` from the verified JWT. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser | undefined => {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    return request.user;
  },
);
