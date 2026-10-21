import { NotFoundException } from '@nestjs/common';
import type { HelpType } from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PrismaService } from '../common/prisma/prisma.service';
import { isSignableRole, normalizeEmail, UsersService } from './users.service';

type Row = { id: string } & Record<string, unknown>;

function makeRow(overrides: Partial<Row> = {}): Row {
  return { id: 'u1', email: 'a@pawlink.dz', passwordHash: 'hash', phoneVerified: false, ...overrides };
}

function makePrisma(row: Row | null = makeRow()) {
  return {
    user: {
      findUnique: jest.fn(async () => row),
      findFirst: jest.fn(async () => row),
      create: jest.fn(async ({ data }: { data: Row }) => ({ ...data, id: 'new' }) as Row),
      update: jest.fn(async ({ data }: { data: Row }) => ({ ...row, ...data }) as Row),
    },
    phoneOtp: { deleteMany: jest.fn(async () => ({ count: 2 })) },
  };
}

describe('normalizeEmail', () => {
  it('trims and lowercases, like the web signIn does', () => {
    expect(normalizeEmail('  Yasmine@PawLink.DZ ')).toBe('yasmine@pawlink.dz');
  });
});

describe('isSignableRole', () => {
  it('accepts the three self-serve roles', () => {
    expect(isSignableRole('reporter')).toBe(true);
    expect(isSignableRole('volunteer')).toBe(true);
    expect(isSignableRole('vet')).toBe(true);
  });

  it('rejects admin and anything else', () => {
    expect(isSignableRole('admin')).toBe(false);
    expect(isSignableRole('pro')).toBe(false);
    expect(isSignableRole(undefined)).toBe(false);
  });
});

describe('UsersService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: UsersService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new UsersService(prisma as unknown as PrismaService);
  });

  describe('findByEmail', () => {
    it('looks up the normalized address', async () => {
      await service.findByEmail('  A@PawLink.DZ ');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'a@pawlink.dz' },
      });
    });
  });

  describe('create', () => {
    it('always starts unverified, with a hashed password and no license', async () => {
      const created = await service.create({
        name: 'Nour Benali',
        email: 'Nour@PawLink.dz',
        passwordHash: 'argon2hash',
        phone: '+213 26 00 00 07',
        role: 'vet',
      });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'nour@pawlink.dz',
          role: 'vet',
          phoneVerified: false,
          licenseVerified: false,
          passwordHash: 'argon2hash',
          avatar: '',
        }),
      });
      // a vet sign-up is stored as a vet but is NOT license-verified yet
      expect(created.licenseVerified).toBe(false);
    });

    it('passes optional city and helpTypes through', async () => {
      await service.create({
        name: 'Amine',
        email: 'amine@pawlink.dz',
        passwordHash: 'h',
        phone: '+213 26 00 00 02',
        role: 'volunteer',
        city: 'Tizi Ouzou',
        helpTypes: ['transport', 'search'] as HelpType[],
      });
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ city: 'Tizi Ouzou', helpTypes: ['transport', 'search'] }),
      });
    });
  });

  describe('updateProfile', () => {
    it('only writes the fields that were provided', async () => {
      await service.updateProfile('u1', { city: 'Oran' });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { city: 'Oran' },
      });
    });

    it('writes an empty payload when nothing was provided', async () => {
      await service.updateProfile('u1', {});
      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: {} });
    });

    it('can null out location fields', async () => {
      await service.updateProfile('u1', { lat: null, lng: null, address: null });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { lat: null, lng: null, address: null },
      });
    });
  });

  describe('clearOtps', () => {
    it('deletes every code for that user', async () => {
      expect(await service.clearOtps('u1')).toBe(2);
      expect(prisma.phoneOtp.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    });
  });

  describe('anonymize', () => {
    it('blanks personal data and nulls the password hash (the deletion marker)', async () => {
      await service.anonymize('u1');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: expect.objectContaining({ email: null, passwordHash: null, phone: null, name: 'Compte supprimé' }),
      });
    });

    it('surfaces a missing row as 404', async () => {
      prisma.user.update.mockRejectedValue(
        new NotFoundException('User to update not found') as unknown as Error,
      );
      await expect(service.anonymize('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
