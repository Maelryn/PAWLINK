"use client";

import { useSyncExternalStore } from "react";
import { ADOPTIONS, CASES, EMERGENCY_ZONES, REVIEWS, SERVICES, USERS } from "./mock/data";
import { circlePolygon, inZone } from "./zones";
import type {
  AdoptionProfile,
  AdoptionRequest,
  AppNotification,
  Booking,
  Case,
  EmergencyZone,
  GeoPoint,
  HelpType,
  NotificationKind,
  Review,
  Service,
  User,
  AdoptionEdit,
  CaseEdit,
  ServiceEdit,
} from "./types";
import { distanceKm } from "./utils";
import { availabilityOf } from "./people";

/** "Do you see this animal?" goes to people within this distance of a new report. */
const ASK_RADIUS_KM = 3;

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
  /** Emergency zones (wildfire, flood…), declared and ended by admins. API: /emergency-zones */
  zones: EmergencyZone[];
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
  zones: EMERGENCY_ZONES,
});

let state: State = { ...seed(), hydrated: false, lastCreatedId: null, authChecked: false };
/** What the server rendered (never hydrated). Used while React hydrates, so the first client render matches the HTML. */
const SERVER_STATE = state;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function persist() {
  try {
    const db: DB = { users: state.users, sessionId: state.sessionId, cases: state.cases, reviews: state.reviews, adoptions: state.adoptions, requests: state.requests, services: state.services, bookings: state.bookings, notifications: state.notifications, favorites: state.favorites, zones: state.zones };
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

/** Is this user's Pro / Pro+ subscription running right now? */
export const proActive = (u?: User | null) => !!u?.pro && new Date(u.pro.until).getTime() > Date.now();

/** A listing owned by an account is "featured" exactly while its owner's subscription runs (expiry included). */
function syncFeatured(services: Service[], users: User[]): Service[] {
  return services.map((s) => {
    if (!s.ownerId) return s;
    const owner = users.find((u) => u.id === s.ownerId);
    if (!owner) return s;
    const pro = proActive(owner);
    return s.pro === pro ? s : { ...s, pro };
  });
}
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
    state = { ...state, services: syncFeatured(state.services, state.users) };
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
  /** Deleting an account also takes down what only made sense with that person behind it: their adoption
      listings (and the requests on them), their own requests, their business listing and appointments.
      Reports stay: other people may already be helping the animal. DELETE /me */
  deleteAccount(id: string) {
    const listings = state.adoptions.filter((a) => a.ownerId === id).map((a) => a.id);
    const service = state.users.find((u) => u.id === id)?.serviceId;
    set({
      users: state.users.filter((u) => u.id !== id),
      adoptions: state.adoptions.filter((a) => a.ownerId !== id),
      requests: state.requests.filter((r) => r.from.id !== id && !listings.includes(r.adoptionId)),
      services: state.services.filter((s) => s.ownerId !== id),
      bookings: state.bookings.filter((b) => b.from.id !== id && b.serviceId !== service),
      notifications: state.notifications.filter((n) => n.userId !== id),
      favorites: Object.fromEntries(Object.entries(state.favorites).filter(([k]) => k !== id).map(([k, v]) => [k, v.filter((x) => !listings.includes(x))])),
      sessionId: null,
    });
  },
  /** Admin changes someone's role (never to admin from the app). PATCH /admin/users/:id/role */
  setRole(id: string, role: Exclude<User["role"], "admin">) {
    set({ users: state.users.map((u) => (u.id === id && u.role !== "admin" ? { ...u, role, ...(role === "vet" ? { licenseVerified: true } : {}) } : u)) });
  },

  /* ── cases ── POST /cases · POST /cases/:id/help · /confirm · /flag */
  addCase(c: Case) {
    // the volunteers / vets the AI matched nearby get a notification (only once the report is public)
    const nearby = c.moderation === "pending" ? [] : (c.ai?.suggestedHelpers ?? []).map((h) => h.userId).filter((id) => id !== c.reporter.id);
    // people around the animal (≤ 3 km) are asked "do you see it?": their answers verify the report
    const around =
      c.moderation === "pending"
        ? []
        : state.users.filter((u) => u.id !== c.reporter.id && !nearby.includes(u.id) && u.location && distanceKm(u.location, c.location) <= ASK_RADIUS_KM).map((u) => u.id);
    set({
      cases: [c, ...state.cases],
      lastCreatedId: c.moderation === "pending" ? null : c.id,
      notifications: [
        ...nearby.flatMap((id) => notify(id, "nearbyCase", c.title, `/cases/${c.id}`)),
        ...around.flatMap((id) => notify(id, "confirmAsk", c.title, `/cases/${c.id}#verify`)),
        ...state.notifications,
      ],
    });
  },
  offerHelp(caseId: string, helpType: HelpType, me: User) {
    const c = state.cases.find((x) => x.id === caseId);
    updateCase(caseId, (x) => {
      // answering a request for more help ticks that need off the list
      const left = x.nextHelp?.types.filter((h) => h !== helpType) ?? [];
      return {
        ...x,
        status: x.status === "open" ? "in_progress" : x.status,
        helpers: [...x.helpers.filter((h) => h.user.id !== me.id), { user: lite(me), helpType }],
        nextHelp: x.nextHelp && left.length ? { ...x.nextHelp, types: left } : undefined,
        updatedAt: now(),
      };
    });
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
  /** The reporter says the animal is still there: the case stays on the map for a new period. PATCH /cases/:id/renew */
  renewCase(caseId: string) {
    updateCase(caseId, (c) => ({ ...c, updatedAt: now() }));
  },
  /** Someone near the animal answers "do you see it?". Two yes = verified; more no than yes (≥ 2) = back to moderators.
      The position check (≤ 1 km) happens before, on the device and again in the API. POST /cases/:id/confirm { seen, lat, lng } */
  vote(caseId: string, userId: string, seen: boolean) {
    const before = state.cases.find((x) => x.id === caseId);
    if (!before?.trust || before.trust.confirmedBy?.includes(userId) || before.trust.deniedBy?.includes(userId)) return;
    updateCase(caseId, (c) => {
      if (!c.trust) return c;
      const confirmedBy = seen ? [...(c.trust.confirmedBy ?? []), userId] : c.trust.confirmedBy ?? [];
      const deniedBy = seen ? c.trust.deniedBy ?? [] : [...(c.trust.deniedBy ?? []), userId];
      const confirmations = c.trust.confirmations + (seen ? 1 : 0);
      const doubtful = deniedBy.length >= 2 && deniedBy.length > confirmedBy.length;
      return {
        ...c,
        updatedAt: seen ? now() : c.updatedAt,
        moderation: doubtful ? "pending" : c.moderation,
        trust: {
          ...c.trust,
          confirmedBy,
          deniedBy,
          confirmations,
          score: Math.max(0, Math.min(1, c.trust.score + (seen ? 0.12 : -0.12))),
          level: doubtful ? "suspicious" : confirmedBy.length >= 2 ? "verified" : c.trust.level,
        },
      };
    });
    if (seen) set({ notifications: [...notify(before.reporter.id, "caseConfirmed", before.title, `/cases/${caseId}`), ...state.notifications] });
  },
  /** The reporter changes the text of a public report: it waits for a moderator (a pending report changes directly). PATCH /cases/:id */
  proposeCaseEdit(caseId: string, patch: Omit<CaseEdit, "at">) {
    updateCase(caseId, (c) => (c.moderation === "pending" ? { ...c, ...patch, updatedAt: now() } : { ...c, pendingEdit: { ...patch, at: now() } }));
  },
  reviewCaseEdit(caseId: string, ok: boolean) {
    const c = state.cases.find((x) => x.id === caseId);
    if (!c?.pendingEdit) return;
    const patch: Partial<CaseEdit> = { ...c.pendingEdit };
    delete patch.at;
    updateCase(caseId, (x) => (ok ? { ...x, ...patch, pendingEdit: undefined, updatedAt: now() } : { ...x, pendingEdit: undefined }));
    set({ notifications: [...notify(c.reporter.id, ok ? "editApproved" : "editRejected", c.title, `/cases/${caseId}`), ...state.notifications] });
  },
  /** The reporter deletes their report. DELETE /cases/:id */
  removeCase(caseId: string) {
    set({ cases: state.cases.filter((c) => c.id !== caseId), notifications: state.notifications.filter((n) => n.href.split("#")[0] !== `/cases/${caseId}`) });
  },
  confirm(caseId: string) {
    updateCase(caseId, (c) => {
      if (!c.trust) return c;
      const confirmations = c.trust.confirmations + 1;
      return { ...c, updatedAt: now(), trust: { ...c.trust, confirmations, score: Math.min(1, c.trust.score + 0.08), level: c.trust.level === "unverified" && confirmations >= 2 ? "verified" : c.trust.level } };
    });
  },
  /** Returns false when this person already flagged the case (3 different people send it back to moderators). */
  flag(caseId: string, userId: string) {
    const c0 = state.cases.find((x) => x.id === caseId);
    if (!c0?.trust || c0.trust.flaggedBy?.includes(userId)) return false;
    updateCase(caseId, (c) => {
      if (!c.trust) return c;
      const flags = c.trust.flags + 1;
      return { ...c, trust: { ...c.trust, flags, flaggedBy: [...(c.trust.flaggedBy ?? []), userId] }, moderation: flags >= 3 ? "pending" : c.moderation };
    });
    return true;
  },
  /** The helper says where they are: on the way, then with the animal. The reporter is told; once someone is with
      the animal, the other helpers are told too (so they don't all go for nothing). PATCH /cases/:id/help */
  setHelperStage(caseId: string, userId: string, stage: "onway" | "onsite") {
    const c = state.cases.find((x) => x.id === caseId);
    const me = c?.helpers.find((h) => h.user.id === userId);
    if (!c || !me || me.stage === stage || c.status === "resolved") return;
    updateCase(caseId, (x) => ({ ...x, helpers: x.helpers.map((h) => (h.user.id === userId ? { ...h, stage, stageAt: now() } : h)), updatedAt: now() }));
    const others = stage === "onsite" ? c.helpers.filter((h) => h.user.id !== userId && h.stage !== "onsite").map((h) => h.user.id) : [];
    const kind = stage === "onway" ? "helperOnWay" : "helperOnSite";
    set({
      notifications: [...[c.reporter.id, ...others].flatMap((id) => notify(id, kind, me.user.name, `/cases/${caseId}`)), ...state.notifications],
    });
  },
  /** The person with the animal asks for the next step: the right people nearby (skill + available + close) are notified. */
  requestNextHelp(caseId: string, userId: string, types: HelpType[]) {
    const c = state.cases.find((x) => x.id === caseId);
    if (!c || !types.length || c.status === "resolved") return;
    updateCase(caseId, (x) => ({ ...x, nextHelp: { types, by: userId, at: now() }, updatedAt: now() }));
    const already = new Set([c.reporter.id, ...c.helpers.map((h) => h.user.id)]);
    const people = state.users
      .filter((u) => !already.has(u.id) && u.location && (u.role === "volunteer" || u.role === "vet") && availabilityOf(u) !== "away")
      .filter((u) => u.helpTypes?.some((h) => types.includes(h)) && distanceKm(u.location!, c.location) <= 40)
      .map((u) => u.id);
    set({ notifications: [...[c.reporter.id, ...people].flatMap((id) => notify(id, "nextHelp", c.title, `/cases/${caseId}`)), ...state.notifications] });
  },
  /** A helper can't help anymore: they leave the case (with nobody left, it's open again). */
  withdrawHelp(caseId: string, userId: string) {
    updateCase(caseId, (c) => {
      const helpers = c.helpers.filter((h) => h.user.id !== userId);
      return { ...c, helpers, status: c.status === "in_progress" && helpers.length === 0 ? "open" : c.status, updatedAt: now() };
    });
  },
  moderate(caseId: string, decision: "approved" | "hidden") {
    updateCase(caseId, (c) => ({ ...c, moderation: decision }));
  },
  /* ── emergency zones ── POST /emergency-zones · PATCH /emergency-zones/:id */
  declareZone(input: { type: EmergencyZone["type"]; name: string; region: string; center: GeoPoint; radiusKm: number }) {
    const z: EmergencyZone = {
      id: uid("z"),
      name: input.name,
      region: input.region,
      type: input.type,
      center: input.center,
      radiusKm: input.radiusKm,
      polygon: circlePolygon(input.center, input.radiusKm),
      active: true,
      startedAt: now(),
      stats: { cases: 0, urgent: 0, helpers: 0 },
    };
    // open cases inside the new zone join it (they show up in emergency mode)
    set({
      zones: [z, ...state.zones],
      cases: state.cases.map((c) => (!c.emergencyZoneId && c.status !== "resolved" && inZone(c.location, z) ? { ...c, emergencyZoneId: z.id } : c)),
    });
    return z;
  },
  endZone(id: string) {
    set({ zones: state.zones.map((z) => (z.id === id ? { ...z, active: false, endedAt: now() } : z)) });
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
    const a = state.adoptions.find((x) => x.id === id);
    const waiting = state.requests.filter((r) => r.adoptionId === id && r.status === "sent");
    set({
      adoptions: state.adoptions.filter((a) => a.id !== id),
      requests: state.requests.filter((r) => r.adoptionId !== id),
      notifications: [...waiting.flatMap((r) => notify(r.from.id, "adoptDeclined", a?.name ?? "", "/adopt")), ...state.notifications],
    });
  },
  moderateAdoption(id: string, status: "approved" | "rejected") {
    const a = state.adoptions.find((x) => x.id === id);
    set({
      adoptions: state.adoptions.map((x) => (x.id === id ? { ...x, status } : x)),
      notifications: [...notify(a?.ownerId, status === "approved" ? "listingApproved" : "listingRejected", a?.name ?? "", `/adopt/${id}`), ...state.notifications],
    });
  },
  /** The owner edits a listing. A live one keeps its public version until a moderator approves the change
      (second review); a refused one goes back to the queue. PATCH /adoptions/:id */
  proposeAdoptionEdit(id: string, patch: Omit<AdoptionEdit, "at">) {
    set({
      adoptions: state.adoptions.map((a) =>
        a.id !== id ? a : a.status === "approved" ? { ...a, pendingEdit: { ...patch, at: now() } } : { ...a, ...patch, status: a.status === "rejected" ? "pending" : a.status },
      ),
    });
  },
  reviewAdoptionEdit(id: string, ok: boolean) {
    const a = state.adoptions.find((x) => x.id === id);
    if (!a?.pendingEdit) return;
    const patch: Partial<AdoptionEdit> = { ...a.pendingEdit };
    delete patch.at;
    set({
      adoptions: state.adoptions.map((x) => (x.id !== id ? x : ok ? { ...x, ...patch, pendingEdit: undefined } : { ...x, pendingEdit: undefined })),
      notifications: [...notify(a.ownerId, ok ? "editApproved" : "editRejected", a.name, `/adopt/${id}`), ...state.notifications],
    });
  },
  /** PATCH /adoptions/:id { status: "adopted" } — the owner confirms the animal found its family. */
  markAdopted(id: string) {
    const a = state.adoptions.find((x) => x.id === id);
    if (!a) return;
    const chosen = reservedRequestOf(a, state.requests);
    // the adopter is thanked, everyone still waiting gets a clear "no" instead of waiting forever
    const waiting = state.requests.filter((r) => r.adoptionId === id && r.status === "sent");
    set({
      adoptions: state.adoptions.map((x) => (x.id === id ? { ...x, status: "adopted" } : x)),
      requests: state.requests.map((r) => (r.adoptionId === id && r.status === "sent" ? { ...r, status: "declined" } : r)),
      notifications: [
        ...notify(chosen?.from.id, "adoptDone", a.name, `/adopt/${id}`),
        ...waiting.flatMap((r) => notify(r.from.id, "adoptDeclined", a.name, `/adopt/${id}`)),
        ...state.notifications,
      ],
    });
  },
  /** The accepted adoption didn't happen: the animal is available again. */
  reopenAdoption(id: string) {
    const a = state.adoptions.find((x) => x.id === id);
    const chosen = a && reservedRequestOf(a, state.requests);
    set({
      requests: state.requests.map((r) => (r.id === chosen?.id ? { ...r, status: "declined" } : r)),
      notifications: [...notify(chosen?.from.id, "adoptDeclined", a?.name ?? "", `/adopt/${id}`), ...state.notifications],
    });
  },
  /** The adopter withdraws their request (also after it was accepted). */
  cancelRequest(id: string) {
    const r = state.requests.find((x) => x.id === id);
    const a = state.adoptions.find((x) => x.id === r?.adoptionId);
    set({
      requests: state.requests.map((x) => (x.id === id ? { ...x, status: "cancelled" } : x)),
      notifications: [...notify(a?.ownerId, "adoptCancelled", r?.from.name ?? "", "/account?tab=adoption"), ...state.notifications],
    });
  },
  sendRequest(r: AdoptionRequest) {
    const a = state.adoptions.find((x) => x.id === r.adoptionId);
    set({
      requests: [r, ...state.requests.filter((x) => !(x.adoptionId === r.adoptionId && x.from.id === r.from.id))],
      notifications: [...notify(a?.ownerId, "adoptRequest", r.from.name, "/account?tab=adoption"), ...state.notifications],
    });
  },
  /** Owner answers. Accepting shares the owner's phone; the others stay private. */
  answerRequest(id: string, status: "accepted" | "declined") {
    const r = state.requests.find((x) => x.id === id);
    const a = state.adoptions.find((x) => x.id === r?.adoptionId);
    if (status === "accepted" && a && reservedRequestOf(a, state.requests)) return; // one adoption at a time
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
  /** Same second review for business listings. PATCH /services/:id */
  proposeServiceEdit(id: string, patch: Omit<ServiceEdit, "at">) {
    set({
      services: state.services.map((s) => (s.id !== id ? s : s.status === "approved" ? { ...s, pendingEdit: { ...patch, at: now() } } : { ...s, ...patch })),
    });
  },
  reviewServiceEdit(id: string, ok: boolean) {
    const s = state.services.find((x) => x.id === id);
    if (!s?.pendingEdit) return;
    const patch: Partial<ServiceEdit> = { ...s.pendingEdit };
    delete patch.at;
    set({
      services: state.services.map((x) => (x.id !== id ? x : ok ? { ...x, ...patch, pendingEdit: undefined } : { ...x, pendingEdit: undefined })),
      notifications: [...notify(s.ownerId, ok ? "editApproved" : "editRejected", s.name, "/account?tab=pro"), ...state.notifications],
    });
  },
  /** A regular account asks to become a professional: the listing waits for an admin. POST /services */
  requestBusiness(userId: string, b: { name: string; type: Service["type"]; city: string; phone: string; location?: GeoPoint }) {
    const id = uid("s");
    const s: Service = {
      id,
      type: b.type,
      name: b.name,
      location: { ...(b.location ?? { lat: 36.7538, lng: 3.0588 }), address: b.city },
      phone: b.phone,
      rating: 0,
      reviewCount: 0,
      ownerId: userId,
      status: "pending",
      verified: false,
    };
    set({ services: [...state.services, s], users: state.users.map((u) => (u.id === userId ? { ...u, serviceId: id } : u)) });
  },
  /** Admin decision. Approving a vet makes the owner a vet; refusing frees the account to ask again. */
  moderateService(id: string, approve: boolean) {
    const s = state.services.find((x) => x.id === id);
    set({
      services: state.services.map((x) => (x.id === id ? { ...x, status: approve ? "approved" : "rejected", verified: approve } : x)),
      users: state.users.map((u) =>
        u.id !== s?.ownerId ? u : approve ? (s.type === "vet" ? { ...u, role: "vet", licenseVerified: true } : u) : { ...u, serviceId: undefined },
      ),
      notifications: [
        ...notify(s?.ownerId, approve ? "serviceApproved" : "listingRejected", s?.name ?? "", approve ? "/account?tab=pro" : "/account?tab=profile"),
        ...state.notifications,
      ],
    });
  },
  /** One review per user per service; the rating average is recomputed. POST /services/:id/reviews */
  addReview(r: Review) {
    const reviews = [r, ...state.reviews.filter((x) => !(x.serviceId === r.serviceId && x.author.id === r.author.id))];
    const s = state.services.find((x) => x.id === r.serviceId);
    set({ reviews, notifications: [...notify(s?.ownerId, "review", r.author.name, "/account?tab=pro"), ...state.notifications] });
  },
  replyReview(id: string, reply: string) {
    set({ reviews: state.reviews.map((r) => (r.id === id ? { ...r, reply } : r)) });
  },
  book(b: Booking) {
    const s = state.services.find((x) => x.id === b.serviceId);
    set({ bookings: [b, ...state.bookings], notifications: [...notify(s?.ownerId, "booking", b.from.name, "/account?tab=pro"), ...state.notifications] });
  },
  /** The client cancels their appointment. */
  cancelBooking(id: string) {
    const b = state.bookings.find((x) => x.id === id);
    const s = state.services.find((x) => x.id === b?.serviceId);
    set({
      bookings: state.bookings.map((x) => (x.id === id ? { ...x, status: "cancelled" } : x)),
      notifications: [...notify(s?.ownerId, "bookingCancelled", b?.from.name ?? "", "/account?tab=pro"), ...state.notifications],
    });
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
  /** Pays for Pro / Pro+. Days left on an active subscription are kept (renewing or upgrading never loses time). */
  activatePro(userId: string, days = 30, plan: "pro" | "plus" = "pro") {
    const u = state.users.find((x) => x.id === userId);
    const active = proActive(u);
    const since = active ? u!.pro!.since : now();
    const from = active ? new Date(u!.pro!.until).getTime() : Date.now();
    const until = new Date(from + days * 86_400_000).toISOString();
    set({
      users: state.users.map((x) => (x.id === userId ? { ...x, pro: { plan, since, until } } : x)),
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
  markRead(id: string) {
    if (state.notifications.some((n) => n.id === id && !n.read)) set({ notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) });
  },
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
/** "Adoption in progress": the request the owner accepted on a listing that is still open. Worked out from the
    requests (no extra field), so it means the same thing with the demo data and with the API. */
export const reservedRequestOf = (a: AdoptionProfile, requests: AdoptionRequest[]) =>
  a.status === "approved" ? requests.find((r) => r.adoptionId === a.id && r.status === "accepted") : undefined;

/* How long a case stays on the map without any activity (help offered, confirmation, status change,
   or the reporter saying it's still there). A resolved case leaves the map one day later. */
const DAY = 86_400_000;
export const LIFETIME_DAYS: Record<Case["triage"], number> = { urgent: 3, monitoring: 7, stable: 14 };
export function caseExpiresAt(c: Case): number {
  const last = +new Date(c.updatedAt || c.createdAt);
  return c.status === "resolved" ? last + DAY : last + LIFETIME_DAYS[c.triage] * DAY;
}
export const isExpired = (c: Case, now = Date.now()) => now > caseExpiresAt(c);
/** Milliseconds left before the case leaves the map (negative once expired). */
export const msLeftOnMap = (c: Case) => caseExpiresAt(c) - Date.now();

/** Cases on the public map: moderated in, and not expired. */
export const isPublic = (c: Case) => c.moderation !== "pending" && c.moderation !== "hidden" && !isExpired(c);

/** Average rating + count computed from the reviews actually stored. */
export function ratingOf(s: Service, reviews: Review[]) {
  const mine = reviews.filter((r) => r.serviceId === s.id);
  // seed services carry a historical average; new reviews are blended in
  const total = s.rating * s.reviewCount + mine.reduce((a, r) => a + r.rating, 0);
  const count = s.reviewCount + mine.length;
  return { rating: count ? Math.round((total / count) * 10) / 10 : 0, count };
}
