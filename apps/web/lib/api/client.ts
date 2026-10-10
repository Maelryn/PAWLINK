"use client";

/* Thin client for the PawLink API (NestJS, apps/backend).

   Turned on per feature with two env vars (see .env.example):
     NEXT_PUBLIC_API_URL=http://localhost:4000
     NEXT_PUBLIC_API_FEATURES=auth            (comma list: auth, cases, uploads, ai, …)
   Without them the app keeps its demo database (lib/store.ts), so the live site never breaks
   while an endpoint is still being built.

   Auth model (backend Phase 1): the access token comes back in the body and lives only in
   memory here; the refresh token is an httpOnly cookie the browser sends to /auth/* by itself. */

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
const FEATURES = new Set(
  (process.env.NEXT_PUBLIC_API_FEATURES ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean),
);

export type ApiFeature = "auth" | "cases" | "uploads" | "ai" | "adoptions" | "services" | "notifications" | "admin";

/** True when this part of the app talks to the real API instead of the demo database. */
export const apiOn = (feature: ApiFeature) => !!API_URL && FEATURES.has(feature);

/** Error envelope of the API: { statusCode, message, code }. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

let accessToken: string | null = null;
export const setAccessToken = (t: string | null) => {
  accessToken = t;
};
export const hasAccessToken = () => !!accessToken;

let refreshing: Promise<boolean> | null = null;

/** Trades the refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshAccessToken(): Promise<boolean> {
  refreshing ??= fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" })
    .then(async (r) => {
      if (!r.ok) {
        setAccessToken(null);
        return false;
      }
      const body = (await r.json()) as { accessToken: string };
      setAccessToken(body.accessToken);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** multipart upload (photo probe) */
  form?: FormData;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** send the bearer token (default true) */
  auth?: boolean;
  signal?: AbortSignal;
}

async function parseError(r: Response): Promise<ApiError> {
  let code = "HTTP_" + r.status;
  let message = r.statusText;
  try {
    const e = (await r.json()) as { code?: string; message?: string | string[] };
    if (e.code) code = e.code;
    if (e.message) message = Array.isArray(e.message) ? e.message.join(" · ") : e.message;
  } catch {}
  return new ApiError(r.status, code, message);
}

export async function api<T>(path: string, o: RequestOptions = {}): Promise<T> {
  if (!API_URL) throw new ApiError(0, "API_OFF", "API not configured");
  const url = new URL(API_URL + path);
  for (const [k, v] of Object.entries(o.query ?? {})) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));

  const send = () => {
    const headers: Record<string, string> = {};
    if (o.body !== undefined) headers["Content-Type"] = "application/json";
    if (o.auth !== false && accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch(url, {
      method: o.method ?? (o.body !== undefined || o.form ? "POST" : "GET"),
      headers,
      body: o.form ?? (o.body !== undefined ? JSON.stringify(o.body) : undefined),
      credentials: "include",
      signal: o.signal,
    });
  };

  let r: Response;
  try {
    r = await send();
  } catch {
    throw new ApiError(0, "NETWORK", "Network error");
  }
  // expired access token: refresh once, then retry
  if (r.status === 401 && o.auth !== false && (await refreshAccessToken())) r = await send();
  if (!r.ok) throw await parseError(r);
  if (r.status === 204) return undefined as T;
  return (await r.json()) as T;
}

/** Paginated list envelope of the API. */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
