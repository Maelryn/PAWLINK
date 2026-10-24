import { describe, expect, it, jest } from '@jest/globals';
import type { PrismaService } from '../common/prisma/prisma.service';
import type { UsersService } from '../users/users.service';
import type { GeoService } from '../geo/geo.service';
import type { UploadsService } from '../uploads/uploads.service';
import type { RealtimeGateway } from '../realtime/realtime.gateway';
import type { NotificationsService } from '../notifications/notifications.service';
import { ExifService } from '../uploads/exif.service';
import { TrustService } from './trust.service';
import { AIService } from '../ai/ai.service';
import { CasesService } from './cases.service';
import type { CreateCaseDto } from './dto/create-case.dto';

/**
 * CasesService, with every collaborator stubbed.
 *
 * Two regressions are pinned here because only a unit test can pin them:
 *
 *   - the row returned **from inside** `create`'s transaction is written before
 *     the `trust_checks`, so serialising it straight away would answer with
 *     eight `ok: null` checks. The service re-reads the case, and the stub
 *     returns different rows on the two calls to prove it.
 *   - `Prisma.join([])` throws on an empty array, so an unfiltered admin list
 *     must not build a `WHERE` out of nothing.
 *
 * The SQL itself is asserted loosely — the exact statement is what the e2e suite
 * proves against a real PostGIS.
 */

const KABYLIE = { lat: 36.632, lng: 4.205 };

interface Row {
  id: string;
  title: string;
  triage: string;
  status: string;
  lat: number;
  lng: number;
  address: string | null;
  photos: string[];
  description: string;
  conditionTags: string[];
  reporterId: string;
  emergencyZoneId: string | null;
  reporterOnSite: boolean | null;
  moderation: string | null;
  trustLevel: string;
  trustScore: number;
  trustConfirmations: number;
  trustFlags: number;
  createdAt: Date;
  updatedAt: Date;
  ai: Record<string, unknown> | null;
  reporter: { id: string; name: string; avatar: string };
  helpers: Array<{ user: { id: string; name: string; avatar: string }; helpType: string }>;
  confirms: unknown[];
  flags: unknown[];
  trustChecks: Array<{ check: string; ok: boolean | null; detail: string | null }>;
}

/** The same checks, with the Algeria check failing — what a Paris pin produces. */
const CHECKS_HELD = [
  { check: 'account', ok: true, detail: null },
  { check: 'inAlgeria', ok: false, detail: "Le point (48.8566, 2.3522) est hors d'Algérie" },
  { check: 'photoGps', ok: null, detail: null },
  { check: 'photoFresh', ok: null, detail: null },
  { check: 'onSite', ok: null, detail: null },
  { check: 'animalDetected', ok: null, detail: null },
  { check: 'duplicate', ok: true, detail: null },
  { check: 'rateLimit', ok: true, detail: null },
];

const CHECKS = [
  { check: 'account', ok: true, detail: null },
  { check: 'inAlgeria', ok: true, detail: null },
  { check: 'photoGps', ok: null, detail: null },
  { check: 'photoFresh', ok: null, detail: null },
  { check: 'onSite', ok: null, detail: null },
  { check: 'animalDetected', ok: null, detail: null },
  { check: 'duplicate', ok: true, detail: null },
  { check: 'rateLimit', ok: true, detail: null },
];

function row(overrides: Partial<Row> = {}): Row {
  return {
    id: 'case-1',
    title: 'Chaton coincé',
    triage: 'urgent',
    status: 'open',
    lat: KABYLIE.lat,
    lng: KABYLIE.lng,
    address: 'Tizi Ouzou',
    photos: [],
    description: 'un chaton coincé',
    conditionTags: ['trapped'],
    reporterId: 'u1',
    emergencyZoneId: null,
    reporterOnSite: null,
    moderation: null,
    trustLevel: 'verified',
    trustScore: 0.86,
    trustConfirmations: 0,
    trustFlags: 0,
    createdAt: new Date('2026-10-10T10:00:00Z'),
    updatedAt: new Date('2026-10-10T10:00:00Z'),
    ai: null,
    reporter: { id: 'u1', name: 'Amina', avatar: '' },
    helpers: [],
    confirms: [],
    flags: [],
    trustChecks: CHECKS,
    ...overrides,
  };
}

