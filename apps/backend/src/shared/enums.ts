/**
 * Runtime mirrors of the Prisma enums.
 *
 * `class-validator` decorators need values to compare against, while
 * `@prisma/client` only gives us *types* for these unions — so the single list
 * of legal values lives here and both sides agree on it.
 */

export const HELP_TYPES = [
  'transport',
  'foster',
  'food',
  'medical',
  'search',
  'boarding',
  'funds',
] as const;

/** Roles a human may pick for themselves. `admin` is deliberately absent. */
export const SIGNABLE_ROLES = ['reporter', 'volunteer', 'vet'] as const;

/** Every role that exists, including the seed/CLI-only one. */
export const ALL_ROLES = ['reporter', 'volunteer', 'vet', 'admin'] as const;
