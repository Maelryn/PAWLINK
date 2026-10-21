export type Role = "reporter" | "volunteer" | "vet" | "admin";
export type Triage = "urgent" | "monitoring" | "stable";
export type Species =
  | "dog"
  | "cat"
  | "bird"
  | "horse"
  | "cow"
  | "sheep"
  | "goat"
  | "camel"
  | "donkey"
  | "rabbit"
  | "chicken"
  | "other";
export type HelpType = "transport" | "foster" | "food" | "medical" | "search" | "boarding" | "funds";
export type ServiceType = "vet" | "shelter" | "transport" | "boarding" | "training" | "store";
export type CaseStatus = "open" | "in_progress" | "resolved";

export interface GeoPoint {
  lat: number;
  lng: number;
  address?: string;
}

export interface UserLite {
  id: string;
  name: string;
  avatar: string;
}

export interface User extends UserLite {
  role: Role;
  email?: string;
  /** Phone confirmed by SMS code. Unverified accounts get lower trust and stricter limits. */
  phoneVerified?: boolean;
  /** Vets are checked against their professional license before getting the vet role. */
  licenseVerified?: boolean;
  helpTypes?: HelpType[];
  location?: GeoPoint;
  rating?: number;
  phone?: string;
  city?: string;
  bio?: string;
  /** Profile photo (data URL until Cloudinary is plugged in). */
  photo?: string;
  available?: boolean;
  /** Business account: the service listing it manages. */
  serviceId?: string;
  /** PawLink Pro subscription (income). `plan` is `pro` or the `pro+` tier. */
  pro?: { plan: "pro" | "plus"; since: string; until: string };
  createdAt?: string;
}

export type TrustLevel = "verified" | "unverified" | "suspicious";
export type TrustCheckId = "account" | "inAlgeria" | "photoGps" | "photoFresh" | "onSite" | "animalDetected" | "duplicate" | "rateLimit";

export interface TrustCheck {
  id: TrustCheckId;
  /** true = passed, false = failed, null = not enough data (e.g. photo without GPS) */
  ok: boolean | null;
  detail?: string;
}

export interface Trust {
  level: TrustLevel;
  score: number;
  checks: TrustCheck[];
  confirmations: number;
  flags: number;
  /** People who answered "do you see this animal?" while standing near it (one answer each). */
  confirmedBy?: string[];
  deniedBy?: string[];
  /** One "report as fake" per person. */
  flaggedBy?: string[];
}

export interface AIAnalysis {
  triage: Triage;
  confidence: number;
  summary: string;
  observedSigns: string[];
  safetyAdvice: string[];
  possiblyContagious: boolean;
  contagionAdvice?: string[];
  recommendedHelp: HelpType[];
  suggestedServices: { serviceId: string; type: ServiceType; name: string; distanceKm: number }[];
  suggestedHelpers?: { userId: string; name: string; helpType: HelpType; distanceKm: number }[];
  forcedUrgentByRule: boolean;
  disclaimer: string;
  model: string;
}

export interface Case {
  id: string;
  title: string;
  species: Species;
  category: "companion" | "livestock";
  count?: number;
  status: CaseStatus;
  triage: Triage;
  location: GeoPoint;
  photos: string[];
  description: string;
  conditionTags: string[];
  reporter: UserLite;
  ai?: AIAnalysis;
  emergencyZoneId?: string;
  /** The reporter says they can stay near the animal (or reported it remotely). */
  reporterOnSite?: boolean;
  trust?: Trust;
  /** Low-trust reports wait for a moderator before appearing publicly. */
  moderation?: "pending" | "approved" | "hidden";
  helpers: { user: UserLite; helpType: HelpType }[];
  createdAt: string;
  updatedAt: string;
  /** The reporter's proposed changes: public only once a moderator approves them. */
  pendingEdit?: CaseEdit;
}

/** What the reporter may change on their own report (the second review). */
export type CaseEdit = { description?: string; conditionTags?: string[]; at: string };

