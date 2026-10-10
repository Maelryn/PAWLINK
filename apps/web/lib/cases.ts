"use client";

import { ApiError, apiOn } from "./api/client";
import { cases as casesApi, uploads, type NewCase } from "./api/endpoints";
import { store } from "./store";
import type { Case, HelpType, User } from "./types";

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

export const resolveCase = (c: Case, me: User) =>
  run(() => casesApi.setStatus(c.id, "resolved"), () => store.resolveCase(c.id, me));

export const confirmCase = (c: Case) => run(() => casesApi.confirm(c.id), () => store.confirm(c.id));

export const flagCase = (c: Case) => run(() => casesApi.flag(c.id), () => store.flag(c.id));

export const moderateCase = (c: Case, decision: "approved" | "hidden") =>
  run(() => casesApi.moderate(c.id, decision), () => store.moderate(c.id, decision));

/* ─────────────── creating a report ─────────────── */

async function toBlob(photo: string): Promise<Blob> {
  return (await fetch(photo)).blob(); // works for data: URLs and same-origin demo photos
}

/** Uploads one photo the way the backend wants it: the original goes to /uploads/probe first
    (EXIF + duplicate check server-side), then to the storage URL from /uploads/signature. */
async function uploadPhoto(photo: string): Promise<{ url: string; probeId?: string }> {
  if (!apiOn("uploads")) return { url: photo };
  const blob = await toBlob(photo);
  const { probeId } = await uploads.probe(blob);
  const sig = await uploads.signature();
  const form = new FormData();
  for (const [k, v] of Object.entries(sig.fields)) form.append(k, v);
  form.append("file", blob);
  const r = await fetch(sig.url, { method: "POST", body: form });
  if (!r.ok) throw new ApiError(r.status, "UPLOAD_FAILED", "Photo upload failed");
  const body = (await r.json()) as { secure_url?: string; url?: string };
  return { url: body.secure_url ?? body.url ?? "", probeId };
}

/** Sends a report to the API (photos, then POST /cases). The server runs the AI and the trust
    checks and answers with the full case, including `ai` and `trust`. */
export async function createCaseRemote(draft: Omit<NewCase, "photos" | "probeIds">, photo: string | null): Promise<{ ok: true; case: Case } | { ok: false; code: string; message?: string }> {
  try {
    const up = photo ? await uploadPhoto(photo) : null;
    const created = await casesApi.create({ ...draft, photos: up ? [up.url] : [], probeIds: up?.probeId ? [up.probeId] : [] });
    store.upsertCase(created, { justCreated: true });
    return { ok: true, case: created };
  } catch (e) {
    const f = failed(e);
    return f.ok ? { ok: false, code: "UNKNOWN" } : f;
  }
}

export const casesFromApi = real;

/* ─────────────── keeping the map fresh ─────────────── */

let timer: ReturnType<typeof setInterval> | null = null;

/** Loads the public cases (GET /cases) and refreshes them every 20 s while the tab is visible.
    (Socket.IO realtime can replace the polling later without touching the screens.) */
export function startCaseSync() {
  if (!real() || timer) return;
  const load = () => {
    if (document.visibilityState !== "visible") return;
    casesApi
      .list({ pageSize: 500 })
      .then((p) => store.setCases(p.items))
      .catch(() => {});
  };
  load();
  timer = setInterval(load, 20_000);
  document.addEventListener("visibilitychange", load);
}
