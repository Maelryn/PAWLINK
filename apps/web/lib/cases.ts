"use client";

import { ApiError, apiOn } from "./api/client";
import { cases as casesApi, uploads, type NewCase } from "./api/endpoints";
import { bboxKey, type Bbox } from "./bbox";
import { store } from "./store";
import type { Case, GeoPoint, HelpType, User } from "./types";

/* Case actions used by the screens. With the cases API on (backend Phase 2) they call it and
   store what the server answers; otherwise they run on the demo database. Screens never call
   the store directly for these, so switching is one env var. */

const real = () => apiOn("cases");

export type ActionResult = { ok: true } | { ok: false; code: string; message?: string };
const done: ActionResult = { ok: true };
const failed = (e: unknown): ActionResult => (e instanceof ApiError ? { ok: false, code: e.code, message: e.message } : { ok: false, code: "UNKNOWN" });

async function run(apiCall: () => Promise<Case>, local: () => void): Promise<ActionResult> {
  if (!real()) {
    local();
    return done;
  }
  try {
    store.upsertCase(await apiCall());
    return done;
  } catch (e) {
    return failed(e);
  }
}

export const offerHelp = (c: Case, helpType: HelpType, me: User) =>
  run(() => casesApi.help(c.id, helpType), () => store.offerHelp(c.id, helpType, me));

/** Who may close a case. The API (Phase 2) allows volunteers, vets and admins; the demo also lets
    the reporter and the people helping close it (requested from the backend, see docs/tasks/BACKEND.md). */
export const canResolve = (c: Case, me: User) =>
  real()
    ? me.role === "volunteer" || me.role === "vet" || me.role === "admin"
    : me.id === c.reporter.id || c.helpers.some((h) => h.user.id === me.id) || me.role === "vet" || me.role === "admin";

export const resolveCase = (c: Case, me: User) =>
  run(() => casesApi.setStatus(c.id, "resolved"), () => store.resolveCase(c.id, me));

/**
 * "Do you see this animal?" — from someone standing within 1 km.
 *
 * The API is the one that decides: it measures the distance from `here` and
 * refuses the answer beyond 1 km, and it takes one answer per account. The
 * screen checks the same radius first so the answer is never sent in vain, but
 * the check that counts is the server's.
 */
export const voteOnCase = async (
  c: Case,
  userId: string,
  seen: boolean,
  here: GeoPoint,
): Promise<ActionResult> => {
  if (!real()) {
    store.vote(c.id, userId, seen);
    return done;
  }
  return run(
    () => casesApi.confirm(c.id, { seen, lat: here.lat, lng: here.lng }),
    () => store.vote(c.id, userId, seen),
  );
};

/** The reporter edits their report: a public one waits for a moderator, the API answers with `pendingEdit`. */
export const proposeCaseEdit = async (c: Case, patch: { description: string; conditionTags: string[] }): Promise<ActionResult> =>
  run(() => casesApi.update(c.id, patch), () => store.proposeCaseEdit(c.id, patch));

/** The reporter deletes their report. */
export const deleteCase = async (c: Case): Promise<ActionResult> => {
  if (!real()) {
    store.removeCase(c.id);
    return done;
  }
  try {
    await casesApi.remove(c.id);
    store.removeCase(c.id);
    return done;
  } catch (e) {
    return failed(e);
  }
};

export const flagCase = (c: Case, me: User) => run(() => casesApi.flag(c.id), () => void store.flag(c.id, me.id));
export const alreadyFlagged = (c: Case, me: User) => !!c.trust?.flaggedBy?.includes(me.id);
/** Demo data only for now. */
export const withdrawHelp = (c: Case, me: User) => store.withdrawHelp(c.id, me.id);

export const moderateCase = (c: Case, decision: "approved" | "hidden") =>
  run(() => casesApi.moderate(c.id, decision), () => store.moderate(c.id, decision));

/* ─────────────── creating a report ─────────────── */

async function toBlob(photo: string): Promise<Blob> {
  return (await fetch(photo)).blob(); // works for data: URLs and same-origin demo photos
}

/** A phone photo is often 3-8 MB: storage gets a copy of at most 1600 px (a few hundred KB),
    which is plenty for the app and much faster on mobile data. Any failure keeps the original. */
async function smaller(blob: Blob, max = 1600): Promise<Blob> {
  if (blob.size < 700_000 || typeof createImageBitmap === "undefined") return blob;
  try {
    const img = await createImageBitmap(blob);
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * k);
    canvas.height = Math.round(img.height * k);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    img.close();
    const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    return out && out.size < blob.size ? out : blob;
  } catch {
    return blob;
  }
}

