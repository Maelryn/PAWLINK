"use client";

import { DEMO_PASSWORD } from "./mock/data";
import { store, useStore } from "./store";
import type { Role, Service, ServiceType, User } from "./types";

/* Mock auth for the demo, on top of the client store. With the NestJS API this becomes:
   POST /auth/register → SMS code → POST /auth/verify-phone → JWT (role inside) + refresh cookie.
   Roles are enforced by the backend; the UI only hides what a role can't use.
   Admin accounts are never created from the sign-up form, only by seed/CLI. */

export type SignUpRole = "reporter" | "volunteer" | "vet" | "pro";

/** Current user, null when signed out, undefined until saved data is loaded (avoids redirect flashes). */
export function useSession(): User | null | undefined {
  return useStore((s) => (!s.hydrated ? undefined : (s.users.find((u) => u.id === s.sessionId) ?? null)));
}

export function signIn(email: string, password: string): User | "invalid" {
  const u = store.get().users.find((x) => x.email?.toLowerCase() === email.trim().toLowerCase());
  // demo: seeded accounts share DEMO_PASSWORD; accounts created here store their own (never do this for real)
  const ok = u && (password === DEMO_PASSWORD || password === (u as User & { pw?: string }).pw);
  if (!u || !ok) return "invalid";
  store.setSession(u.id);
  return u;
}

export function signUp(input: {
  name: string;
  email: string;
  password: string;
  phone: string;
  city: string;
  role: SignUpRole;
  business?: { name: string; type: ServiceType };
}): User | "exists" {
  const { users } = store.get();
  if (users.some((x) => x.email?.toLowerCase() === input.email.trim().toLowerCase())) return "exists";
  const id = `r${Date.now().toString(36)}`;
  const role: Role = input.role === "volunteer" ? "volunteer" : "reporter"; // vets/pros get their role after verification
  let serviceId: string | undefined;
  if (input.role === "vet" || input.role === "pro") {
    serviceId = `s${Date.now().toString(36)}`;
    const s: Service = {
      id: serviceId,
      type: input.role === "vet" ? "vet" : (input.business?.type ?? "store"),
      name: input.business?.name || input.name,
      location: { lat: 36.7538, lng: 3.0588, address: input.city },
      phone: input.phone,
      rating: 0,
      reviewCount: 0,
      ownerId: id,
    };
    store.addService(s);
  }
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
    helpTypes: input.role === "volunteer" ? (["transport"] as User["helpTypes"]) : undefined,
    serviceId,
    createdAt: new Date().toISOString(),
  } as User;
  store.addUser(u);
  store.setSession(id);
  return u;
}

export function signOut() {
  store.setSession(null);
}

export function can(user: User | null | undefined, area: "report" | "help" | "dashboard" | "admin") {
  if (!user) return false;
  if (area === "admin") return user.role === "admin";
  return true;
}
