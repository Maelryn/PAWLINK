import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { ApiError } from '../common/filters/http-exception.filter';
import { isProduction } from '../common/env';
import { PrismaService } from '../common/prisma/prisma.service';
import { SmsService } from '../sms/sms.service';

/** Contract: 6 digits, 5 minutes, 5 attempts (docs/BACKEND_PROMPT.md §3.2). */
export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;

export interface ConfirmOtpInput {
  code: string;
  /** Optional but recommended: scopes the lookup to a single account. */
  phone?: string;
}

/**
 * What a caller learns after issuing a code. The code itself is deliberately
 * **not** part of this object — only `devCode`, which exists solely outside
 * production — so the API structurally cannot echo a live code in prod.
 */
export interface IssuedOtp {
  expiresAt: Date;
  devCode?: string;
}

interface LiveOtpRow {
  id: string;
  userId: string;
  code: string;
  attempts: number;
}

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
  ) {}

  /**
   * Issues a fresh code and delivers it. Every previous code for the account
   * dies here, so exactly one code is ever live per phone — which is what makes
   * `POST /auth/resend-code` safe.
   */
  async issue(userId: string, phone: string): Promise<IssuedOtp> {
    const code = String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await this.prisma.phoneOtp.deleteMany({ where: { userId } });
    await this.prisma.phoneOtp.create({ data: { userId, code, expiresAt } });
    await this.sms.sendOtp(phone, code);

    const issued: IssuedOtp = { expiresAt };
    if (!isProduction()) issued.devCode = code;
    return issued;
  }

  /**
   * Checks a code and, on success, burns every code for that account.
   *
   * `phone` scopes the lookup to one account, which is the safe path. Without
   * it the lookup falls back to the newest live row matching the code — possible
   * because `phone_otps` has no phone column, and acceptable only because codes
   * live for five minutes.
   */
  async confirm(input: ConfirmOtpInput): Promise<{ userId: string }> {
    const code = input.code.trim();
    if (code.length !== OTP_LENGTH) throw invalid();

    const now = new Date();
    let userId: string | undefined;
    if (input.phone) {
      const user = await this.prisma.user.findFirst({ where: { phone: input.phone } });
      // an unknown phone and an unknown code must look identical to the client
      if (!user) throw invalid();
      userId = user.id;
    }

    const row: LiveOtpRow | null = await this.prisma.phoneOtp.findFirst({
      where: {
        ...(userId ? { userId } : { code }),
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) throw invalid();

    if (row.attempts >= OTP_MAX_ATTEMPTS) throw tooManyAttempts();
    if (row.code !== code) {
      const attempts = row.attempts + 1;
      await this.prisma.phoneOtp.update({ where: { id: row.id }, data: { attempts } });
      // the row is dead the moment it reaches the cap, including on that attempt
      if (attempts >= OTP_MAX_ATTEMPTS) throw tooManyAttempts();
      throw invalid();
    }

    await this.prisma.phoneOtp.deleteMany({ where: { userId: row.userId } });
    return { userId: row.userId };
  }

  /** How many codes are still live for an account. */
  async countLive(userId: string): Promise<number> {
    return this.prisma.phoneOtp.count({ where: { userId, expiresAt: { gt: new Date() } } });
  }
}

function invalid(): Error {
  return new ApiError(400, 'AUTH_OTP_INVALID', 'Code invalide ou expiré.');
}

function tooManyAttempts(): Error {
  return new ApiError(429, 'AUTH_OTP_TOO_MANY_ATTEMPTS', 'Trop de tentatives, demandez un nouveau code.');
}
