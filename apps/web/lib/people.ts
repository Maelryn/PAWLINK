import type { User } from "./types";

export type Availability = NonNullable<User["availability"]>;

/** A helper's availability. Older accounts only have the on/off `available` flag: on = "now", off = "usually". */
export const availabilityOf = (u: Pick<User, "available" | "availability">): Availability => u.availability ?? (u.available ? "now" : "usually");
