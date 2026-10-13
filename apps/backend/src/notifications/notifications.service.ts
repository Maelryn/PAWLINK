import { Injectable } from '@nestjs/common';
import type { NotificationKind } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { notificationRowToAppNotification } from './serialize';
import type { Paginated } from '../shared/pagination';
import type { AppNotification } from '../shared/types';

/**
 * Notifications — the one path every notification in the codebase goes through.
 *
 * Extracted from `CasesService.notify()` (Phase 2) so adoptions, bookings and
 * reviews push the same row + socket event without copying the pattern. The
 * rule it keeps: **the row and the realtime push are one operation** — a
 * notification that exists in the table but never reaches the socket is a
 * message the user only sees on the next reload.
 *
 * `subject` and `href` are always built by the *caller from database rows and
 * ids*, never from client input (docs/BACKEND_PROMPT.md §3.6).
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /**
   * Writes the notification row and broadcasts it to the recipient's sockets.
   * Returns the wire shape so callers can include it in a response body.
   */
  async notify(
    userId: string,
    kind: NotificationKind,
    subject: string,
    href: string,
  ): Promise<AppNotification> {
    const row = await this.prisma.notification.create({
      data: { userId, kind, subject, href },
    });
    const notification = notificationRowToAppNotification(row);
    this.realtime.notification({ notification });
    return notification;
  }

  /** The caller's notifications, newest first, in the list envelope. */
  async list(userId: string, page: number, pageSize: number): Promise<Paginated<AppNotification>> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);
    return { items: rows.map(notificationRowToAppNotification), total, page, pageSize };
  }

  /** Marks every unread row of this user read. Never touches anyone else's. */
  async readAll(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }
}
