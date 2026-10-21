-- PawLink initial schema
-- Generated with: prisma migrate diff --from-empty --to-schema prisma/schema.prisma
-- CREATE EXTENSION must precede every geography column; triggers (prisma/_geo_extras.sql)
-- come last so they can reference the tables.

CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('reporter', 'volunteer', 'vet', 'admin');

-- CreateEnum
CREATE TYPE "Triage" AS ENUM ('urgent', 'monitoring', 'stable');

-- CreateEnum
CREATE TYPE "Species" AS ENUM ('dog', 'cat', 'bird', 'horse', 'cow', 'sheep', 'goat', 'camel', 'donkey', 'rabbit', 'chicken', 'other');

-- CreateEnum
CREATE TYPE "HelpType" AS ENUM ('transport', 'foster', 'food', 'medical', 'search', 'boarding', 'funds');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('vet', 'shelter', 'transport', 'boarding', 'training', 'store');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('open', 'in_progress', 'resolved');

-- CreateEnum
CREATE TYPE "CaseCategory" AS ENUM ('companion', 'livestock');

-- CreateEnum
CREATE TYPE "TrustLevel" AS ENUM ('verified', 'unverified', 'suspicious');

-- CreateEnum
CREATE TYPE "TrustCheckId" AS ENUM ('account', 'inAlgeria', 'photoGps', 'photoFresh', 'onSite', 'animalDetected', 'duplicate', 'rateLimit');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('pending', 'approved', 'hidden');

-- CreateEnum
CREATE TYPE "ZoneType" AS ENUM ('wildfire', 'flood', 'earthquake', 'other');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "AdoptionStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('male', 'female');

