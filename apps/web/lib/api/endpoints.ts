"use client";

import type { AIAnalysis, Case, CaseStatus, GeoPoint, HelpType, Species, Triage, User } from "../types";
import { api, type Page } from "./client";

/* Every endpoint the website uses, typed like apps/web/lib/types.ts (the API mirrors these
   shapes field for field). Grouped by backend phase so it's clear what is live:
     Phase 1 ✅ auth + /me     Phase 2 ⏳ cases, uploads, AI     Phase 3 ⏳ adoptions, services…   */

/* ─────────────── Phase 1 — auth + profile ─────────────── */

export interface Session {
  accessToken: string;
  user: User;
}
export interface OtpSent {
  phone: string;
  expiresAt: string;
  /** only outside production (console SMS provider), so the demo works without real SMS */
  code?: string;
}

export const auth = {
  register: (b: { name: string; email: string; password: string; phone: string; role: "reporter" | "volunteer" | "vet"; city?: string; helpTypes?: HelpType[] }) =>
    api<OtpSent>("/auth/register", { body: b, auth: false }),
  verifyPhone: (b: { code: string; phone?: string }) => api<Session>("/auth/verify-phone", { body: b, auth: false }),
  resendCode: (phone: string) => api<OtpSent>("/auth/resend-code", { body: { phone }, auth: false }),
  login: (email: string, password: string) => api<Session>("/auth/login", { body: { email, password }, auth: false }),
  logout: () => api<void>("/auth/logout", { method: "POST", auth: false }),
};

export type MePatch = Partial<Pick<User, "name" | "avatar" | "phone" | "city" | "bio" | "photo" | "available" | "helpTypes" | "location">>;

export const me = {
  get: () => api<User>("/me"),
  update: (patch: MePatch) => api<User>("/me", { method: "PATCH", body: patch }),
  remove: () => api<void>("/me", { method: "DELETE" }),
};

/* ─────────────── Phase 2 — cases, uploads, AI (apps/backend/PHASE2_PLAN.md §5) ─────────────── */

export interface CaseQuery {
  bbox?: [number, number, number, number];
  triage?: Triage;
  species?: Species;
  category?: "companion" | "livestock";
  status?: CaseStatus;
  zoneId?: string;
  page?: number;
  pageSize?: number;
}

export interface NewCase {
  title: string;
  species: Species;
  category: "companion" | "livestock";
  count?: number;
  triage?: Triage;
  location: GeoPoint;
  photos: string[];
  description: string;
  conditionTags: string[];
  device?: { lat: number; lng: number };
  emergencyZoneId?: string;
  reporterOnSite?: boolean;
  probeIds: string[];
}

export interface PhotoProbe {
  probeId: string;
  exif?: { gps?: GeoPoint | null; date?: string | null; make?: string | null; model?: string | null };
  duplicate?: boolean;
}

export interface UploadSignature {
  /** where to POST the file (Cloudinary upload URL) */
  url: string;
  /** form fields to send with it (api_key, timestamp, signature, folder…) */
  fields: Record<string, string>;
}

export const cases = {
  list: (q: CaseQuery = {}) =>
    api<Page<Case>>("/cases", { auth: false, query: { ...q, bbox: q.bbox?.join(",") } }),
  nearby: (p: GeoPoint, radiusKm = 25) => api<Case[]>("/cases/nearby", { query: { lat: p.lat, lng: p.lng, radiusKm } }),
  get: (id: string) => api<Case>(`/cases/${encodeURIComponent(id)}`, { auth: false }),
  create: (c: NewCase) => api<Case>("/cases", { body: c }),
  setStatus: (id: string, status: CaseStatus) => api<Case>(`/cases/${encodeURIComponent(id)}/status`, { method: "PATCH", body: { status } }),
  help: (id: string, helpType: HelpType, message?: string) => api<Case>(`/cases/${encodeURIComponent(id)}/help`, { body: { helpType, message } }),
  confirm: (id: string) => api<Case>(`/cases/${encodeURIComponent(id)}/confirm`, { method: "POST" }),
  flag: (id: string) => api<Case>(`/cases/${encodeURIComponent(id)}/flag`, { method: "POST" }),
  moderate: (id: string, decision: "approved" | "hidden") => api<Case>(`/admin/cases/${encodeURIComponent(id)}/moderation`, { method: "PATCH", body: { decision } }),
};

export const uploads = {
  /** sends the ORIGINAL file so the server reads EXIF + a perceptual hash before anything strips them */
  probe: (file: Blob) => {
    const form = new FormData();
    form.append("file", file);
    return api<PhotoProbe>("/uploads/probe", { form });
  },
  signature: () => api<UploadSignature>("/uploads/signature", { method: "POST" }),
};

export interface AnalyzeInput {
  photoUrls: string[];
  description: string;
  species?: Species;
  conditionTags?: string[];
  location: GeoPoint;
  count?: number;
  baseline?: Triage;
  lang: "fr" | "en" | "ar";
}

export const ai = {
  analyze: (b: AnalyzeInput) => api<AIAnalysis & { animalDetected?: boolean; isRealPhoto?: boolean }>("/ai/analyze", { body: b }),
};