/**
 * A `Prisma.sql` template stringifies to `[object Object]`, but its `strings`
 * are the SQL text and its `values` the bound parameters. Flattening both is
 * what lets a stub assert on the statement the service really builds.
 */
function readSql(query: unknown): string {
  const sql = query as { strings?: string[]; values?: unknown[] };
  if (!sql?.strings) return String(query);
  const values = sql.values ?? [];
  return sql.strings
    .map((part, index) => (index < values.length ? `${part}$${index + 1}` : part))
    .join('');
}

/** A Prisma stub whose `$queryRaw` records what was asked. */
function prismaStub(options: {
  rows?: Row[];
  count?: number;
} = {}) {
  const statements: string[] = [];
  const written: Array<{ where: string; data: Record<string, unknown> }> = [];

  const caseDelegate = {
    count: async () => options.count ?? 0,
    findUnique: async () => options.rows?.[0] ?? null,
    findUniqueOrThrow: async () => options.rows?.[0] ?? null,
    findMany: async ({ where }: { where?: { id?: { in: string[] } } } = {}) => {
      const rows = options.rows ?? [];
      return where?.id?.in ? rows.filter((r) => where.id!.in.includes(r.id)) : rows;
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      written.push({ where: 'case.create', data });
      return row();
    },
    delete: async ({ where }: { where: { id: string } }) => {
      written.push({ where: 'case.delete', data: where });
      return { id: where.id };
    },
    update: async ({ data }: { data: Record<string, unknown> }) => {
      written.push({ where: 'case.update', data });
      return row({ moderation: data.moderation as string | null, trustFlags: data.trustFlags as number, trustConfirmations: data.trustConfirmations as number, trustScore: data.trustScore as number, trustLevel: data.trustLevel as string, status: data.status as string });
    },
  };

  /** The delegates the service touches outside a transaction. */
  const delegates = {
    case: caseDelegate,
    trustCheck: { createMany: async (input: { data: unknown[] }) => ({ count: input.data.length }) },
    photoHash: { createMany: async (input: { data: unknown[] }) => ({ count: input.data.length }) },
    caseHelper: {
      deleteMany: async () => ({ count: 0 }),
      create: async ({ data }: { data: Record<string, unknown> }) => ({ id: 'helper-1', ...data }),
    },
    caseConfirm: { create: async () => ({ id: 'confirm-1' }) },
    caseFlag: { create: async () => ({ id: 'flag-1' }) },
    notification: {
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        written.push({ where: 'notification.deleteMany', data: where });
        return { count: 0 };
      },
      create: async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'notification-1',
        userId: data.userId,
        kind: data.kind,
        subject: data.subject,
        href: data.href,
        read: false,
        createdAt: new Date('2026-10-10T10:00:00Z'),
      }),
    },
  };

  const prisma = {
    ...delegates,
    emergencyZone: { findUnique: async () => null },
    photoProbe: {},
    $queryRaw: async (query: unknown) => {
      statements.push(readSql(query));
      return [{ id: 'case-1', total: 1 }];
    },
    $transaction: async (arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(delegates),
  };

  return { prisma: prisma as unknown as PrismaService, statements, written, delegates };
}

function service(prisma: unknown, overrides: { geo?: unknown; uploads?: unknown } = {}) {
  const realtime = {
    caseCreated: jest.fn(),
    caseUpdated: jest.fn(),
    helpOffered: jest.fn(),
    notification: jest.fn(),
  } as unknown as RealtimeGateway;

  return {
    realtime,
    service: new CasesService(
      prisma as PrismaService,
      { findById: async () => ({ id: 'u1', phoneVerified: true, passwordHash: 'hash' }) } as unknown as UsersService,
      (overrides.geo as GeoService) ?? { inAlgeria: async () => ({ ok: true, detail: 'en Algérie' }) },
      new TrustService(new ExifService()),
      (overrides.uploads as UploadsService) ?? { consume: async () => [] },
      { hashOrNull: async () => null } as never,
      realtime,
      // Phase 3 extracted the notification write + push into a shared service;
      // cases now delegates to it (the row + socket assertion lives there).
      { notify: async () => ({ id: 'notification-1' }) } as unknown as NotificationsService,
      { analyze: async () => ({ triage: 'stable', confidence: 0.5, summary: 's', observedSigns: [], safetyAdvice: [], possiblyContagious: false, recommendedHelp: [], suggestedServices: [], suggestedHelpers: [], forcedUrgentByRule: false, disclaimer: 'd', model: 'mock' }) } as unknown as AIService,
    ),
  };
}

