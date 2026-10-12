import { HttpException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PrismaService } from '../common/prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { OTP_LENGTH, OTP_MAX_ATTEMPTS, OTP_TTL_MS, OtpService } from './otp.service';

function makePrisma() {
  return {
    phoneOtp: {
      create: jest.fn(async ({ data }: { data: { code: string } }) => ({ id: 'otp1', ...data })),
      deleteMany: jest.fn(async () => ({ count: 1 })),
      findFirst: jest.fn(async () => null as null | {
        id: string;
        userId: string;
        code: string;
        attempts: number;
      }),
      update: jest.fn(async ({ data }: { data: { attempts: number } }) => ({ id: 'otp1', ...data })),
      count: jest.fn(async () => 1),
    },
    user: { findFirst: jest.fn(async (): Promise<{ id: string } | null> => ({ id: 'u1' })) },
  };
}

function row(overrides: Partial<{ id: string; userId: string; code: string; attempts: number }> = {}) {
  return {
    id: 'otp1',
    userId: 'u1',
    code: '123456',
    attempts: 0,
    ...overrides,
  };
}

describe('OtpService', () => {
  const originalEnv = process.env.NODE_ENV;
  let prisma: ReturnType<typeof makePrisma>;
  let sms: { sendOtp: jest.Mock };
  let service: OtpService;

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    prisma = makePrisma();
    sms = { sendOtp: jest.fn(async () => undefined) };
    service = new OtpService(prisma as unknown as PrismaService, sms as unknown as SmsService);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('issue', () => {
    it('creates a 6-digit code with a 5-minute TTL and delivers it by SMS', async () => {
      const before = Date.now();
      const issued = await service.issue('u1', '+213 26 00 00 01');

      const created = prisma.phoneOtp.create.mock.calls[0][0] as {
        data: { code: string; expiresAt: Date; userId: string };
      };
      expect(created.data.userId).toBe('u1');
      expect(created.data.code).toMatch(/^\d{6}$/);
      expect(created.data.code).toHaveLength(OTP_LENGTH);
      expect(created.data.expiresAt.getTime()).toBeGreaterThanOrEqual(before + OTP_TTL_MS - 1000);
      expect(created.data.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + OTP_TTL_MS + 1000);

      expect(sms.sendOtp).toHaveBeenCalledWith('+213 26 00 00 01', created.data.code);
      expect(issued.devCode).toBe(created.data.code);
    });

    it('kills the previous code so only one is ever live', async () => {
      await service.issue('u1', '+213 26 00 00 01');
      expect(prisma.phoneOtp.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
      // the delete must happen before the create, or the new code would be erased
      const order = [
        prisma.phoneOtp.deleteMany.mock.invocationCallOrder[0],
        prisma.phoneOtp.create.mock.invocationCallOrder[0],
      ];
      expect(order[0]).toBeLessThan(order[1]);
    });

    it('never exposes the code in production', async () => {
      process.env.NODE_ENV = 'production';
      const issued = await service.issue('u1', '+213 26 00 00 01');
      expect(issued.devCode).toBeUndefined();
      // it is still delivered — the SMS path is the only channel in prod
      expect(sms.sendOtp).toHaveBeenCalledTimes(1);
    });

    it('does not put the code anywhere else in the returned object', async () => {
      const issued = await service.issue('u1', '+213 26 00 00 01');
      expect(Object.keys(issued)).toEqual(['expiresAt', 'devCode']);
    });
  });

  describe('confirm', () => {
    it('scopes the lookup to the phone when one is given', async () => {
      prisma.phoneOtp.findFirst.mockResolvedValue(row());
      await service.confirm({ phone: '+213 26 00 00 01', code: '123456' });

      expect(prisma.user.findFirst).toHaveBeenCalledWith({ where: { phone: '+213 26 00 00 01' } });
      expect(prisma.phoneOtp.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: 'u1' }) }),
      );
    });

    it('falls back to a code-only lookup when no phone is given', async () => {
      prisma.phoneOtp.findFirst.mockResolvedValue(row());
      await service.confirm({ code: '123456' });
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
      expect(prisma.phoneOtp.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ code: '123456' }) }),
      );
    });

    it('rejects an unknown phone with the same error as a wrong code', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.confirm({ phone: '+213 00 00 00 00', code: '123456' })).rejects.toMatchObject({
        status: 400,
      });
      expect(prisma.phoneOtp.findFirst).not.toHaveBeenCalled();
    });

    it('burns every code for the account on success', async () => {
      prisma.phoneOtp.findFirst.mockResolvedValue(row());
      const result = await service.confirm({ phone: '+213 26 00 00 01', code: '123456' });

      expect(result).toEqual({ userId: 'u1' });
      expect(prisma.phoneOtp.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    });

    it('rejects a wrong code with AUTH_OTP_INVALID and counts the attempt', async () => {
      prisma.phoneOtp.findFirst.mockResolvedValue(row());
      const error = await service.confirm({ phone: '+213 26 00 00 01', code: '999999' }).catch((e) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(400);
      expect((error as HttpException).getResponse()).toMatchObject({ code: 'AUTH_OTP_INVALID' });
      expect(prisma.phoneOtp.update).toHaveBeenCalledWith({
        where: { id: 'otp1' },
        data: { attempts: 1 },
      });
    });

    it('kills the code on the 5th wrong attempt with AUTH_OTP_TOO_MANY_ATTEMPTS', async () => {
      prisma.phoneOtp.findFirst.mockResolvedValue(row({ attempts: OTP_MAX_ATTEMPTS - 1 }));
      const error = await service.confirm({ phone: '+213 26 00 00 01', code: '999999' }).catch((e) => e);

      expect((error as HttpException).getStatus()).toBe(429);
      expect((error as HttpException).getResponse()).toMatchObject({ code: 'AUTH_OTP_TOO_MANY_ATTEMPTS' });
      expect(prisma.phoneOtp.update).toHaveBeenCalledWith({
        where: { id: 'otp1' },
        data: { attempts: OTP_MAX_ATTEMPTS },
      });
    });

    it('refuses a row that already burned its attempts', async () => {
      prisma.phoneOtp.findFirst.mockResolvedValue(row({ attempts: OTP_MAX_ATTEMPTS }));
      const error = await service.confirm({ phone: '+213 26 00 00 01', code: '123456' }).catch((e) => e);

      expect((error as HttpException).getStatus()).toBe(429);
      expect(prisma.phoneOtp.deleteMany).not.toHaveBeenCalled();
    });

    it('rejects a code of the wrong length without touching the database', async () => {
      await expect(service.confirm({ code: '123' })).rejects.toMatchObject({ status: 400 });
      await expect(service.confirm({ code: '1234567' })).rejects.toMatchObject({ status: 400 });
      expect(prisma.phoneOtp.findFirst).not.toHaveBeenCalled();
    });

    it('rejects when no live row exists (expired or already used)', async () => {
      prisma.phoneOtp.findFirst.mockResolvedValue(null);
      await expect(service.confirm({ code: '123456' })).rejects.toMatchObject({ status: 400 });
    });
  });

  describe('countLive', () => {
    it('counts only unexpired codes', async () => {
      await service.countLive('u1');
      expect(prisma.phoneOtp.count).toHaveBeenCalledWith({
        where: { userId: 'u1', expiresAt: { gt: expect.any(Date) } },
      });
    });
  });
});
