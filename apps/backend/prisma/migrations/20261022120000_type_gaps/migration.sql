-- Close the remaining shapes the website already uses (docs/tasks/BACKEND.md §Shapes):
--   - users.availability        : now / usually / away (finer than the on/off `available`)
--   - case_helpers.stage/stageAt: a helper goes "on the way", then "with the animal"
--   - cases.nextHelp            : { types, by, at } — the next step the reporter asked for
--   - cases.answers             : the reporter's answers to the triage's quick questions
--   - emergency_zones.endedAt   : when an admin ended the alert
--   - emergency_zones.radiusKm  : the radius the admin declared (circle drawn as a polygon)
--   - adoptions.status          : `adopted` — the animal found its family and left the list
--   - adoption_requests.status  : `cancelled` — the adopter withdrew their request

-- CreateEnum
CREATE TYPE "Availability" AS ENUM ('now', 'usually', 'away');
CREATE TYPE "HelperStage" AS ENUM ('onway', 'onsite');

-- AlterEnum
ALTER TYPE "AdoptionStatus" ADD VALUE 'adopted';
ALTER TYPE "RequestStatus" ADD VALUE 'cancelled';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "availability" "Availability";
ALTER TABLE "case_helpers" ADD COLUMN "stage" "HelperStage";
ALTER TABLE "case_helpers" ADD COLUMN "stageAt" TIMESTAMP(3);
ALTER TABLE "cases" ADD COLUMN "nextHelp" JSONB;
ALTER TABLE "cases" ADD COLUMN "answers" JSONB;
ALTER TABLE "emergency_zones" ADD COLUMN "endedAt" TIMESTAMP(3);
ALTER TABLE "emergency_zones" ADD COLUMN "radiusKm" DOUBLE PRECISION;