/** Uploads one photo the way the backend wants it: the original goes to /uploads/probe first
    (EXIF + duplicate check server-side need the untouched file), then a lighter copy goes to the
    storage URL from /uploads/signature. */
export async function uploadPhoto(photo: string): Promise<{ url: string; probeId?: string }> {
  if (!apiOn("uploads")) return { url: photo };
  const blob = await toBlob(photo);
  const { probeId } = await uploads.probe(blob);
  let sig;
  try {
    sig = await uploads.signature();
  } catch (e) {
    // no photo storage configured on this server yet: the EXIF/duplicate checks still count, the photo isn't stored
    if (e instanceof ApiError && e.code === "UPLOADS_NOT_CONFIGURED") return { url: "", probeId };
    throw e;
  }
  const form = new FormData();
  form.append("file", await smaller(blob));
  form.append("api_key", sig.apiKey);
  form.append("timestamp", String(sig.timestamp));
  form.append("signature", sig.signature);
  form.append("folder", sig.folder);
  const r = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, { method: "POST", body: form });
  if (!r.ok) throw new ApiError(r.status, "UPLOAD_FAILED", "Photo upload failed");
  const body = (await r.json()) as { secure_url?: string; url?: string };
  return { url: body.secure_url ?? body.url ?? "", probeId };
}

/** Sends a report to the API (photos, then POST /cases). The server runs the AI and the trust
    checks and answers with the full case, including `ai` and `trust`. */
export async function createCaseRemote(draft: Omit<NewCase, "photos" | "probeIds">, photo: string | null): Promise<{ ok: true; case: Case } | { ok: false; code: string; message?: string }> {
  try {
    const up = photo ? await uploadPhoto(photo) : null;
    const created = await casesApi.create({ ...draft, photos: up?.url ? [up.url] : [], probeIds: up?.probeId ? [up.probeId] : [] });
    store.upsertCase(created, { justCreated: true });
    return { ok: true, case: created };
  } catch (e) {
    const f = failed(e);
    return f.ok ? { ok: false, code: "UNKNOWN" } : f;
  }
}

export const casesFromApi = real;

/* ─────────────── keeping the map fresh ─────────────── */

/** The box the map is showing right now. While a map is on screen the sync asks the API for
    that box only, so the map never lists the whole country. `null` = no map on screen: the
    landing counters and the dashboards need the country. */
let viewport: Bbox | null = null;

/** A box is cheap (one GIST index lookup); the whole country is not — it is refreshed far
    less often. */
const BOX_EVERY = 20_000;
const COUNTRY_EVERY = 120_000;

let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;
/** The last request wins: an answer that arrives after a newer one is dropped. */
let seq = 0;
let inFlight: AbortController | null = null;
/** Pending "the map is gone, give the country back". */
let backToCountry: ReturnType<typeof setTimeout> | null = null;

const load = () => {
  if (!real() || document.visibilityState !== "visible") return;
  inFlight?.abort();
  const ctrl = new AbortController();
  inFlight = ctrl;
  const mine = ++seq;
  casesApi
    .list({ bbox: viewport ?? undefined, pageSize: 500 }, { signal: ctrl.signal })
    .then((p) => {
      if (mine === seq) store.setCases(p.items);
    })
    .catch(() => {
      // an aborted request is not a failure: the next one is already on its way
    });
};

const schedule = () => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    load();
    schedule();
  }, viewport ? BOX_EVERY : COUNTRY_EVERY);
};

/** Loads the public cases (GET /cases) and refreshes them while the tab is visible.
    (Socket.IO realtime can replace the polling later without touching the screens.) */
export function startCaseSync() {
  if (!real() || started) return;
  started = true;
  load();
  schedule();
  document.addEventListener("visibilitychange", load);
}

/** The map tells the sync which box it is showing: the list follows the viewport instead of
    listing the whole country. `null` (no map on screen) puts it back to the country. */
export function setCaseSyncViewport(bbox: Bbox | null) {
  if (!real() || bboxKey(viewport) === bboxKey(bbox)) return;
  viewport = bbox;
  if (bbox) {
    if (backToCountry) {
      clearTimeout(backToCountry);
      backToCountry = null;
    }
    load();
    schedule();
    return;
  }
  // Leaving the map: the other screens need the country. A moment later, so a remount
  // (React runs the effects twice in development) does not ask for the whole country in between.
  if (backToCountry) clearTimeout(backToCountry);
  backToCountry = setTimeout(() => {
    backToCountry = null;
    if (viewport) return; // a map came back
    load();
    schedule();
  }, 1500);
}
