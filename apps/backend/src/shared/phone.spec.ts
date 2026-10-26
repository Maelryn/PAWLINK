import { describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ResendCodeDto, VerifyPhoneDto } from '../auth/dto/auth.dto';
import { RegisterDto } from '../auth/dto/register.dto';
import { UpdateMeDto } from '../me/dto/update-me.dto';
import { PHONE_MAX_LENGTH } from './phone';

/**
 * The phone rule is one rule, and this suite is what keeps it one.
 *
 * It used to be written four times, in two incompatible spellings: the regex
 * in `RegisterDto` and `ResendCodeDto` counted only the characters inside its
 * class, so the leading `+` was free — 21 characters were accepted at
 * registration — while `VerifyPhoneDto` capped the whole string at 20. An
 * account registered with a 21-character phone could never confirm its code:
 * `POST /auth/register` answered 202 and `POST /auth/verify-phone` answered
 * 400, forever.
 *
 * The invariant this file pins: **every DTO that takes a phone accepts and
 * rejects exactly the same numbers.** Registration is the one that creates the
 * account, so what it accepts, the code confirmation must accept too.
 */

/** A well-formed phone of an exact length, so the boundaries are not a guess. */
function phoneOfLength(length: number): string {
  const head = '+213 ';
  return head + '5'.repeat(length - head.length);
}

/** The DTOs that take a phone under the strict rule. */
const PHONE_DTOS = [
  {
    name: 'RegisterDto',
    dto: RegisterDto,
    payload: (phone: string) => ({
      name: 'Nour Benali',
      email: 'nour@pawlink.dz',
      password: 'pawlink2026',
      phone,
      role: 'reporter',
    }),
  },
  {
    name: 'VerifyPhoneDto',
    dto: VerifyPhoneDto,
    payload: (phone: string) => ({ code: '482913', phone }),
  },
  {
    name: 'ResendCodeDto',
    dto: ResendCodeDto,
    payload: (phone: string) => ({ phone }),
  },
] as const;

/** The errors `ValidationPipe` would answer with for that payload. */
async function errorsFor(
  dto: new () => object,
  payload: Record<string, unknown>,
): Promise<string[]> {
  // The same options the running server uses (src/setup.ts).
  const errors = await validate(plainToInstance(dto, payload), {
    whitelist: true,
    stopAtFirstError: true,
  });
  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
}

/** Does this DTO take that phone? */
async function accepts(
  dto: new () => object,
  payload: Record<string, unknown>,
): Promise<boolean> {
  return (await errorsFor(dto, payload)).length === 0;
}

/** Numbers a person actually types, and a few they should not get past. */
const VALID = [
  '+213 26 00 00 07',
  '+2132600007',
  '0555 12 34 56',
  '+213 (026) 00-00-07',
  '00213.555.12.34.56',
];

const INVALID = [
  phoneOfLength(PHONE_MAX_LENGTH + 1), // 21 characters — the bug: register took it, verify refused it
  '1234567', // too short
  '+123456', // too short, `+` included
  'not a phone',
  '+213 26 00 00 0a', // a letter
  '',
];

describe('the phone rule', () => {
  it('is the same rule in every DTO that takes a phone', async () => {
    for (const { name, dto, payload } of PHONE_DTOS) {
      for (const phone of VALID) {
        expect(`${name} ${phone} → ${await accepts(dto, payload(phone))}`).toBe(
          `${name} ${phone} → true`,
        );
      }
      for (const phone of INVALID) {
        expect(`${name} ${phone} → ${await accepts(dto, payload(phone))}`).toBe(
          `${name} ${phone} → false`,
        );
      }
    }
  });

  it('refuses a 21-character phone everywhere, so no account can be stranded', async () => {
    const tooLong = phoneOfLength(PHONE_MAX_LENGTH + 1);
    expect(tooLong).toHaveLength(PHONE_MAX_LENGTH + 1);

    for (const { name, dto, payload } of PHONE_DTOS) {
      expect(`${name} → ${await accepts(dto, payload(tooLong))}`).toBe(`${name} → false`);
    }
    expect(await accepts(UpdateMeDto, { phone: tooLong })).toBe(false);
  });

  it('accepts a 20-character phone everywhere, `+` included', async () => {
    const twenty = phoneOfLength(PHONE_MAX_LENGTH);
    expect(twenty).toHaveLength(PHONE_MAX_LENGTH);

    for (const { name, dto, payload } of PHONE_DTOS) {
      expect(`${name} → ${await accepts(dto, payload(twenty))}`).toBe(`${name} → true`);
    }
    expect(await accepts(UpdateMeDto, { phone: twenty })).toBe(true);
  });

  it('never lets registration accept a phone verification would refuse', async () => {
    const candidates = [
      ...VALID,
      ...INVALID,
      ...Array.from({ length: 30 }, (_, i) => `+213 ${String(i).padStart(8, '0')}`),
    ];

    for (const phone of candidates) {
      const registered = await accepts(RegisterDto, {
        name: 'Nour Benali',
        email: 'nour@pawlink.dz',
        password: 'pawlink2026',
        phone,
        role: 'reporter',
      });
      const verified = await accepts(VerifyPhoneDto, { code: '482913', phone });
      expect(`${phone} → registered ${registered}, verified ${verified}`).toBe(
        `${phone} → registered ${registered}, verified ${registered}`,
      );
    }
  });

  it('lets verification go without a phone at all', async () => {
    // The escape hatch for an account stranded by the old rule: the code alone
    // is enough, the phone only narrows the lookup.
    expect(await accepts(VerifyPhoneDto, { code: '482913' })).toBe(true);
  });

  it('reads an empty phone in PATCH /me as "no phone", not as an invalid one', async () => {
    // The profile form always sends the field, so a user without a number
    // sends "" — that must clear the number, not fail the whole save.
    expect(await accepts(UpdateMeDto, { phone: '' })).toBe(true);
    expect(await accepts(UpdateMeDto, { name: 'Nour Benali' })).toBe(true);
    expect(await accepts(UpdateMeDto, { phone: 'nope' })).toBe(false);
  });
});