function dto(overrides: Partial<CreateCaseDto> = {}): CreateCaseDto {
  return {
    title: 'Chaton coincé',
    species: 'cat',
    category: 'companion',
    location: { lat: KABYLIE.lat, lng: KABYLIE.lng, address: 'Tizi Ouzou' },
    description: 'un chaton coincé sous un portail',
    conditionTags: ['trapped'],
    photos: [],
    probeIds: [],
    ...overrides,
  } as CreateCaseDto;
}

const USER = { sub: 'u1', role: 'reporter', name: 'Amina' } as const;

describe('list — the map query', () => {
  it('builds one raw statement that gates on moderation', async () => {
    const { prisma, statements } = prismaStub();
    await service(prisma).service.list({
      bbox: { minLng: 3.9, minLat: 36.5, maxLng: 4.4, maxLat: 36.9 },
      page: 1,
      pageSize: 200,
    });

    const statement = statements.join('\n');
    expect(statement).toContain('ST_MakeEnvelope');
    expect(statement).toContain('moderation IS NULL OR moderation = \'approved\'');
    expect(statement).toContain('COUNT(*) OVER ()');
    expect(statement).toContain('LIMIT');
    // one statement, not a filter-and-then-recount pair
    expect(statements).toHaveLength(1);
  });

  it('orders urgent first, then createdAt DESC', async () => {
    const { prisma, statements } = prismaStub();
    await service(prisma).service.list({ page: 1, pageSize: 10 });
    expect(statements[0]).toContain('CASE triage WHEN \'urgent\' THEN 0');
    expect(statements[0]).toContain('"createdAt" DESC');
  });

  it('lets a signed-in reporter see their own held case in the gate', async () => {
    const { prisma, statements } = prismaStub();
    await service(prisma).service.list({ page: 1, pageSize: 10 }, { sub: 'u9', role: 'reporter' });
    expect(statements[0]).toContain('"reporterId"');
  });

  it('caps the page size at 500 and keeps the total from the window count', async () => {
    const { prisma } = prismaStub({ rows: [row({ moderation: null, ai: null })] });
    const page = await service(prisma).service.list({ page: 1, pageSize: 5000 });
    // the stub returns a window total of 1, and one row
    expect(page.total).toBe(1);
    expect(page.items).toHaveLength(1);
  });
});

describe('listForAdmin — the moderation queue', () => {
  it('has no moderation gate, and works with no filters at all', async () => {
    // This is the `Prisma.join([])` regression: an empty WHERE array throws.
    const { prisma, statements } = prismaStub({ rows: [row()] });
    const page = await service(prisma).service.listForAdmin({ page: 1, pageSize: 10 });

    expect(statements).toHaveLength(1);
    expect(statements[0]).toContain('WHERE TRUE');
    expect(statements[0]).not.toContain('moderation IS NULL');
    expect(page.items).toHaveLength(1);
  });
});

