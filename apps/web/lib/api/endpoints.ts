"use client";

import type {
  AIAnalysis,
  AdoptionProfile,
  AdoptionRequest,
  AppNotification,
  Booking,
  Case,
  CaseStatus,
  EmergencyZone,
  GeoPoint,
  HelpType,
  PendingEdit,
  Review,
  Service,
  Species,
  Triage,
  User,
} from "../types";
import { api, type Page } from "./client";

/* Every endpoint the website uses, typed like apps/web/lib/types.ts (the API mirrors these
   shapes field for field). Grouped by backend phase so it's clear what is live:
     Phase 1 ✅ auth + /me     Phase 2 ✅ cases, uploads     AI ⏳ apps/Ai service     Phase 3 ⏳ adoptions, services…   */

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

/** `?page=&pageSize=` — the paging half every `/me` list shares. */
export interface PageQuery {
  page?: number;
  pageSize?: number;
}

/** The demo PawLink Pro checkout (`POST /me/pro`). No real money moves; `demo` says so. */
export interface ProPurchase {
  plan: "pro" | "plus";
  period: "month" | "year";
  promoCode?: string;
}

export const me = {
  get: () => api<User>("/me"),
  update: (patch: MePatch) => api<User>("/me", { method: "PATCH", body: patch }),
  remove: () => api<void>("/me", { method: "DELETE" }),
  /** Every report I made, moderation included (GET /me/cases). */
  cases: (q: PageQuery = {}) => api<Page<Case>>("/me/cases", { query: { ...q } }),
  /** The demo Pro subscription. Needs an approved business listing; days left are kept. */
  pro: (purchase: ProPurchase) =>
    api<{ user: User; demo: boolean; free: boolean }>("/me/pro", { body: purchase }),
  /** Saved adoption profiles. */
  favorites: (q: PageQuery = {}) => api<Page<AdoptionProfile>>("/me/favorites", { query: { ...q } }),
  saveFavorite: (adoptionId: string) =>
    api<AdoptionProfile>(`/me/favorites/${encodeURIComponent(adoptionId)}`, { method: "PUT" }),
  removeFavorite: (adoptionId: string) =>
    api<void>(`/me/favorites/${encodeURIComponent(adoptionId)}`, { method: "DELETE" }),
  /** My adoption listings, any status (dashboard). */
  adoptions: (q: PageQuery = {}) => api<Page<AdoptionProfile>>("/me/adoptions", { query: { ...q } }),
  /** Adoption requests I sent. */
  requests: (q: PageQuery = {}) => api<Page<AdoptionRequest>>("/me/requests", { query: { ...q } }),
  /** Adoption requests on my listings. */
  receivedRequests: (q: PageQuery = {}) => api<Page<AdoptionRequest>>("/me/requests/received", { query: { ...q } }),
  /** Bookings I made. */
  bookings: (q: PageQuery = {}) => api<Page<Booking>>("/me/bookings", { query: { ...q } }),
  /** My notifications, newest first. */
  notifications: (q: PageQuery = {}) => api<Page<AppNotification>>("/me/notifications", { query: { ...q } }),
  readAllNotifications: () => api<void>("/me/notifications/read-all", { method: "POST" }),
};

/* ─────────────── Phase 2 ✅ — cases, uploads (apps/backend/PHASE2_PLAN.md §5) ─────────────── */

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

/** Cloudinary signed-upload params (POST /uploads/signature). The secret never leaves the server. */
export interface UploadSignature {
  cloudName: string;
  apiKey: string;
  folder: string;
  timestamp: number;
  signature: string;
}

