import { Injectable } from '@nestjs/common';
import type { HelpType, Role, User as UserRow } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { SIGNABLE_ROLES } from '../shared/enums';

/**
 * Account persistence. The service owns every rule about how a user row may be
 * written; nothing outside it touches `prisma.user`.
 *
 * A row's `passwordHash` is the liveness marker: register, seed and `seed:admin`
 * always set one, so `passwordHash == null` means "account deleted" (see
 * `anonymize`). That keeps `DELETE /me` free of a schema change.
 */

/** Roles a human may pick for themselves. `admin` is never one of them. */
export type SignableRole = (typeof SIGNABLE_ROLES)[number];

const SIGNABLE: readonly string[] = SIGNABLE_ROLES;

export function isSignableRole(value: unknown): value is SignableRole {
  return typeof value === 'string' && SIGNABLE.includes(value);
}

/** Web `signIn()` trims + lowercases, so lookups must do the same. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  phone: string;
  role: SignableRole;
  city?: string;
  helpTypes?: HelpType[];
}

/** Only profile fields a user may change about themselves. */
export interface UpdateProfileData {
  name?: string;
  avatar?: string;
  /** `null` clears the number; `undefined` leaves it alone. */
  phone?: string | null;
  city?: string;
  bio?: string;
  photo?: string;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  available?: boolean;
  helpTypes?: HelpType[];
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<UserRow | null> {
    return this.prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
  }

  async findByPhone(phone: string): Promise<UserRow | null> {
    return this.prisma.user.findFirst({ where: { phone } });
  }

  async findById(id: string): Promise<UserRow | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /** Phone numbers are only unique per account when the account is alive. */
  async create(data: CreateUserData): Promise<UserRow> {
    const row: Prisma.UserUncheckedCreateInput = {
      name: data.name,
      avatar: '',
      role: data.role as Role,
      email: normalizeEmail(data.email),
      passwordHash: data.passwordHash,
      phone: data.phone,
      phoneVerified: false,
      licenseVerified: false,
      helpTypes: data.helpTypes ?? [],
      city: data.city,
    };
    return this.prisma.user.create({ data: row });
  }

  async updateProfile(id: string, patch: UpdateProfileData): Promise<UserRow> {
    // Build the payload explicitly: Prisma must never see `undefined` for a
    // column we were not asked to change.
    const data: Prisma.UserUncheckedUpdateInput = {};
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.avatar !== undefined) data.avatar = patch.avatar;
    if (patch.phone !== undefined) data.phone = patch.phone;
    if (patch.city !== undefined) data.city = patch.city;
    if (patch.bio !== undefined) data.bio = patch.bio;
    if (patch.photo !== undefined) data.photo = patch.photo;
    if (patch.lat !== undefined) data.lat = patch.lat;
    if (patch.lng !== undefined) data.lng = patch.lng;
    if (patch.address !== undefined) data.address = patch.address;
    if (patch.available !== undefined) data.available = patch.available;
    if (patch.helpTypes !== undefined) data.helpTypes = patch.helpTypes;

    return this.prisma.user.update({ where: { id }, data });
  }

  async setPhoneVerified(id: string, verified: boolean): Promise<UserRow> {
    return this.prisma.user.update({ where: { id }, data: { phoneVerified: verified } });
  }

  /** Kills every OTP for an account (used on verify and on delete). */
  async clearOtps(userId: string): Promise<number> {
    const { count } = await this.prisma.phoneOtp.deleteMany({ where: { userId } });
    return count;
  }

  /**
   * `DELETE /me` (docs/BACKEND_PROMPT.md R3): blank the personal data and drop
   * the password hash — which doubles as the "this account is gone" marker the
   * rest of the app checks. The row itself survives so `cases.reporterId`,
   * `reviews.authorId` and every other foreign key stays resolvable, and no
   * schema column is needed.
   */
  async anonymize(id: string): Promise<UserRow> {
    return this.prisma.user.update({
      where: { id },
      data: {
        name: 'Compte supprimé',
        email: null,
        passwordHash: null,
        phone: null,
        avatar: '',
        bio: null,
        photo: null,
        city: null,
        address: null,
        helpTypes: [],
        available: null,
        rating: null,
        serviceId: null,
        pro: Prisma.DbNull,
      },
    });
  }
}
