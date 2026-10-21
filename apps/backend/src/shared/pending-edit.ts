import type { Prisma } from '@prisma/client';

/**
 * The second review — the changes an owner proposes on a live row.
 *
 * The proposed change is stored as a Json blob on the row itself
 * (`cases.pendingEdit`, `adoptions.pendingEdit`, `services.pendingEdit`): the
 * changed fields plus the `at` of the proposal. The public version of the row
 * stays as it is until a moderator decides
 * (`PATCH /admin/{cases,adoptions,services}/:id/edit`).
 */

/** The `at` the proposal carries — when the owner made the change. */
export function pendingEditAt(value: Prisma.JsonValue | null, fallback: Date): string {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const at = (value as Record<string, unknown>).at;
    if (typeof at === 'string') return at;
  }
  return fallback.toISOString();
}

/** The proposal without its `at` — the fields to merge. */
export function pendingEditFields(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const patch = { ...(value as Record<string, unknown>) };
  delete patch.at;
  return patch;
}