export const cases = {
  list: (q: CaseQuery = {}, opts: { signal?: AbortSignal } = {}) =>
    api<Page<Case>>("/cases", { auth: false, query: { ...q, bbox: q.bbox?.join(",") }, signal: opts.signal }),
  nearby: (p: GeoPoint, radiusKm = 25) => api<Page<Case & { distanceKm: number }>>("/cases/nearby", { query: { lat: p.lat, lng: p.lng, radiusKm } }),
  get: (id: string) => api<Case>(`/cases/${encodeURIComponent(id)}`, { auth: false }),
  create: (c: NewCase) => api<Case>("/cases", { body: c }),
  setStatus: (id: string, status: CaseStatus) => api<Case>(`/cases/${encodeURIComponent(id)}/status`, { method: "PATCH", body: { status } }),
  help: (id: string, helpType: HelpType, message?: string) => api<Case>(`/cases/${encodeURIComponent(id)}/help`, { body: { helpType, message } }),
  setHelperStage: (id: string, stage: "onway" | "onsite") => api<Case>(`/cases/${encodeURIComponent(id)}/help`, { method: "PATCH", body: { stage } }),
  requestNextHelp: (id: string, types: HelpType[]) => api<Case>(`/cases/${encodeURIComponent(id)}/next-help`, { body: { types } }),
  /** "Do you see this animal?" — the server checks the ≤ 1 km rule itself and takes one answer per account. */
  confirm: (id: string, answer: { seen: boolean } & GeoPoint) =>
    api<Case>(`/cases/${encodeURIComponent(id)}/confirm`, { body: answer }),
  /** The reporter's own edit. On a public report the server stores it as `pendingEdit`. */
  update: (id: string, patch: { description?: string; conditionTags?: string[] }) =>
    api<Case>(`/cases/${encodeURIComponent(id)}`, { method: "PATCH", body: patch }),
  /** The reporter deletes their report. */
  remove: (id: string) => api<void>(`/cases/${encodeURIComponent(id)}`, { method: "DELETE" }),
  flag: (id: string, reason?: string) => api<Case>(`/cases/${encodeURIComponent(id)}/flag`, { body: { reason } }),
  moderate: (id: string, decision: "approved" | "hidden") => api<Case>(`/admin/cases/${encodeURIComponent(id)}/moderation`, { method: "PATCH", body: { decision } }),
};

/* ─────────────── the second review + the Pro subscription (the website's missing endpoints) ─────────────── */

/** One decision shape for the three kinds of proposed change. */
export type EditDecision = "approve" | "reject";

