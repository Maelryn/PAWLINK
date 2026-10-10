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

/** Every `Species` value, in the same order as the Prisma enum. */
export const SPECIES = [
  'dog',
  'cat',
  'bird',
  'horse',
  'cow',
  'sheep',
  'goat',
  'camel',
  'donkey',
  'rabbit',
  'chicken',
  'other',
] as const;

export const TRIAGE = ['urgent', 'monitoring', 'stable'] as const;

export const CASE_STATUS = ['open', 'in_progress', 'resolved'] as const;

export const CASE_CATEGORY = ['companion', 'livestock'] as const;

export const SERVICE_TYPES = ['vet', 'shelter', 'transport', 'boarding', 'training', 'store'] as const;

/** Roles a human may pick for themselves. `admin` is deliberately absent. */
export const SIGNABLE_ROLES = ['reporter', 'volunteer', 'vet'] as const;

/** Every role that exists, including the seed/CLI-only one. */
export const ALL_ROLES = ['reporter', 'volunteer', 'vet', 'admin'] as const;