export interface EmergencyZone {
  id: string;
  name: string;
  region: string;
  type: "wildfire" | "flood" | "earthquake" | "other";
  polygon: GeoJSON.Polygon;
  center: GeoPoint;
  active: boolean;
  startedAt: string;
  stats: { cases: number; urgent: number; helpers: number };
}

export interface Service {
  id: string;
  type: ServiceType;
  name: string;
  location: GeoPoint;
  phone?: string;
  openNow?: boolean;
  rating: number;
  reviewCount: number;
  photo?: string;
  tags?: string[];
  description?: string;
  hours?: string;
  ownerId?: string;
  /** Checked by an admin (license / registration). */
  verified?: boolean;
  /** Pro subscribers: featured first + online appointments. */
  pro?: boolean;
  status?: "pending" | "approved" | "rejected";
  /** The owner's proposed changes: public only once a moderator approves them. */
  pendingEdit?: ServiceEdit;
}

/** What the owner may change on their business listing (the second review). */
export type ServiceEdit = Partial<
  Pick<Service, "name" | "phone" | "description" | "hours" | "location">
> & { at: string };

export interface Booking {
  id: string;
  serviceId: string;
  from: UserLite;
  date: string;
  time: string;
  animal: string;
  reason: string;
  status: "sent" | "confirmed" | "declined";
  createdAt: string;
}

export type NotificationKind =
  | "adoptRequest"
  | "adoptAccepted"
  | "adoptDeclined"
  | "listingApproved"
  | "listingRejected"
  | "booking"
  | "bookingConfirmed"
  | "bookingDeclined"
  | "help"
  | "review"
  | "serviceApproved"
  | "proActive"
  /** "do you see this animal?" — sent to the people within 3 km of a new report. */
  | "confirmAsk"
  /** somebody standing next to the animal confirmed the report. */
  | "caseConfirmed"
  /** a moderator approved the change the owner proposed on a live listing. */
  | "editApproved"
  /** a moderator refused those changes. */
  | "editRejected";

export interface AppNotification {
  id: string;
  userId: string;
  kind: NotificationKind;
  /** Name of the person / animal / place mentioned in the message. */
  subject: string;
  href: string;
  read: boolean;
  createdAt: string;
}

export interface Review {
  id: string;
  serviceId: string;
  author: UserLite;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  createdAt: string;
  /** Answer from the business (Pro feature). */
  reply?: string;
}

export interface AdoptionProfile {
  id: string;
  name: string;
  species: Species;
  breed?: string;
  sex: "male" | "female";
  ageMonths: number;
  photos: string[];
  healthStatus: string;
  vaccinations: { name: string; date: string }[];
  medicalHistory: { date: string; note: string }[];
  behavior: string[];
  careNeeds: string[];
  story: string;
  /** Who posted it (a shelter account or a person). Their phone is only shared once they accept a request. */
  shelter: { id: string; name: string };
  ownerId: string;
  ownerPhone?: string;
  location: GeoPoint;
  /** Every listing is reviewed by an admin before it's public. */
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  /** The owner's proposed changes: public only once a moderator approves them. */
  pendingEdit?: AdoptionEdit;
}

/** What the owner may change on their listing (the second review). */
export type AdoptionEdit = Partial<
  Omit<AdoptionProfile, "id" | "status" | "ownerId" | "shelter" | "createdAt" | "pendingEdit">
> & { at: string };

/**
 * One row of the moderation queue for the second review (`GET /admin/pending-edits`).
 *
 * The three kinds share one shape on purpose: the admin screen shows them in
 * one list, and one decision endpoint per kind keeps the "who may decide" rule
 * in one place per module.
 */
export interface PendingEdit {
  kind: "case" | "adoption" | "service";
  id: string;
  /** The title of the thing that was edited (case title, animal name, listing name). */
  title: string;
  ownerId: string;
  ownerName: string;
  /** When the owner proposed the change. */
  at: string;
  /** The proposed change itself. */
  edit: CaseEdit | ServiceEdit | AdoptionEdit;
}

export interface AdoptionRequest {
  id: string;
  adoptionId: string;
  from: UserLite;
  message: string;
  housing: "apartment" | "house" | "farm";
  experience: boolean;
  status: "sent" | "accepted" | "declined";
  createdAt: string;
}
