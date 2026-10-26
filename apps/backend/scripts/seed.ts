import 'dotenv/config';
import { hash } from '@node-rs/argon2';
import { Prisma, PrismaClient } from '@prisma/client';
import type { TrustCheckId } from '@prisma/client';
import { prismaClientOptions } from '../src/common/prisma/client-options';
import {
  ADOPTIONS,
  CASES,
  DEMO_PASSWORD,
  EMERGENCY_ZONES,
  REVIEWS,
  SERVICES,
  USERS,
} from '../src/seed/data';

/**
 * Ports the frontend demo scenario (apps/web/lib/mock/data.ts) into PostgreSQL.
 * Re-runnable: every insert uses explicit ids + skipDuplicates.
 *
 *   npm run seed
 *
 * Password for every demo account = DEMO_PASSWORD (pawlink2026), argon2-hashed.
 * Admin accounts are NEVER created here — use `npm run seed:admin`.
 */

const prisma = new PrismaClient(prismaClientOptions());

async function main(): Promise<void> {
  const passwordHash = await hash(DEMO_PASSWORD);

  // ── users ──
  await prisma.user.createMany({
    data: USERS.map((u) => ({
      id: u.id,
      name: u.name,
      avatar: u.avatar ?? '',
      role: u.role,
      email: u.email,
      passwordHash,
      phone: u.phone,
      phoneVerified: u.phoneVerified ?? false,
      licenseVerified: u.licenseVerified ?? false,
      helpTypes: u.helpTypes ?? [],
      lat: u.location?.lat,
      lng: u.location?.lng,
      address: u.location?.address,
      rating: u.rating,
      city: u.city,
      bio: u.bio,
      photo: u.photo,
      available: u.available,
      serviceId: u.serviceId,
      pro: (u.pro as Prisma.InputJsonValue | undefined) ?? undefined,
      createdAt: u.createdAt ? new Date(u.createdAt) : undefined,
    })),
    skipDuplicates: true,
  });

  // ── emergency zones (polygon goes through GeoJSON, Prisma never touches geography) ──
  for (const z of EMERGENCY_ZONES) {
    await prisma.emergencyZone.createMany({
      data: [
        {
          id: z.id,
          name: z.name,
          region: z.region,
          type: z.type,
          lat: z.center.lat,
          lng: z.center.lng,
          active: z.active,
          startedAt: new Date(z.startedAt),
          stats: z.stats as unknown as Prisma.InputJsonValue,
          createdAt: new Date(z.startedAt),
        },
      ],
      skipDuplicates: true,
    });
    await prisma.$executeRaw`
      UPDATE emergency_zones
      SET polygon = ST_GeomFromGeoJSON(${JSON.stringify(z.polygon)})::geography
      WHERE id = ${z.id} AND polygon IS NULL`;
  }

  // ── cases + helpers + trust checks ──
  await prisma.case.createMany({
    data: CASES.map((c) => ({
      id: c.id,
      title: c.title,
      species: c.species,
      category: c.category,
      count: c.count,
      status: c.status,
      triage: c.triage,
      lat: c.location.lat,
      lng: c.location.lng,
      address: c.location.address,
      photos: c.photos,
      description: c.description,
      conditionTags: c.conditionTags,
      reporterId: c.reporter.id,
      emergencyZoneId: c.emergencyZoneId,
      reporterOnSite: c.reporterOnSite,
      moderation: c.moderation ?? null,
      trustLevel: c.trust?.level ?? 'unverified',
      trustScore: c.trust?.score ?? 0,
      trustConfirmations: c.trust?.confirmations ?? 0,
      trustFlags: c.trust?.flags ?? 0,
      createdAt: new Date(c.createdAt),
      updatedAt: new Date(c.updatedAt),
    })),
    skipDuplicates: true,
  });

  for (const c of CASES) {
    if (c.helpers.length > 0) {
      await prisma.caseHelper.createMany({
        data: c.helpers.map((h) => ({
          caseId: c.id,
          userId: h.user.id,
          helpType: h.helpType,
        })),
        skipDuplicates: true,
      });
    }
    if (c.trust) {
      await prisma.trustCheck.createMany({
        data: c.trust.checks.map((ch) => ({
          caseId: c.id,
          check: ch.id as TrustCheckId,
          ok: ch.ok,
          detail: ch.detail,
        })),
        skipDuplicates: true,
      });
    }
  }

  // ── services (after users: ownerId points at u3) ──
  await prisma.service.createMany({
    data: SERVICES.map((s) => ({
      id: s.id,
      type: s.type,
      name: s.name,
      lat: s.location.lat,
      lng: s.location.lng,
      address: s.location.address,
      phone: s.phone,
      openNow: s.openNow,
      rating: s.rating,
      reviewCount: s.reviewCount,
      photo: s.photo,
      tags: s.tags ?? [],
      description: s.description,
      hours: s.hours,
      ownerId: s.ownerId,
      verified: s.verified ?? false,
      pro: s.pro ?? false,
      status: s.status ?? 'pending',
    })),
    skipDuplicates: true,
  });

  // ── reviews ──
  await prisma.review.createMany({
    data: REVIEWS.map((r) => ({
      id: r.id,
      serviceId: r.serviceId,
      authorId: r.author.id,
      rating: r.rating,
      text: r.text,
      reply: r.reply,
      createdAt: new Date(r.createdAt),
    })),
    skipDuplicates: true,
  });

  // ── adoption listings ──
  await prisma.adoption.createMany({
    data: ADOPTIONS.map((a) => ({
      id: a.id,
      name: a.name,
      species: a.species,
      breed: a.breed,
      sex: a.sex,
      ageMonths: a.ageMonths,
      photos: a.photos,
      healthStatus: a.healthStatus,
      vaccinations: a.vaccinations as unknown as Prisma.InputJsonValue[],
      medicalHistory: a.medicalHistory as unknown as Prisma.InputJsonValue[],
      behavior: a.behavior,
      careNeeds: a.careNeeds,
      story: a.story,
      shelterId: a.shelter.id,
      ownerId: a.ownerId,
      ownerPhone: a.ownerPhone,
      lat: a.location.lat,
      lng: a.location.lng,
      address: a.location.address,
      status: a.status,
      createdAt: new Date(a.createdAt),
    })),
    skipDuplicates: true,
  });

  const counts = await Promise.all([
    prisma.user.count(),
    prisma.emergencyZone.count(),
    prisma.case.count(),
    prisma.caseHelper.count(),
    prisma.trustCheck.count(),
    prisma.service.count(),
    prisma.review.count(),
    prisma.adoption.count(),
  ]);
  const [users, zones, cases, helpers, checks, services, reviews, adoptions] = counts;
  console.log(
    `Seed complete — users:${users} zones:${zones} cases:${cases} helpers:${helpers} trustChecks:${checks} services:${services} reviews:${reviews} adoptions:${adoptions}`,
  );
  console.log(`Demo sign-in: any seeded email / ${DEMO_PASSWORD} (admin comes from seed:admin)`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
