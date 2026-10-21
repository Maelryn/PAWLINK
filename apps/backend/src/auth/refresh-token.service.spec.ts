import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PrismaService } from '../common/prisma/prisma.service';
import { RefreshTokenService } from './refresh-token.service';

type Row = { id: string; jti: string; userId: string; expiresAt: Date; revokedAt: Date | null } & Record<
  string,
  unknown
>;

/** The shape of the arguments the service passes to `updateMany` / `deleteMany`. */
type Filter = { where: Record<string, unknown>; data?: Record<string, unknown> };

function makeRow(overrides: Partial<Row> = {}): Row {
  return {
    id: 'rt1',
    jti: 'jti-1',
    userId: 'u1',
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    ...overrides,
  };
}

function makePrisma(row: Row | null = makeRow()) {
  return {
    refreshToken: {
      create: jest.fn(async ({ data }: { data: Row }) => ({ ...data, id: 'rt1' }) as Row),
      findUnique: jest.fn(async (_args: { where: { jti: string } }) => row),
      updateMany: jest.fn(async (_args: Filter) => ({ count: 1 })),
      deleteMany: jest.fn(async (_args: Filter) => ({ count: 3 })),
    },
  };
}

describe('RefreshTokenService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: RefreshTokenService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new RefreshTokenService(prisma as unknown as PrismaService);
  });

  describe('issue', () => {
    it('writes the row the token can be found by', async () => {
      const expiresAt = new Date(Date.now() + 60_000);
      await service.issue('u1', 'jti-1', expiresAt);

      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: { userId: 'u1', jti: 'jti-1', expiresAt },
      });
    });
  });

  describe('find', () => {
    it('finds the row by its jti', async () => {
      const row = await service.find('jti-1');

      expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({ where: { jti: 'jti-1' } });
      expect(row?.userId).toBe('u1');
    });

    it('returns null for a token it never issued', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null as never);

      await expect(service.find('ghost')).resolves.toBeNull();
    });
  });

  describe('revoke', () => {
    it('marks the token revoked, with the reason', async () => {
      await service.revoke('jti-1', 'rotated');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { jti: 'jti-1', revokedAt: null },
        data: { revokedAt: expect.any(Date), revokedReason: 'rotated' },
      });
    });

    it('never revives a token that is already dead', async () => {
      // The `revokedAt: null` guard is what keeps the original death date, so
      // "when did this token die" has one honest answer.
      await service.revoke('jti-1', 'logout');

      const where = prisma.refreshToken.updateMany.mock.calls[0][0].where;
      expect(where).toMatchObject({ revokedAt: null });
    });
  });

  describe('revokeAllForUser', () => {
    it('kills every live session of the account', async () => {
      const killed = await service.revokeAllForUser('u1', 'reuse');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', revokedAt: null },
        data: { revokedAt: expect.any(Date), revokedReason: 'reuse' },
      });
      expect(killed).toBe(1);
    });
  });

  describe('prune', () => {
    it('deletes only the expired rows', async () => {
      // A revoked-but-unexpired row is the evidence that lets a replay be
      // recognised, so it must survive until the token would have expired.
      await service.prune();

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      });
    });
  });
});