describe('create — the trust pipeline wiring', () => {
  it('refuses the 6th report in the hour with TRUST_RATE_LIMITED', async () => {
    const stub = prismaStub({ count: 5 });
    const { realtime } = service(stub.prisma);

    await expect(service(stub.prisma).service.create(dto(), USER)).rejects.toMatchObject({
      status: 429,
    });
    expect(realtime.caseCreated).not.toHaveBeenCalled();
  });

  it('lets the 5th through', async () => {
    const stub = prismaStub({ count: 4, rows: [row()] });
    const { service: svc } = service(stub.prisma);
    await expect(svc.create(dto(), USER)).resolves.toBeDefined();
  });

  it('insists on one probe per photo', async () => {
    const { prisma } = prismaStub();
    await expect(
      service(prisma).service.create(dto({ photos: ['https://x/y.jpg'], probeIds: [] }), USER),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('re-reads the case after the transaction so the trust checks are in the response', async () => {
    // The create-with-include runs before the checks are written, so its
    // `trustChecks` is empty. A second read is what fixes the response.
    const { prisma } = prismaStub({ rows: [row({ trustChecks: CHECKS })] });
    const created = await service(prisma).service.create(dto(), USER);

    expect(created.trust?.checks.map((c) => c.id)).toEqual([
      'account',
      'inAlgeria',
      'photoGps',
      'photoFresh',
      'onSite',
      'animalDetected',
      'duplicate',
      'rateLimit',
    ]);
    expect(created.trust?.checks.find((c) => c.id === 'account')?.ok).toBe(true);
  });

  it('broadcasts case.created for a public case and returns trust', async () => {
    const stub = prismaStub({ rows: [row()] });
    const { service: svc, realtime } = service(stub.prisma);
    const created = await svc.create(dto(), USER);

    expect(created.id).toBe('case-1');
    expect(created.trust?.level).toBe('verified');
    expect(realtime.caseCreated).toHaveBeenCalledTimes(1);
  });

  it('holds a suspicious case for moderation and does not broadcast it', async () => {
    const held = row({ moderation: 'pending', trustLevel: 'suspicious', trustChecks: CHECKS_HELD });
    const stub = prismaStub({ rows: [held] });
    const { service: svc, realtime } = service(stub.prisma, {
      uploads: {
        consume: async () => [{ probeId: 'p1', exif: {}, dHash: 'deadbeefdeadbeef' }],
      } as unknown as UploadsService,
      geo: { inAlgeria: async () => ({ ok: false, detail: 'hors d Algérie' }) },
    });

    const created = await svc.create(dto(), USER);

    expect(created.moderation).toBe('pending');
    expect(realtime.caseCreated).not.toHaveBeenCalled();
    // the pin outside Algeria is what held it
    expect(created.trust?.checks.find((c) => c.id === 'inAlgeria')?.ok).toBe(false);
  });
});

describe('confirm / flag / status', () => {
  /** Somebody else than the reporter (`u1`), standing on the pin. */
  const OTHER = { sub: 'u2', role: 'reporter', name: 'Karim' } as const;
  const NEAR = { seen: true, lat: KABYLIE.lat, lng: KABYLIE.lng };

  it('counts a "yes" from somebody standing next to the animal', async () => {
    const stub = prismaStub({ rows: [row({ trustLevel: 'unverified', trustScore: 0.6 })] });
    await service(stub.prisma).service.confirm('case-1', NEAR, OTHER);

    expect(stub.written.at(-1)?.data).toMatchObject({
      trustConfirmations: 1,
      trustScore: 0.72,
      trustLevel: 'unverified',
    });
  });

  it('verifies the report on the second "yes"', async () => {
    const stub = prismaStub({
      rows: [
        row({
          trustLevel: 'unverified',
          trustScore: 0.6,
          trustConfirmations: 1,
          confirms: [{ userId: 'u3', seen: true }],
        }),
      ],
    });
    await service(stub.prisma).service.confirm('case-1', NEAR, OTHER);
    expect(stub.written.at(-1)?.data).toMatchObject({
      trustConfirmations: 2,
      trustLevel: 'verified',
    });
  });

  it('refuses an answer from more than 1 km away', async () => {
    const stub = prismaStub({ rows: [row()] });
    await expect(
      service(stub.prisma).service.confirm('case-1', { seen: true, lat: 36.9, lng: 4.5 }, OTHER),
    ).rejects.toMatchObject({ status: 403 });
    // Nothing was written: the distance is checked before the answer is stored.
    expect(stub.written).toHaveLength(0);
  });

  it('refuses the reporter answering their own report', async () => {
    const stub = prismaStub({ rows: [row()] });
    await expect(service(stub.prisma).service.confirm('case-1', NEAR, USER)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('refuses a second answer from the same account', async () => {
    const stub = prismaStub({ rows: [row({ confirms: [{ userId: 'u2', seen: true }] })] });
    await expect(service(stub.prisma).service.confirm('case-1', NEAR, OTHER)).rejects.toMatchObject({
      status: 409,
    });
  });

  it('sends the report back to moderation on two "no"', async () => {
    const stub = prismaStub({
      rows: [
        row({
          trustLevel: 'unverified',
          trustScore: 0.5,
          // This is the second "no": the first one is already stored.
          confirms: [{ userId: 'u3', seen: false }],
        }),
      ],
    });
    await service(stub.prisma).service.confirm(
      'case-1',
      { seen: false, lat: KABYLIE.lat, lng: KABYLIE.lng },
      OTHER,
    );

    expect(stub.written.at(-1)?.data).toMatchObject({
      trustLevel: 'suspicious',
      moderation: 'pending',
      trustScore: 0.38,
    });
  });

  it('puts the case back into pending on the third flag', async () => {
    const stub = prismaStub({ rows: [row({ trustFlags: 2 })] });
    const { prisma } = stub;
    const result = await service(prisma).service.flag('case-1', { reason: 'spam' }, USER);
    expect(result.trust?.flags).toBe(3);
    expect(result.moderation).toBe('pending');
  });

  it('refuses a status change from a reporter', async () => {
    const { prisma } = prismaStub();
    await expect(
      service(prisma).service.updateStatus('case-1', { status: 'resolved' }, USER),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('allows a status change from a volunteer', async () => {
    const stub = prismaStub({ rows: [row()] });
    const { service: svc, realtime } = service(stub.prisma);
    await svc.updateStatus('case-1', { status: 'in_progress' }, { sub: 'u2', role: 'volunteer', name: 'Yacine' });
    expect(realtime.caseUpdated).toHaveBeenCalledTimes(1);
  });
});

describe('findOne', () => {
  it('is a 404 for a held case seen by a stranger', async () => {
    const stub = prismaStub({ rows: [row({ moderation: 'pending' })] });
    const { prisma } = stub;
    await expect(service(prisma).service.findOne('case-1')).rejects.toMatchObject({ status: 404 });
  });

  it('is readable by its own reporter', async () => {
    const stub = prismaStub({ rows: [row({ moderation: 'pending' })] });
    const { prisma } = stub;
    await expect(
      service(prisma).service.findOne('case-1', { sub: 'u1', role: 'reporter' }),
    ).resolves.toBeDefined();
  });
});

describe('my reports and the reporter’s own edits', () => {
  it('lists the reports the caller made, and only those', async () => {
    const stub = prismaStub({ rows: [row()], count: 1 });
    const page = await service(stub.prisma).service.mine('u1', 1, 20);

    expect(page).toMatchObject({ total: 1, page: 1, pageSize: 20 });
    expect(page.items).toHaveLength(1);
  });

  it('holds the change for a moderator when the report is public', async () => {
    const stub = prismaStub({ rows: [row()] });
    await service(stub.prisma).service.update('case-1', { description: 'corrigé' }, USER);

    const write = stub.written.find((w) => w.where === 'case.update');
    expect(write?.data.description).toBeUndefined();
    expect(write?.data.pendingEdit).toMatchObject({ description: 'corrigé' });
  });

  it('applies the change straight away while the report is still held for moderation', async () => {
    const stub = prismaStub({ rows: [row({ moderation: 'pending' })] });
    await service(stub.prisma).service.update('case-1', { description: 'corrigé' }, USER);

    const write = stub.written.find((w) => w.where === 'case.update');
    expect(write?.data.description).toBe('corrigé');
  });

  it('refuses a change from anybody but the reporter', async () => {
    const stub = prismaStub({ rows: [row()] });
    await expect(
      service(stub.prisma).service.update('case-1', { description: 'x' }, { sub: 'u2', role: 'reporter', name: 'K' } as never),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('refuses a deletion from anybody but the reporter', async () => {
    const stub = prismaStub({ rows: [row()] });
    await expect(
      service(stub.prisma).service.remove('case-1', { sub: 'u2', role: 'reporter', name: 'K' } as never),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('deletes the report and the notifications that pointed at it', async () => {
    const stub = prismaStub({ rows: [row()] });
    await service(stub.prisma).service.remove('case-1', USER);

    expect(stub.written).toEqual([
      { where: 'case.delete', data: { id: 'case-1' } },
      { where: 'notification.deleteMany', data: { href: { startsWith: '/cases/case-1' } } },
    ]);
  });
});
