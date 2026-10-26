/**
 * The one phone rule, shared by every DTO that takes a number.
 *
 * It used to be written four times, in two incompatible spellings:
 * `RegisterDto` and `ResendCodeDto` used the regex `/^\+?[0-9\s().-]{8,20}$/`,
 * while `VerifyPhoneDto` and `UpdateMeDto` used a bare `@MaxLength(20)`. The
 * two did not agree: the regex counts only the characters **inside** its class,
 * so the leading `+` was free — `POST /auth/register` accepted 21 characters
 * while `POST /auth/verify-phone` refused anything over 20. An account
 * registered with a 21-character phone could never confirm its code.
 *
 * The rule below counts the **whole** string, the `+` included:
 *
 *   - 8 to 20 characters, separators included;
 *   - an optional leading `+`;
 *   - digits and the separators a person actually types — and nothing else.
 *
 * Every DTO that accepts a phone uses this one rule, so what registration
 * accepts, verification and resend accept too, and what they reject, they
 * reject for the same reason.
 */

/** The whole number — the leading `+` counts — is at least this long. */
export const PHONE_MIN_LENGTH = 8;

/** …and at most this long. */
export const PHONE_MAX_LENGTH = 20;

/** What the client is told, whichever half of the rule the number broke. */
export const PHONE_ERROR_MESSAGE = 'Numéro de téléphone invalide.';

/**
 * The pattern.
 *
 * The leading lookahead counts the **total** length, `+` included — that is
 * the whole point of the fix: a number the rule accepts is a number every
 * other endpoint accepts too. The rest of the pattern says what the number is
 * made of.
 *
 * `[\s\S]` rather than `.` so the count stays exact even for a string
 * carrying a line break (which the rest of the pattern rejects anyway).
 *
 * Built from the constants above, so the bounds and the pattern can never
 * drift apart.
 */
export const PHONE_PATTERN = new RegExp(
  String.raw`^(?=[\s\S]{${PHONE_MIN_LENGTH},${PHONE_MAX_LENGTH}}$)\+?[0-9\s().-]+$`,
);
