-- The endpoints the website needs: my reports, PawLink Pro, favourites, the second
-- review of a listing (pendingEdit) and the yes/no answer to "do you see this animal?".
--
-- Deviations from docs/BACKEND_PROMPT.md §4's table list — see README §Deviations:
--   - `favorites`          : the saved adoption profiles (the heart of the marketplace)
--   - `*.pendingEdit`      : the changes an owner proposes on a live listing
--   - `case_confirms.seen` : the answer is a vote ("I see it" / "I don't"), not only a yes

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'confirmAsk';
ALTER TYPE "NotificationKind" ADD VALUE 'caseConfirmed';
ALTER TYPE "NotificationKind" ADD VALUE 'editApproved';
ALTER TYPE "NotificationKind" ADD VALUE 'editRejected';

-- AlterTable
ALTER TABLE "cases" ADD COLUMN "pendingEdit" JSONB;
ALTER TABLE "services" ADD COLUMN "pendingEdit" JSONB;
ALTER TABLE "adoptions" ADD COLUMN "pendingEdit" JSONB;
ALTER TABLE "case_confirms" ADD COLUMN "seen" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "favorites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adoptionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_adoption_unique" ON "favorites"("userId", "adoptionId");
CREATE INDEX "favorites_user_idx" ON "favorites"("userId");

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_adoptionId_fkey" FOREIGN KEY ("adoptionId") REFERENCES "adoptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
