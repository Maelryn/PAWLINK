"use client";

import { useSyncExternalStore } from "react";
import { ADOPTIONS, CASES, REVIEWS, SERVICES, USERS } from "./mock/data";
import type {
  AdoptionProfile,
  AdoptionRequest,
  AppNotification,
  Booking,
  Case,
  HelpType,
  NotificationKind,
  Review,
  Service,
  User,
} from "./types";

/* Client "database" for the demo. Everything is saved in localStorage so the app behaves like a
   real one (reload-safe). When the NestJS + Supabase API is live, each action below becomes one
   API call (the endpoint is noted next to it) and the screens don't change. */

export interface DB {
  users: User[];
  sessionId: string | null;
  cases: Case[];
  reviews: Review[];
  adoptions: AdoptionProfile[];
  requests: AdoptionRequest[];
  services: Service[];
  bookings: Booking[];
  notifications: AppNotification[];
  /** Saved adoption profiles (the heart), per user. API: PUT/DELETE /me/favorites/:adoptionId */
  favorites: Record<string, string[]>;
}

interface State extends DB {
  /** false during server render / before localStorage is read */
  hydrated: boolean;
  /** id of the case that was just created; the map uses it to play the "drop" animation */
  lastCreatedId: string | null;
  /** false while the real API session is being restored (refresh cookie → /me). Always true in demo mode. */
  authChecked: boolean;
}

const KEY = "pawlink.db.v2";
const seed = (): DB => ({
  users: USERS,
  sessionId: null,
  cases: CASES,
  reviews: REVIEWS,
  adoptions: ADOPTIONS,
  requests: [],
  services: SERVICES,
  bookings: [],
  notifications: [],
  favorites: {},
});

let state: State = { ...seed(), hydrated: false, lastCreatedId: null, authChecked: false };
/** What the server rendered (never hydrated). Used while React hydrates, so the first client render matches the HTML. */
const SERVER_STATE = state;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function persist() {
  try {
    const db: DB = { users: state.users, sessionId: state.sessionId, cases: state.cases, reviews: state.reviews, adoptions: state.adoptions, requests: state.requests, services: state.services, bookings: state.bookings, notifications: state.notifications, favorites: state.favorites };
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // quota exceeded (big photos): keep working in memory
  }
}

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  persist();
  emit();
}

const now = () => new Date().toISOString();
const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const lite = (u: User) => ({ id: u.id, name: u.name, avatar: u.avatar });

function notify(userId: string | undefined, kind: NotificationKind, subject: string, href: string) {
  if (!userId) return [];
  return [{ id: uid("n"), userId, kind, subject, href, read: false, createdAt: now() }];
}

function updateCase(id: string, fn: (c: Case) => Case) {
  set({ cases: state.cases.map((c) => (c.id === id ? fn(c) : c)) });
}

