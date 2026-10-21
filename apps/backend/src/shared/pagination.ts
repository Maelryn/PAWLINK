/**
 * Pagination and viewer shapes shared by every list endpoint.
 *
 * They used to live in `cases.service.ts`, which made every other module
 * import a domain service just for two types. `cases.service.ts` re-exports
 * them, so nothing that already imports from there breaks.
 */

/** The list envelope every `GET` collection answers with (§3.1). */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Who is asking — `sub`/`role` come from a verified JWT, never from a body. */
export interface Viewer {
  sub: string;
  role: string;
}
