"use client";

import { ApiError, apiOn, refreshAccessToken, setAccessToken } from "./api/client";
import { auth as authApi, me as meApi, type MePatch, type OtpSent } from "./api/endpoints";
import { DEMO_PASSWORD } from "./mock/data";
import { store, useStore } from "./store";
import { syncNotifications, syncAdoptions, syncServices } from "./sync";
import type { Role, Service, ServiceType, User } from "./types";

/* Accounts. Two modes, same screens:
   - real API (NEXT_PUBLIC_API_FEATURES contains "auth"): POST /auth/register → SMS code →
     /auth/verify-phone → access token (memory) + refresh cookie; /auth/login; /me.
   - demo: accounts live in the browser database (lib/store.ts), password pawlink2026.
   Roles are enforced by the backend; the UI only hides what a role can't use.
   Admin accounts are never created from the sign-up form, only by seed/CLI. */

export type SignUpRole = "reporter" | "volunteer" | "vet" | "pro";

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
  phone: string;
  city: string;
  role: SignUpRole;
  business?: { name: string; type: ServiceType };
}

/** Result of an auth call: the user, or a stable error code the UI turns into a message. */
export type AuthResult = { user: User } | { error: string; message?: string };

const realAuth = () => apiOn("auth");

/** Current user, null when signed out, undefined until we know (avoids redirect flashes). */
export function useSession(): User | null | undefined {
  return useStore((s) => (!s.hydrated || !s.authChecked ? undefined : (s.users.find((u) => u.id === s.sessionId) ?? null)));
}

/** App start: load the saved data and, with the real API, restore the session from the refresh cookie. */
export async function startAuth() {
  store.hydrate({ realAuth: realAuth() });
  if (!realAuth()) return;
  try {
    if (await refreshAccessToken()) {
      const u = await meApi.get();
      store.upsertUser(u, true);
      await Promise.all([syncNotifications(u.id), syncAdoptions(), syncServices()]);
    } else store.setSession(null);
  } catch {
    store.setSession(null);
  } finally {
    store.setAuthChecked();
  }
}

const fail = (e: unknown): AuthResult =>
  e instanceof ApiError ? { error: e.code, message: e.message } : { error: "UNKNOWN" };

export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (realAuth()) {
    try {
      const s = await authApi.login(email.trim(), password);
      setAccessToken(s.accessToken);
      store.upsertUser(s.user, true);
      return { user: s.user };
    } catch (e) {
      return fail(e);
    }
  }
  const u = store.get().users.find((x) => x.email?.toLowerCase() === email.trim().toLowerCase());
  // demo: seeded accounts share DEMO_PASSWORD; accounts created here store their own (never do this for real)
  const ok = u && (password === DEMO_PASSWORD || password === (u as User & { pw?: string }).pw);
  if (!u || !ok) return { error: "AUTH_INVALID_CREDENTIALS" };
  store.setSession(u.id);
  return { user: u };
}

/** Step 1 of sign-up: creates the account and sends the SMS code. Demo mode skips the SMS. */
export async function startSignUp(input: SignUpInput): Promise<{ sent: OtpSent } | { error: string; message?: string }> {
  if (!realAuth()) {
    const exists = store.get().users.some((x) => x.email?.toLowerCase() === input.email.trim().toLowerCase());
    return exists ? { error: "AUTH_EMAIL_TAKEN" } : { sent: { phone: input.phone, expiresAt: "" } };
  }
  try {
    // businesses sign up as reporters; their listing is created with the services API (backend Phase 3)
    const role = input.role === "pro" ? "reporter" : input.role;
    const sent = await authApi.register({
      name: input.name.trim(),
      email: input.email.trim(),
      password: input.password,
      phone: input.phone.trim(),
      city: input.city.trim() || undefined,
      role,
      helpTypes: input.role === "volunteer" ? ["transport"] : undefined,
    });
    return { sent };
  } catch (e) {
    return fail(e) as { error: string; message?: string };
  }
}

/** Step 2 of sign-up: checks the SMS code and opens the session. */
export async function finishSignUp(input: SignUpInput, code: string): Promise<AuthResult> {
  if (!realAuth()) return { user: demoSignUp(input) };
  try {
    const s = await authApi.verifyPhone({ code, phone: input.phone.trim() });
    setAccessToken(s.accessToken);
    store.upsertUser(s.user, true);
    if (input.role === "pro" || input.role === "vet") createLocalListing(s.user, input);
    return { user: s.user };
  } catch (e) {
    return fail(e);
  }
}

export async function resendCode(phone: string) {
  if (!realAuth()) return { sent: { phone, expiresAt: "" } as OtpSent };
  try {
    return { sent: await authApi.resendCode(phone.trim()) };
  } catch (e) {
    return fail(e) as { error: string; message?: string };
  }
}

export async function signOut() {
  store.setSession(null);
  if (realAuth()) {
    setAccessToken(null);
    await authApi.logout().catch(() => {});
  }
}

/** Profile save (PATCH /me). */
export async function saveProfile(id: string, patch: MePatch): Promise<AuthResult> {
  if (!realAuth()) {
    store.updateUser(id, patch);
    return { user: { ...store.get().users.find((u) => u.id === id)!, ...patch } };
  }
  try {
    const u = await meApi.update(patch);
    store.upsertUser(u);
    return { user: u };
  } catch (e) {
    return fail(e);
  }
}

/** Account deletion (DELETE /me). */
export async function deleteMyAccount(id: string): Promise<boolean> {
  if (realAuth()) {
    try {
      await meApi.remove();
      setAccessToken(null);
    } catch {
      return false;
    }
  }
  store.deleteAccount(id);
  return true;
}

export function can(user: User | null | undefined, area: "report" | "help" | "dashboard" | "admin") {
  if (!user) return false;
  if (area === "admin") return user.role === "admin";
  return true;
}

/* ─────────────── demo mode helpers ─────────────── */

/** Business listing. Real API: POST /services (backend Phase 3); until then it stays in this browser. */
function createLocalListing(owner: User, input: SignUpInput): string {
  const serviceId = `s${Date.now().toString(36)}`;
  const s: Service = {
    id: serviceId,
    type: input.role === "vet" ? "vet" : (input.business?.type ?? "store"),
    name: input.business?.name || input.name,
    location: { lat: 36.7538, lng: 3.0588, address: input.city },
    phone: input.phone,
    rating: 0,
    reviewCount: 0,
    ownerId: owner.id,
  };
  store.addService(s);
  store.updateUser(owner.id, { serviceId });
  return serviceId;
}

function demoSignUp(input: SignUpInput): User {
  const id = `r${Date.now().toString(36)}`;
  const role: Role = input.role === "volunteer" ? "volunteer" : "reporter"; // vets/pros get their role after verification
  const u = {
    id,
    name: input.name.trim(),
    avatar: "",
    email: input.email.trim(),
    pw: input.password,
    role,
    phone: input.phone,
    city: input.city,
    phoneVerified: true,
    licenseVerified: false,
    available: input.role === "volunteer",
    availability: input.role === "volunteer" ? "now" : undefined,
    helpTypes: input.role === "volunteer" ? (["transport"] as User["helpTypes"]) : undefined,
    createdAt: new Date().toISOString(),
  } as User;
  store.addUser(u);
  store.setSession(id);
  if (input.role === "vet" || input.role === "pro") createLocalListing(u, input);
  return { ...u, serviceId: store.get().users.find((x) => x.id === id)?.serviceId };
}
