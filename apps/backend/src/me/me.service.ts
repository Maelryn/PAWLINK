import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/filters/http-exception.filter';
import { userRowToUser } from '../users/serialize';
import { UsersService, type UpdateProfileData } from '../users/users.service';
import type { User } from '../shared/types';
import type { UpdateMeDto } from './dto/update-me.dto';

/**
 * `GET/PATCH/DELETE /me` — the current caller, always read back from the
 * database. The JWT says *who* is asking; the row says what they are *now*, so a
 * role change or a deletion takes effect on the very next request instead of
 * waiting for the token to expire.
 */
@Injectable()
export class MeService {
  constructor(private readonly users: UsersService) {}

  async get(userId: string): Promise<User> {
    return userRowToUser(await this.liveRow(userId));
  }

  async update(userId: string, dto: UpdateMeDto): Promise<User> {
    const current = await this.liveRow(userId);

    const patch: UpdateProfileData = {
      name: dto.name,
      avatar: dto.avatar,
      phone: dto.phone,
      city: dto.city,
      bio: dto.bio,
      photo: dto.photo,
      available: dto.available,
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
    // number has to be confirmed before login is allowed again.
    const phoneChanged = dto.phone !== undefined && dto.phone !== current.phone;
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
