-- CreateEnum
CREATE TYPE "RefreshRevokeReason" AS ENUM ('rotated', 'logout', 'reuse');

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN "revokedReason" "RefreshRevokeReason";
