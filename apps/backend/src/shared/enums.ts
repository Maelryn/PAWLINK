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

/** The three levels of a helper's availability. */
export const AVAILABILITY = ['now', 'usually', 'away'] as const;

/** Where a helper is in the rescue. */
export const HELPER_STAGES = ['onway', 'onsite'] as const;

/** The quick questions the triage asks — keys of `Case.answers`. */
export const FOLLOW_UP_IDS = ['conscious', 'bleeding', 'walk', 'eating'] as const;

export const CASE_CATEGORY = ['companion', 'livestock'] as const;

export const SERVICE_TYPES = ['vet', 'shelter', 'transport', 'boarding', 'training', 'store'] as const;

export const ADOPTION_STATUSES = ['pending', 'approved', 'rejected', 'adopted'] as const;

export const SEXES = ['male', 'female'] as const;

export const HOUSING = ['apartment', 'house', 'farm'] as const;

export const REQUEST_STATUSES = ['sent', 'accepted', 'declined', 'cancelled'] as const;

export const BOOKING_STATUSES = ['sent', 'confirmed', 'declined'] as const;

export const ZONE_TYPES = ['wildfire', 'flood', 'earthquake', 'other'] as const;

export const NOTIFICATION_KINDS = [
  'adoptRequest',
  'adoptAccepted',
  'adoptDeclined',
  'listingApproved',
  'listingRejected',
  'booking',
  'bookingConfirmed',
  'bookingDeclined',
  'help',
  'review',
  'serviceApproved',
  'proActive',
  'confirmAsk',
  'caseConfirmed',
  'editApproved',
  'editRejected',
] as const;

/** Roles a human may pick for themselves. `admin` is deliberately absent. */
export const SIGNABLE_ROLES = ['reporter', 'volunteer', 'vet'] as const;

/** Every role that exists, including the seed/CLI-only one. */
export const ALL_ROLES = ['reporter', 'volunteer', 'vet', 'admin'] as const;