export const store = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => state,

  /** Reads the saved database once on the client (called by <Providers>).
      With the real auth API, the session is restored separately (lib/auth.ts restoreSession). */
  hydrate(opts: { realAuth?: boolean } = {}) {
    if (state.hydrated) return;
    let saved: Partial<DB> = {};
    try {
      saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    } catch {}
    state = { ...state, ...saved, hydrated: true, authChecked: !opts.realAuth };
    emit();
  },
  setAuthChecked() {
    set({ authChecked: true });
  },

  resetDemo() {
    localStorage.removeItem(KEY);
    state = { ...seed(), hydrated: true, lastCreatedId: null, authChecked: true, sessionId: state.sessionId };
    persist();
    emit();
  },

  /* ── account ── POST /auth/login · /auth/register · PATCH /me */
  setSession(id: string | null) {
    set({ sessionId: id });
  },
  addUser(u: User) {
    set({ users: [...state.users, u] });
  },
  /** A user coming from the API: replace the local copy (same id) or add it, and optionally sign them in. */
  upsertUser(u: User, signIn = false) {
    const users = state.users.some((x) => x.id === u.id) ? state.users.map((x) => (x.id === u.id ? { ...x, ...u } : x)) : [...state.users, u];
    set({ users, ...(signIn ? { sessionId: u.id } : {}) });
  },
  updateUser(id: string, patch: Partial<User>) {
    set({ users: state.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) });
  },
  deleteAccount(id: string) {
    set({ users: state.users.filter((u) => u.id !== id), sessionId: null });
  },

  /* ── cases ── POST /cases · POST /cases/:id/help · /confirm · /flag */
  addCase(c: Case) {
    // the volunteers / vets the AI matched nearby get a notification (only once the report is public)
    const nearby = c.moderation === "pending" ? [] : (c.ai?.suggestedHelpers ?? []).map((h) => h.userId).filter((id) => id !== c.reporter.id);
    set({
      cases: [c, ...state.cases],
      lastCreatedId: c.moderation === "pending" ? null : c.id,
      notifications: [...nearby.flatMap((id) => notify(id, "nearbyCase", c.title, `/cases/${c.id}`)), ...state.notifications],
    });
  },
  offerHelp(caseId: string, helpType: HelpType, me: User) {
    const c = state.cases.find((x) => x.id === caseId);
    updateCase(caseId, (x) => ({
      ...x,
      status: x.status === "open" ? "in_progress" : x.status,
      helpers: [...x.helpers.filter((h) => h.user.id !== me.id), { user: lite(me), helpType }],
      updatedAt: now(),
    }));
    if (c && c.reporter.id !== me.id) set({ notifications: [...notify(c.reporter.id, "help", me.name, `/cases/${caseId}`), ...state.notifications] });
  },
  /** PATCH /cases/:id/status { status: "resolved" } — reporter, a helper, a vet or an admin */
  resolveCase(caseId: string, me: User) {
    const c = state.cases.find((x) => x.id === caseId);
    if (!c || c.status === "resolved") return;
    updateCase(caseId, (x) => ({ ...x, status: "resolved", updatedAt: now() }));
    const people = [c.reporter.id, ...c.helpers.map((h) => h.user.id)].filter((id, i, a) => id !== me.id && a.indexOf(id) === i);
    set({ notifications: [...people.flatMap((id) => notify(id, "resolved", me.name, `/cases/${caseId}`)), ...state.notifications] });
  },
  confirm(caseId: string) {
    updateCase(caseId, (c) => {
      if (!c.trust) return c;
      const confirmations = c.trust.confirmations + 1;
      return { ...c, trust: { ...c.trust, confirmations, score: Math.min(1, c.trust.score + 0.08), level: c.trust.level === "unverified" && confirmations >= 2 ? "verified" : c.trust.level } };
    });
  },
  flag(caseId: string) {
    updateCase(caseId, (c) => {
      if (!c.trust) return c;
      const flags = c.trust.flags + 1;
      return { ...c, trust: { ...c.trust, flags }, moderation: flags >= 3 ? "pending" : c.moderation };
    });
  },
  moderate(caseId: string, decision: "approved" | "hidden") {
    updateCase(caseId, (c) => ({ ...c, moderation: decision }));
  },
  /** Cases coming from the API (GET /cases, POST responses, realtime): replace by id or add. */
  upsertCase(c: Case, opts: { justCreated?: boolean } = {}) {
    const exists = state.cases.some((x) => x.id === c.id);
    set({
      cases: exists ? state.cases.map((x) => (x.id === c.id ? c : x)) : [c, ...state.cases],
      ...(opts.justCreated && c.moderation !== "pending" ? { lastCreatedId: c.id } : {}),
    });
  },
  /** The public map list from GET /cases replaces the demo cases. */
  setCases(list: Case[]) {
    set({ cases: list });
  },
  recentReportsBy(userId: string) {
    const hourAgo = Date.now() - 3_600_000;
    return state.cases.filter((c) => c.reporter.id === userId && new Date(c.createdAt).getTime() > hourAgo).length;
  },
  clearLastCreated() {
    state = { ...state, lastCreatedId: null };
    emit();
  },

  /* ── adoption marketplace ── POST /adoptions · PATCH /admin/adoptions/:id · /requests */
  addAdoption(a: AdoptionProfile) {
    set({ adoptions: [{ ...a, status: "pending" }, ...state.adoptions] });
  },
  updateAdoption(id: string, patch: Partial<AdoptionProfile>) {
    set({ adoptions: state.adoptions.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  },
  removeAdoption(id: string) {
    set({ adoptions: state.adoptions.filter((a) => a.id !== id), requests: state.requests.filter((r) => r.adoptionId !== id) });
  },
  moderateAdoption(id: string, status: "approved" | "rejected") {
    const a = state.adoptions.find((x) => x.id === id);
    set({
      adoptions: state.adoptions.map((x) => (x.id === id ? { ...x, status } : x)),
      notifications: [...notify(a?.ownerId, status === "approved" ? "listingApproved" : "listingRejected", a?.name ?? "", `/adopt/${id}`), ...state.notifications],
    });
  },
  sendRequest(r: AdoptionRequest) {
    const a = state.adoptions.find((x) => x.id === r.adoptionId);
    set({
      requests: [r, ...state.requests.filter((x) => !(x.adoptionId === r.adoptionId && x.from.id === r.from.id))],
      notifications: [...notify(a?.ownerId, "adoptRequest", r.from.name, "/account?tab=requests"), ...state.notifications],
    });
  },
  /** Owner answers. Accepting shares the owner's phone; the others stay private. */
  answerRequest(id: string, status: "accepted" | "declined") {
    const r = state.requests.find((x) => x.id === id);
    const a = state.adoptions.find((x) => x.id === r?.adoptionId);
    set({
      requests: state.requests.map((x) => (x.id === id ? { ...x, status } : x)),
      notifications: [...notify(r?.from.id, status === "accepted" ? "adoptAccepted" : "adoptDeclined", a?.name ?? "", `/adopt/${a?.id}`), ...state.notifications],
    });
  },

  /* ── services, reviews, bookings, pro ── */
  addService(s: Service) {
    set({ services: [...state.services, { ...s, status: "pending", verified: false }] });
  },
  updateService(id: string, patch: Partial<Service>) {
    set({ services: state.services.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  },
  moderateService(id: string, approve: boolean) {
    const s = state.services.find((x) => x.id === id);
    set({
      services: state.services.map((x) => (x.id === id ? { ...x, status: approve ? "approved" : "rejected", verified: approve } : x)),
      notifications: approve ? [...notify(s?.ownerId, "serviceApproved", s?.name ?? "", `/services/${id}`), ...state.notifications] : state.notifications,
    });
  },
  /** One review per user per service; the rating average is recomputed. POST /services/:id/reviews */
  addReview(r: Review) {
    const reviews = [r, ...state.reviews.filter((x) => !(x.serviceId === r.serviceId && x.author.id === r.author.id))];
    const s = state.services.find((x) => x.id === r.serviceId);
    set({ reviews, notifications: [...notify(s?.ownerId, "review", r.author.name, `/services/${r.serviceId}`), ...state.notifications] });
  },
  replyReview(id: string, reply: string) {
    set({ reviews: state.reviews.map((r) => (r.id === id ? { ...r, reply } : r)) });
  },
  book(b: Booking) {
    const s = state.services.find((x) => x.id === b.serviceId);
    set({ bookings: [b, ...state.bookings], notifications: [...notify(s?.ownerId, "booking", b.from.name, "/account?tab=pro"), ...state.notifications] });
  },
  answerBooking(id: string, status: "confirmed" | "declined") {
    const b = state.bookings.find((x) => x.id === id);
    const s = state.services.find((x) => x.id === b?.serviceId);
    set({
      bookings: state.bookings.map((x) => (x.id === id ? { ...x, status } : x)),
      notifications: [...notify(b?.from.id, status === "confirmed" ? "bookingConfirmed" : "bookingDeclined", s?.name ?? "", `/services/${s?.id}`), ...state.notifications],
    });
  },
  /** Demo payment: activates Pro for 30 days. Real: Chargily (CIB / Edahabia) webhook → PATCH /me/pro */
  activatePro(userId: string, days = 30) {
    const u = state.users.find((x) => x.id === userId);
    const since = now();
    const until = new Date(Date.now() + days * 86_400_000).toISOString();
    set({
      users: state.users.map((x) => (x.id === userId ? { ...x, pro: { plan: "pro", since, until } } : x)),
      services: state.services.map((s) => (s.id === u?.serviceId ? { ...s, pro: true } : s)),
      notifications: [...notify(userId, "proActive", "PawLink Pro", "/account?tab=pro"), ...state.notifications],
    });
  },

  toggleFavorite(userId: string, adoptionId: string) {
    const mine = state.favorites[userId] ?? [];
    const next = mine.includes(adoptionId) ? mine.filter((x) => x !== adoptionId) : [...mine, adoptionId];
    set({ favorites: { ...state.favorites, [userId]: next } });
    return next.includes(adoptionId);
  },

  /* ── notifications ── */
  markAllRead(userId: string) {
    set({ notifications: state.notifications.map((n) => (n.userId === userId ? { ...n, read: true } : n)) });
  },
};

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.get()),
    () => selector(SERVER_STATE),
  );
}

/** Cases visible to the public: moderation-pending and hidden reports stay out of the map. */
export const isPublic = (c: Case) => c.moderation !== "pending" && c.moderation !== "hidden";

/** Average rating + count computed from the reviews actually stored. */
export function ratingOf(s: Service, reviews: Review[]) {
  const mine = reviews.filter((r) => r.serviceId === s.id);
  // seed services carry a historical average; new reviews are blended in
  const total = s.rating * s.reviewCount + mine.reduce((a, r) => a + r.rating, 0);
  const count = s.reviewCount + mine.length;
  return { rating: count ? Math.round((total / count) * 10) / 10 : 0, count };
}
