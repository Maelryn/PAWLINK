-- Bring the stored enum in line with `NotificationKind` in apps/web/lib/types.ts,
-- the source of truth for every shape. These kinds are already produced by the
-- website (demo store + i18n) and two of them are documented as a later
-- endpoint batch, but the value has to exist before a notification can be
-- written without a Prisma error.

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'resolved';
ALTER TYPE "NotificationKind" ADD VALUE 'nearbyCase';
ALTER TYPE "NotificationKind" ADD VALUE 'adoptCancelled';
ALTER TYPE "NotificationKind" ADD VALUE 'adoptDone';
ALTER TYPE "NotificationKind" ADD VALUE 'bookingCancelled';
ALTER TYPE "NotificationKind" ADD VALUE 'helperOnWay';
ALTER TYPE "NotificationKind" ADD VALUE 'helperOnSite';
ALTER TYPE "NotificationKind" ADD VALUE 'nextHelp';
