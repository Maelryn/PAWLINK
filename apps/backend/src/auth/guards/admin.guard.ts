import { Injectable } from '@nestjs/common';
import type { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

/**
 * `@UseGuards(AdminGuard)` — admin only, with no annotation to forget.
 *
 * Phase 1 has no real `/admin/*` route yet (they arrive in Phase 4), so this
 * guard is what the e2e suite uses to prove role denial works end to end: a
 * `reporter` token must be turned away with `403 FORBIDDEN`.
 */
@Injectable()
export class AdminGuard extends RolesGuard {
  protected override requiredRoles(): Role[] {
    return ['admin'];
  }
}
