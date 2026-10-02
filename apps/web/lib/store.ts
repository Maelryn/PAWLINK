"use client";

import { useSyncExternalStore } from "react";
import { ADOPTIONS, CASES, REVIEWS } from "./mock/data";
import type { AdoptionProfile, AdoptionRequest, Case, HelpType, Review, User } from "./types";

/* Tiny client store for the demo (mock mode). When the NestJS API is live, these
   actions become API calls + realtime events and the components don't change. */

interface State {
  cases: Case[];
  reviews: Review[];
  adoptions: AdoptionProfile[];
  requests: AdoptionRequest[];
  /** id of the case that was just created; the map uses it to play the "drop" animation */
  lastCreatedId: string | null;
}

let state: State = { cases: CASES, reviews: REVIEWS, adoptions: ADOPTIONS, requests: [], lastCreatedId: null };

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  emit();
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

  addCase(c: Case) {
    set({ cases: [c, ...state.cases], lastCreatedId: c.moderation === "pending" ? null : c.id });
  },

  offerHelp(caseId: string, helpType: HelpType, me: User) {
    updateCase(caseId, (c) => ({
      ...c,
      status: c.status === "open" ? "in_progress" : c.status,
      helpers: [...c.helpers.filter((h) => h.user.id !== me.id), { user: { id: me.id, name: me.name, avatar: me.avatar }, helpType }],
      updatedAt: new Date().toISOString(),
    }));
  },

  /** "I see it too": a nearby user confirms the report is real. */
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
      // 3 flags from the community send a case back to moderation
      return { ...c, trust: { ...c.trust, flags }, moderation: flags >= 3 ? "pending" : c.moderation };
    });
  },

  moderate(caseId: string, decision: "approved" | "hidden") {
    updateCase(caseId, (c) => ({ ...c, moderation: decision }));
  },

  addReview(r: Review) {
    set({ reviews: [r, ...state.reviews] });
  },

  /** Reports created by a user in the last hour (rate limit). */
  recentReportsBy(userId: string) {
    const hourAgo = Date.now() - 3_600_000;
    return state.cases.filter((c) => c.reporter.id === userId && new Date(c.createdAt).getTime() > hourAgo).length;
  },

  /** New listings always start as "pending" until an admin approves them. */
  addAdoption(a: AdoptionProfile) {
    set({ adoptions: [{ ...a, status: "pending" }, ...state.adoptions] });
  },

  moderateAdoption(id: string, status: "approved" | "rejected") {
    set({ adoptions: state.adoptions.map((a) => (a.id === id ? { ...a, status } : a)) });
  },

  sendRequest(r: AdoptionRequest) {
    set({ requests: [r, ...state.requests.filter((x) => !(x.adoptionId === r.adoptionId && x.from.id === r.from.id))] });
  },

  /** Owner answers. Accepting shares both phone numbers; the others stay private. */
  answerRequest(id: string, status: "accepted" | "declined") {
    set({ requests: state.requests.map((r) => (r.id === id ? { ...r, status } : r)) });
  },

  clearLastCreated() {
    set({ lastCreatedId: null });
  },
};

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.get()),
    () => selector(store.get()),
  );
}

/** Cases visible to the public: moderation-pending and hidden reports stay out of the map. */
export const isPublic = (c: Case) => c.moderation !== "pending" && c.moderation !== "hidden";