-- CreateEnum
CREATE TYPE "Housing" AS ENUM ('apartment', 'house', 'farm');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('sent', 'accepted', 'declined');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('sent', 'confirmed', 'declined');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('adoptRequest', 'adoptAccepted', 'adoptDeclined', 'listingApproved', 'listingRejected', 'booking', 'bookingConfirmed', 'bookingDeclined', 'help', 'review', 'serviceApproved', 'proActive');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT NOT NULL DEFAULT '',
    "role" "Role" NOT NULL DEFAULT 'reporter',
    "email" TEXT,
    "passwordHash" TEXT,
    "phone" TEXT,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "licenseVerified" BOOLEAN NOT NULL DEFAULT false,
    "helpTypes" "HelpType"[],
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "address" TEXT,
    "rating" DOUBLE PRECISION,
    "city" TEXT,
    "bio" TEXT,
    "photo" TEXT,
    "available" BOOLEAN,
    "serviceId" TEXT,
    "pro" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_otps" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_zones" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "type" "ZoneType" NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "polygon" geography,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "stats" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emergency_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cases" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "species" "Species" NOT NULL,
    "category" "CaseCategory" NOT NULL,
    "count" INTEGER,
    "status" "CaseStatus" NOT NULL DEFAULT 'open',
    "triage" "Triage" NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "address" TEXT,
    "location" geography,
    "photos" TEXT[],
    "description" TEXT NOT NULL,
    "conditionTags" TEXT[],
    "reporterId" TEXT NOT NULL,
    "ai" JSONB,
    "emergencyZoneId" TEXT,
    "reporterOnSite" BOOLEAN,
    "moderation" "ModerationStatus",
    "trustLevel" "TrustLevel" NOT NULL,
    "trustScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trustConfirmations" INTEGER NOT NULL DEFAULT 0,
    "trustFlags" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_helpers" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "helpType" "HelpType" NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_helpers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_confirms" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_confirms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_flags" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trust_checks" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "check" "TrustCheckId" NOT NULL,
    "ok" BOOLEAN,
    "detail" TEXT,

    CONSTRAINT "trust_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_hashes" (
    "id" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_hashes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "type" "ServiceType" NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "address" TEXT,
    "location" geography,
    "phone" TEXT,
    "openNow" BOOLEAN,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "photo" TEXT,
    "tags" TEXT[],
    "description" TEXT,
    "hours" TEXT,
    "ownerId" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "pro" BOOLEAN NOT NULL DEFAULT false,
    "status" "ServiceStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "reply" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "animal" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'sent',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adoptions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "species" "Species" NOT NULL,
    "breed" TEXT,
    "sex" "Sex" NOT NULL,
    "ageMonths" INTEGER NOT NULL,
    "photos" TEXT[],
    "healthStatus" TEXT NOT NULL,
    "vaccinations" JSONB[],
    "medicalHistory" JSONB[],
    "behavior" TEXT[],
    "careNeeds" TEXT[],
    "story" TEXT NOT NULL,
    "shelterId" TEXT,
    "ownerId" TEXT NOT NULL,
    "ownerPhone" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "address" TEXT,
    "location" geography,
    "status" "AdoptionStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adoptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adoption_requests" (
    "id" TEXT NOT NULL,
    "adoptionId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "housing" "Housing" NOT NULL,
    "experience" BOOLEAN NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'sent',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adoption_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "subject" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "phone_otps_user_idx" ON "phone_otps"("userId");

-- CreateIndex
CREATE INDEX "zones_polygon_gist" ON "emergency_zones" USING GIST ("polygon");

-- CreateIndex
CREATE INDEX "zones_active_idx" ON "emergency_zones"("active");

-- CreateIndex
CREATE INDEX "cases_location_gist" ON "cases" USING GIST ("location");

-- CreateIndex
CREATE INDEX "cases_triage_status_idx" ON "cases"("triage", "status", "moderation", "createdAt");

-- CreateIndex
CREATE INDEX "cases_reporter_idx" ON "cases"("reporterId");

-- CreateIndex
CREATE INDEX "cases_zone_idx" ON "cases"("emergencyZoneId");

-- CreateIndex
CREATE UNIQUE INDEX "case_helpers_unique" ON "case_helpers"("caseId", "userId", "helpType");

-- CreateIndex
CREATE UNIQUE INDEX "case_confirms_unique" ON "case_confirms"("caseId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "case_flags_unique" ON "case_flags"("caseId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "trust_checks_case_check" ON "trust_checks"("caseId", "check");

-- CreateIndex
CREATE INDEX "photo_hashes_subject_hash_idx" ON "photo_hashes"("subjectType", "hash");

-- CreateIndex
CREATE INDEX "photo_hashes_subject_idx" ON "photo_hashes"("subjectId");

-- CreateIndex
CREATE INDEX "services_location_gist" ON "services" USING GIST ("location");

-- CreateIndex
CREATE INDEX "services_type_idx" ON "services"("type");

-- CreateIndex
CREATE INDEX "services_status_idx" ON "services"("status");

-- CreateIndex
CREATE INDEX "services_owner_idx" ON "services"("ownerId");

-- CreateIndex
CREATE INDEX "reviews_service_idx" ON "reviews"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_service_author_unique" ON "reviews"("serviceId", "authorId");

-- CreateIndex
CREATE INDEX "bookings_service_idx" ON "bookings"("serviceId");

-- CreateIndex
CREATE INDEX "bookings_from_idx" ON "bookings"("fromId");

-- CreateIndex
CREATE INDEX "adoptions_location_gist" ON "adoptions" USING GIST ("location");

-- CreateIndex
CREATE INDEX "adoptions_status_idx" ON "adoptions"("status");

-- CreateIndex
CREATE INDEX "adoptions_owner_idx" ON "adoptions"("ownerId");

-- CreateIndex
CREATE INDEX "adoption_requests_from_idx" ON "adoption_requests"("fromId");

-- CreateIndex
CREATE UNIQUE INDEX "adoption_requests_adoption_user_unique" ON "adoption_requests"("adoptionId", "fromId");

-- CreateIndex
CREATE INDEX "notifications_user_read_idx" ON "notifications"("userId", "read", "createdAt");

-- AddForeignKey
ALTER TABLE "phone_otps" ADD CONSTRAINT "phone_otps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_emergencyZoneId_fkey" FOREIGN KEY ("emergencyZoneId") REFERENCES "emergency_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_helpers" ADD CONSTRAINT "case_helpers_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_helpers" ADD CONSTRAINT "case_helpers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_confirms" ADD CONSTRAINT "case_confirms_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_confirms" ADD CONSTRAINT "case_confirms_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_flags" ADD CONSTRAINT "case_flags_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_flags" ADD CONSTRAINT "case_flags_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_checks" ADD CONSTRAINT "trust_checks_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adoptions" ADD CONSTRAINT "adoptions_shelterId_fkey" FOREIGN KEY ("shelterId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adoptions" ADD CONSTRAINT "adoptions_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adoption_requests" ADD CONSTRAINT "adoption_requests_adoptionId_fkey" FOREIGN KEY ("adoptionId") REFERENCES "adoptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adoption_requests" ADD CONSTRAINT "adoption_requests_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- PostGIS triggers (composed into 20261003000000_init/migration.sql, AFTER the tables).
-- `CREATE EXTENSION postgis` runs at the very TOP of that file instead: the geography
-- columns must exist as a type before any table can be created.
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- The `location` columns are plain geography(Point,4326) kept in sync with lat/lng by
-- trigger. A GENERATED column would work too, but Prisma cannot model generation
-- expressions and would see drift on every `migrate dev`; a trigger keeps the DDL an
-- exact match for the schema (column + GIST index are declared in schema.prisma).
CREATE OR REPLACE FUNCTION pawlink_set_location() RETURNS trigger AS $fn$
BEGIN
  IF NEW.lat IS NULL OR NEW.lng IS NULL THEN
    NEW.location := NULL;
  ELSE
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

CREATE TRIGGER cases_set_location
  BEFORE INSERT OR UPDATE OF lat, lng ON cases
  FOR EACH ROW EXECUTE FUNCTION pawlink_set_location();

CREATE TRIGGER services_set_location
  BEFORE INSERT OR UPDATE OF lat, lng ON services
  FOR EACH ROW EXECUTE FUNCTION pawlink_set_location();

CREATE TRIGGER adoptions_set_location
  BEFORE INSERT OR UPDATE OF lat, lng ON adoptions
  FOR EACH ROW EXECUTE FUNCTION pawlink_set_location();
