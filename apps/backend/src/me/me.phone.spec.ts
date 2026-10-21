import { describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { UsersService } from '../users/users.service';
import { MeService } from './me.service';

/**
 * The phone half of `PATCH /me`.
 *
 * The profile form always sends the `phone` field, so a user without a number
 * sends an empty string. That has to mean **"no phone"** — the column is
 * cleared — and not "invalid request": the strict phone rule lives in the DTO
 * (`shared/phone.ts`), and this service is what turns the empty string into
 * the absence of a number.
 *
 * The name is deliberately not `me.service.spec.ts`: this file covers one
 * behaviour, and it must not collide with the rest of the service's surface.
 */

interface MockRow {
  id: string;
  name: string;
  avatar: string;
  role: string;
  email: string | null;
  passwordHash: string | null;
  phone: string | null;
  phoneVerified: boolean;
  licenseVerified: boolean;
  helpTypes: string[];
  lat: number | null;
  lng: number | null;
  address: string | null;
  rating: number | null;
  city: string | null;
  bio: string | null;
  photo: string | null;
  available: boolean | null;
  serviceId: string | null;
  pro: unknown;
  createdAt: Date;
}

function row(overrides: Partial<MockRow> = {}): MockRow {
  return {
    id: 'u1',
    name: 'Nour Benali',
    avatar: '',
    role: 'reporter',
    email: 'nour@pawlink.dz',
    passwordHash: 'hash',
    phone: null,
    phoneVerified: false,
    licenseVerified: false,
    helpTypes: [],
    lat: null,
    lng: null,
    address: null,
    rating: null,
    city: null,
    bio: null,
    photo: null,
    available: null,
    serviceId: null,
    pro: null,
    createdAt: new Date('2026-10-21T00:00:00.000Z'),
    ...overrides,
  };
}

/** A MeService wired to one row, with the two phone calls recorded. */
async function serviceFor(current: MockRow) {
  const users = {
    findById: jest.fn(async () => current),
    updateProfile: jest.fn(async (_id: string, patch: Record<string, unknown>) =>
      row({ phone: (patch.phone as string | null) ?? null }),
    ),
    setPhoneVerified: jest.fn(async () => row({ phoneVerified: false })),
  };

  const moduleRef = await Test.createTestingModule({ providers: [MeService] })
    // `useMocker` answers every other dependency, so this test does not care
    // what else the service grows.
    .useMocker((token) => (token === UsersService ? users : {}))
    .compile();

  const service = moduleRef.get(MeService);
  return { service, users };
}

describe('PATCH /me and the phone', () => {
  it('reads an empty phone as "no phone" and clears the column', async () => {
    const { service, users } = await serviceFor(row({ phone: '+213 26 00 00 07' }));

    await service.update('u1', { phone: '' });

    expect(users.updateProfile).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ phone: null }),
    );
  });

  it('drops phoneVerified when the number is cleared', async () => {
    const { service, users } = await serviceFor(
      row({ phone: '+213 26 00 00 07', phoneVerified: true }),
    );

    await service.update('u1', { phone: '' });

    expect(users.setPhoneVerified).toHaveBeenCalledWith('u1', false);
  });

  it('keeps phoneVerified when there was no number to begin with', async () => {
    const { service, users } = await serviceFor(row({ phone: null, phoneVerified: true }));

    await service.update('u1', { phone: '' });

    expect(users.setPhoneVerified).not.toHaveBeenCalled();
  });

  it('leaves the phone alone when the field is not sent', async () => {
    const { service, users } = await serviceFor(row({ phone: '+213 26 00 00 07' }));

    await service.update('u1', { city: 'Oran' });

    expect(users.updateProfile).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ phone: undefined }),
    );
    expect(users.setPhoneVerified).not.toHaveBeenCalled();
  });

  it('drops phoneVerified when a new number is set', async () => {
    const { service, users } = await serviceFor(
      row({ phone: '+213 26 00 00 07', phoneVerified: true }),
    );

    await service.update('u1', { phone: '+213 26 00 00 08' });

    expect(users.setPhoneVerified).toHaveBeenCalledWith('u1', false);
  });
});
