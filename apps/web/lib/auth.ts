"use client";

import { useSyncExternalStore } from "react";
import { DEMO_PASSWORD, USERS } from "./mock/data";
import type { Role, User } from "./types";

/* Mock auth for the demo. With the NestJS API this becomes:
   POST /auth/login → JWT (role inside), refresh token in an httpOnly cookie.
   Roles are enforced by the backend; the UI only hides what a role can't use.
   Admin accounts are never created from the sign-up form, only by seed/CLI. */

const SESSION_KEY = "pawlink.session";
const USERS_KEY = "pawlink.users";

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function registered(): User[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? "[]") as User[];
  } catch {
    return [];
  }
}

function allUsers() {
  return [...USERS, ...registered()];
}

let cachedId: string | null | undefined;
let cachedUser: User | null = null;

function readSession(): User | null {
  let id: string | null = null;
  try {
    id = localStorage.getItem(SESSION_KEY);
  } catch {}
  if (id !== cachedId) {
    cachedId = id;
    cachedUser = id ? (allUsers().find((u) => u.id === id) ?? null) : null;
  }
  return cachedUser;
}

function subscribe(l: () => void) {
  listeners.add(l);
  window.addEventListener("storage", l);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", l);
  };
}

/** Current user, or null when signed out. `undefined` during server render / hydration. */
export function useSession(): User | null | undefined {
  return useSyncExternalStore(subscribe, readSession, () => undefined);
}

export function signIn(email: string, password: string): User | "invalid" {
  const u = allUsers().find((x) => x.email?.toLowerCase() === email.trim().toLowerCase());
  if (!u || password !== DEMO_PASSWORD) return "invalid";
  localStorage.setItem(SESSION_KEY, u.id);
  emit();
  return u;
}

export function signUp(name: string, email: string, role: Exclude<Role, "admin">): User | "exists" {
  if (allUsers().some((x) => x.email?.toLowerCase() === email.trim().toLowerCase())) return "exists";
  const u: User = {
    id: `r${Date.now()}`,
    name: name.trim(),
    avatar: "",
    email: email.trim(),
    // vets stay "reporter" until their license is checked by an admin
    role: role === "vet" ? "reporter" : role,
    phoneVerified: true,
    licenseVerified: false,
    helpTypes: role === "volunteer" ? ["transport"] : undefined,
  };
  localStorage.setItem(USERS_KEY, JSON.stringify([...registered(), u]));
  localStorage.setItem(SESSION_KEY, u.id);
  emit();
  return u;
}

export function signOut() {
  localStorage.removeItem(SESSION_KEY);
  emit();
}

export function can(user: User | null | undefined, area: "report" | "help" | "dashboard" | "admin") {
  if (!user) return false;
  if (area === "admin") return user.role === "admin";
  return true;
}
