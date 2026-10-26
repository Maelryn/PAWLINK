import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CasesService } from '../cases/cases.service';
import { AdoptionsService } from '../adoptions/adoptions.service';
import { ServicesService } from '../services/services.service';
import type { PendingEdit } from '../shared/types';

/**
 * `/admin/pending-edits` — the second review, in one list.
 *
 * An owner who changes a live report, a live adoption listing or a live
 * business listing does not change it right away: the change waits here, and
 * the public version stays as it is until a moderator decides. The three kinds
 * share one shape so the admin screen can show them in one queue; the decision
 * itself lives next to the thing it decides
 * (`PATCH /admin/{cases,adoptions,services}/:id/edit`).
 */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/pending-edits')
export class AdminPendingEditsController {
  constructor(
    private readonly cases: CasesService,
    private readonly adoptions: AdoptionsService,
    private readonly services: ServicesService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Every proposed change waiting for a moderator',
    description:
      'Reports, adoption listings and business listings in one queue, newest first. Each item ' +
      'says what changed (`edit`), who proposed it (`ownerId`, `ownerName`) and when (`at`).',
  })
  @ApiOkResponse({ description: '`{ items, total }` — each item is a `PendingEdit`.' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN — admin only.' })
  async list(): Promise<{ items: PendingEdit[]; total: number }> {
    const [cases, adoptions, services] = await Promise.all([
      this.cases.pendingEdits(),
      this.adoptions.pendingEdits(),
      this.services.pendingEdits(),
    ]);
    const items = [...cases, ...adoptions, ...services].sort(
      (a, b) => Date.parse(b.at) - Date.parse(a.at),
    );
    return { items, total: items.length };
  }
}
