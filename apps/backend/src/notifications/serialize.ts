import type { Notification as NotificationRow } from '@prisma/client';
import type { AppNotification } from '../shared/types';

/** The ONLY place a `notifications` row becomes the frontend `AppNotification`. */
export function notificationRowToAppNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    userId: row.userId,
    kind: row.kind,
    subject: row.subject,
    href: row.href,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
  };
}
