import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiError } from '../common/filters/http-exception.filter';
import { PrismaService } from '../common/prisma/prisma.service';
import { userRowToUser } from '../users/serialize';
import { UsersService, type UpdateProfileData } from '../users/users.service';
import { RefreshTokenService } from '../auth/refresh-token.service';
import { NotificationsService } from '../notifications/notifications.service';
import { isProActive, PRO_PERIOD_DAYS, readProSubscription } from '../shared/pro';
import { DEMO_PROMO_CODE, type ActivateProDto } from './dto/pro.dto';
import type { UpdateMeDto } from './dto/update-me.dto';
import type { User } from '../shared/types';

/**
 * `GET/PATCH/DELETE /me` — the current caller, always read back from the
 * database. The JWT says *who* is asking; the row says what they are *now*, so a
 * role change or a deletion takes effect on the very next request instead of
 * waiting for the token to expire.
 */
@Injectable()
export class MeService {
  private readonly logger = new Logger(MeService.name);

  constructor(
    private readonly users: UsersService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async get(userId: string): Promise<User> {
    return userRowToUser(await this.liveRow(userId));
  }

  async update(userId: string, dto: UpdateMeDto): Promise<User> {
    const current = await this.liveRow(userId);

    // An empty phone means "no phone": the column is cleared, not filled with
    // an empty string. The profile form always sends the field, so a user
    // without a number must not be told their profile is invalid.
    const phone = dto.phone === '' ? null : dto.phone;

    const patch: UpdateProfileData = {
      name: dto.name,
      avatar: dto.avatar,
      phone,
      city: dto.city,
      bio: dto.bio,
      photo: dto.photo,
      available: dto.available,
      availability: dto.availability,
      helpTypes: dto.helpTypes as UpdateProfileData['helpTypes'],
    };

    // A location may be *cleared* by sending `{}`, so the three fields travel
    // together and are nulled when the coordinate is missing.
    if (dto.location !== undefined) {
      patch.lat = typeof dto.location.lat === 'number' ? dto.location.lat : null;
      patch.lng = typeof dto.location.lng === 'number' ? dto.location.lng : null;
      patch.address = dto.location.address ?? null;
    }

    // `phone` is the OTP channel: changing it drops `phoneVerified`, so the new
    // number has to be confirmed before login is allowed again. Sending the
    // number it already has changes nothing.
    const phoneChanged = phone !== undefined && phone !== current.phone;
    const updated = await this.users.updateProfile(userId, patch);
    if (phoneChanged) {
      return userRowToUser(await this.users.setPhoneVerified(userId, false));
    }
    return userRowToUser(updated);
  }

  async remove(userId: string): Promise<void> {
    await this.liveRow(userId);
    await this.users.anonymize(userId);
    // Any live SMS code dies with the account.
    await this.users.clearOtps(userId);
    // And so does every session: deleting the account is the strongest "log
    // out" there is, so no device keeps a cookie that could be exchanged for a
    // new session. The rows are marked, not deleted — the account is anonymised
    // rather than removed, so the foreign keys still resolve.
    const killed = await this.refreshTokens.revokeAllForUser(userId, 'logout');
    if (killed > 0) {
      this.logger.log(`Account deleted — ${killed} session(s) revoked.`);
    }
  }

  /**
   * `POST /me/pro` — the PawLink Pro subscription (demo payment).
   *
   * Three rules, and they are the whole contract:
   *
   *   1. **A listing first.** Pro is what makes a business listing visible, so
   *      the account must own one — and it must be approved, because an
   *      unapproved listing has nothing to feature.
   *   2. **The same plan cannot be bought twice.** Renewing means choosing the
   *      other tier (the web offers Pro+ to a Pro account); buying Pro twice in
   *      a row is a 409, not a silent double charge.
   *   3. **The days left are never lost.** Paying again extends `until` from
   *      where it was, and `since` stays the day the subscription started.
   *
   * No money moves: the demo payment happens here, and the real one (Chargily)
   * would be a webhook calling this same method.
   */
  async activatePro(
    userId: string,
    dto: ActivateProDto,
  ): Promise<{ user: User; demo: boolean; free: boolean }> {
    const current = await this.liveRow(userId);

    // 1. A listing, and an approved one.
    if (!current.serviceId) {
      throw new ApiError(
        403,
        'PRO_NO_LISTING',
        'PawLink Pro est pour les professionnels : créez d’abord votre fiche.',
      );
    }
    const service = await this.prisma.service.findUnique({ where: { id: current.serviceId } });
    if (!service) {
      throw new ApiError(
        403,
        'PRO_NO_LISTING',
        'PawLink Pro est pour les professionnels : créez d’abord votre fiche.',
      );
    }
    if (service.status !== 'approved') {
      throw new ApiError(
        403,
        'PRO_LISTING_NOT_APPROVED',
        'Votre fiche doit être validée par un administrateur avant de passer Pro.',
      );
    }

    // 2. The same plan cannot be bought twice while it runs.
    const currentPro = readProSubscription(current.pro);
    const active = isProActive(currentPro);
    if (active && currentPro?.plan === dto.plan) {
      throw new ApiError(
        409,
        'PRO_ALREADY_ACTIVE',
        'Votre abonnement est déjà actif : choisissez l’autre offre pour le prolonger.',
      );
    }

    // 3. The demo payment. `DEMODAY` is free; anything else is a demo sale.
    const free = (dto.promoCode ?? '').trim().toUpperCase() === DEMO_PROMO_CODE;
    const days = PRO_PERIOD_DAYS[dto.period];
    const now = Date.now();
    const since = active ? currentPro!.since : new Date(now).toISOString();
    const from = active ? Date.parse(currentPro!.until) : now;
    const until = new Date(from + days * 86_400_000).toISOString();

    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          pro: { plan: dto.plan, since, until } as Prisma.InputJsonValue,
        },
      }),
      // The listing is featured while the subscription runs. The column is a
      // cache: every read derives the flag from the owner's subscription, so an
      // expired subscription turns it off on its own.
      this.prisma.service.update({ where: { id: service.id }, data: { pro: true } }),
    ]);

    await this.notifications.notify(userId, 'proActive', 'PawLink Pro', '/account?tab=pro');

    return { user: userRowToUser(updated), demo: true, free };
  }

  /** Re-reads the row and refuses an account that no longer exists. */
  private async liveRow(userId: string) {
    const row = await this.users.findById(userId);
    // `passwordHash == null` is the marker `UsersService.anonymize()` writes.
    if (!row || !row.passwordHash) {
      throw new ApiError(401, 'AUTH_ACCOUNT_DELETED', 'Ce compte n\'existe plus.');
    }
    return row;
  }
}
