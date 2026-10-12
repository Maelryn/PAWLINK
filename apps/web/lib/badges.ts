import type { AdoptionProfile, Case, User } from "./types";

export type BadgeId = "vet" | "hero" | "helper" | "reporter" | "phone";

/** What someone did on PawLink, from public data only. */
export function activityOf(userId: string, cases: Case[], adoptions: AdoptionProfile[]) {
  const reported = cases.filter((c) => c.reporter.id === userId && c.moderation !== "hidden" && c.moderation !== "pending");
  const helped = cases.filter((c) => c.helpers.some((h) => h.user.id === userId));
  const rehomed = adoptions.filter((a) => a.ownerId === userId && a.status === "adopted").length;
  return { reported, helped, rehomed };
}

/** Trust badges: earned by what people did, never bought. */
export function badgesOf(u: User, cases: Case[], adoptions: AdoptionProfile[]): BadgeId[] {
  const { reported, helped } = activityOf(u.id, cases, adoptions);
  const out: BadgeId[] = [];
  if (u.role === "vet" && u.licenseVerified) out.push("vet");
  if (helped.length >= 10) out.push("hero");
  else if (helped.length >= 3) out.push("helper");
  if (reported.filter((c) => c.trust?.level === "verified").length >= 3) out.push("reporter");
  if (u.phoneVerified) out.push("phone");
  return out;
}