export const admin = {
  /** Every proposed change waiting for a moderator: cases, adoptions and services in one list. */
  pendingEdits: () => api<{ items: PendingEdit[]; total: number }>("/admin/pending-edits"),
  decideCaseEdit: (id: string, decision: EditDecision) =>
    api<Case>(`/admin/cases/${encodeURIComponent(id)}/edit`, { method: "PATCH", body: { decision } }),
  decideAdoptionEdit: (id: string, decision: EditDecision) =>
    api<AdoptionProfile>(`/admin/adoptions/${encodeURIComponent(id)}/edit`, { method: "PATCH", body: { decision } }),
  decideServiceEdit: (id: string, decision: EditDecision) =>
    api<unknown>(`/admin/services/${encodeURIComponent(id)}/edit`, { method: "PATCH", body: { decision } }),
  /** Admin moderation: approve / reject a pending adoption listing. */
  moderateAdoption: (id: string, status: "approved" | "rejected") =>
    api<AdoptionProfile>(`/admin/adoptions/${encodeURIComponent(id)}`, { method: "PATCH", body: { status } }),
  /** Admin moderation: approve / reject a pending service listing. */
  moderateService: (id: string, status: "approved" | "rejected") =>
    api<Service>(`/admin/services/${encodeURIComponent(id)}`, { method: "PATCH", body: { status } }),
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

/* AI: a separate service in apps/Ai (Katia). The backend has no AI link until it is delivered;
   until then the website shows its own rule-based triage (lib/ai/analyze.ts). */
export const ai = {
  analyze: (b: AnalyzeInput) => api<AIAnalysis & { animalDetected?: boolean; isRealPhoto?: boolean }>("/ai/analyze", { body: b }),
};

/* ─────────────── Phase 3 — adoptions, services, zones, notifications ─────────────── */

/** `?status=&page=&pageSize=` — the marketplace query (adoptions). */
export interface AdoptionQuery {
  status?: AdoptionProfile["status"];
  page?: number;
  pageSize?: number;
}

/** Body of `POST /adoptions`. Mirrors `CreateAdoptionDto`. */
export interface NewAdoption {
  name: string;
  species: Species;
  breed?: string;
  sex: AdoptionProfile["sex"];
  ageMonths: number;
  photos: string[];
  probeIds: string[];
  healthStatus: string;
  vaccinations?: { name: string; date: string }[];
  medicalHistory?: { date: string; note: string }[];
  behavior?: string[];
  careNeeds?: string[];
  story: string;
  shelterId?: string;
  location: GeoPoint;
}

/** Body of `PATCH /adoptions/:id`. Mirrors `UpdateAdoptionDto`. */
export type AdoptionPatch = Partial<
  Pick<
    NewAdoption,
    | "name"
    | "breed"
    | "photos"
    | "probeIds"
    | "healthStatus"
    | "vaccinations"
    | "medicalHistory"
    | "behavior"
    | "careNeeds"
    | "story"
    | "location"
  >
>;

/** Body of `POST /adoptions/:id/requests`. */
export interface NewAdoptionRequest {
  message: string;
  housing: AdoptionRequest["housing"];
  experience: boolean;
}

/** Body of `PATCH /requests/:id`. */
export interface DecideAdoptionRequest {
  status: "accepted" | "declined";
}

export const adoptions = {
  list: (q: AdoptionQuery = {}, opts: { signal?: AbortSignal } = {}) =>
    api<Page<AdoptionProfile>>("/adoptions", { query: { ...q }, signal: opts.signal }),
  get: (id: string) => api<AdoptionProfile>(`/adoptions/${encodeURIComponent(id)}`),
  create: (a: NewAdoption) => api<AdoptionProfile>("/adoptions", { body: a }),
  update: (id: string, patch: AdoptionPatch) =>
    api<AdoptionProfile>(`/adoptions/${encodeURIComponent(id)}`, { method: "PATCH", body: patch }),
  setStatus: (id: string, status: "adopted") =>
    api<AdoptionProfile>(`/adoptions/${encodeURIComponent(id)}/status`, { method: "PATCH", body: { status } }),
  remove: (id: string) => api<void>(`/adoptions/${encodeURIComponent(id)}`, { method: "DELETE" }),
  /** Ask to adopt a listing. */
  createRequest: (id: string, r: NewAdoptionRequest) =>
    api<AdoptionRequest>(`/adoptions/${encodeURIComponent(id)}/requests`, { body: r }),
  /** Owner-only decision on a request (also available as `requests.decide`). */
  decideRequest: (requestId: string, decision: DecideAdoptionRequest) =>
    api<AdoptionRequest>(`/requests/${encodeURIComponent(requestId)}`, { method: "PATCH", body: decision }),
  /** Admin moderation: approve / reject a pending listing. */
  moderate: (id: string, status: "approved" | "rejected") =>
    api<AdoptionProfile>(`/admin/adoptions/${encodeURIComponent(id)}`, { method: "PATCH", body: { status } }),
  // aliases
  getOne: (id: string) => adoptions.get(id),
  findOne: (id: string) => adoptions.get(id),
  add: (a: NewAdoption) => adoptions.create(a),
  patch: (id: string, p: AdoptionPatch) => adoptions.update(id, p),
  request: (id: string, r: NewAdoptionRequest) => adoptions.createRequest(id, r),
  sendRequest: (id: string, r: NewAdoptionRequest) => adoptions.createRequest(id, r),
  answerRequest: (requestId: string, decision: DecideAdoptionRequest) => adoptions.decideRequest(requestId, decision),
};

/** Top-level `/requests/:id` route, mirroring the backend controller. */
export const requests = {
  decide: (id: string, status: "accepted" | "declined") =>
    api<AdoptionRequest>(`/requests/${encodeURIComponent(id)}`, { method: "PATCH", body: { status } }),
};

/** `GET /services` query. */
export interface ServiceQuery {
  lat?: number;
  lng?: number;
  type?: Service["type"];
  radiusKm?: number;
  q?: string;
  page?: number;
  pageSize?: number;
}

/** Body of `POST /services`. Mirrors `CreateServiceDto` (lat/lng, not a GeoPoint). */
export interface NewService {
  type: Service["type"];
  name: string;
  lat: number;
  lng: number;
  address?: string;
  phone?: string;
  openNow?: boolean;
  photo?: string;
  tags?: string[];
  description?: string;
  hours?: string;
}

/** Body of `PATCH /services/:id`. Mirrors `UpdateServiceDto`. */
export type ServicePatch = Partial<Omit<NewService, "type">> & { type?: Service["type"] };

export const services = {
  list: (q: ServiceQuery = {}, opts: { signal?: AbortSignal } = {}) =>
    api<Page<Service & { distanceKm?: number }>>("/services", { query: { ...q }, signal: opts.signal }),
  get: (id: string) => api<Service>(`/services/${encodeURIComponent(id)}`),
  create: (s: NewService) => api<Service>("/services", { body: s }),
  update: (id: string, patch: ServicePatch) =>
    api<Service>(`/services/${encodeURIComponent(id)}`, { method: "PATCH", body: patch }),
  reviews: (id: string, q: PageQuery = {}) =>
    api<Page<Review>>(`/services/${encodeURIComponent(id)}/reviews`, { query: { ...q } }),
  addReview: (id: string, r: { rating: Review["rating"]; text: string }) =>
    api<Review>(`/services/${encodeURIComponent(id)}/reviews`, { body: r }),
  replyReview: (id: string, reviewId: string, reply: string) =>
    api<Review>(`/services/${encodeURIComponent(id)}/reviews/${encodeURIComponent(reviewId)}`, {
      method: "PATCH",
      body: { reply },
    }),
  book: (id: string, b: { date: string; time: string; animal: string; reason: string }) =>
    api<Booking>(`/services/${encodeURIComponent(id)}/bookings`, { body: b }),
  moderate: (id: string, status: "approved" | "rejected") =>
    api<Service>(`/admin/services/${encodeURIComponent(id)}`, { method: "PATCH", body: { status } }),
  // aliases
  findOne: (id: string) => services.get(id),
  add: (s: NewService) => services.create(s),
  patch: (id: string, p: ServicePatch) => services.update(id, p),
  listReviews: (id: string, q: PageQuery = {}) => services.reviews(id, q),
  review: (id: string, r: { rating: Review["rating"]; text: string }) => services.addReview(id, r),
  reply: (id: string, reviewId: string, reply: string) => services.replyReview(id, reviewId, reply),
  createBooking: (id: string, b: { date: string; time: string; animal: string; reason: string }) => services.book(id, b),
  addBooking: (id: string, b: { date: string; time: string; animal: string; reason: string }) => services.book(id, b),
};

/** Top-level `/bookings/:id` route, mirroring the backend controller. */
export const bookings = {
  decide: (id: string, status: "confirmed" | "declined") =>
    api<Booking>(`/bookings/${encodeURIComponent(id)}`, { method: "PATCH", body: { status } }),
};

/** Emergency zones (`/emergency-zones`). */
export interface ZoneQuery {
  active?: boolean;
  page?: number;
  pageSize?: number;
}

export interface NewZone {
  name: string;
  region: string;
  type: EmergencyZone["type"];
  polygon?: unknown;
  active?: boolean;
  radiusKm?: number;
  startedAt?: string;
}

export type ZonePatch = Partial<NewZone>;

export const zones = {
  list: (q: ZoneQuery = {}, opts: { signal?: AbortSignal } = {}) =>
    api<Page<EmergencyZone>>("/emergency-zones", { query: { ...q }, auth: false, signal: opts.signal }),
  create: (z: NewZone) => api<EmergencyZone>("/emergency-zones", { body: z }),
  update: (id: string, patch: ZonePatch) =>
    api<EmergencyZone>(`/emergency-zones/${encodeURIComponent(id)}`, { method: "PATCH", body: patch }),
  remove: (id: string) => api<void>(`/emergency-zones/${encodeURIComponent(id)}`, { method: "DELETE" }),
  // aliases
  all: (q: ZoneQuery = {}, opts: { signal?: AbortSignal } = {}) => zones.list(q, opts),
  delete: (id: string) => zones.remove(id),
};

/** Alias matching the backend resource name. */
export const emergencyZones = zones;

/** Notifications (live under `/me`). */
export const notifications = {
  list: (q: PageQuery = {}) => api<Page<AppNotification>>("/me/notifications", { query: { ...q } }),
  readAll: () => api<void>("/me/notifications/read-all", { method: "POST" }),
  // aliases
  all: (q: PageQuery = {}) => notifications.list(q),
  markAllRead: () => notifications.readAll(),
  readAllNotifications: () => notifications.readAll(),
};
