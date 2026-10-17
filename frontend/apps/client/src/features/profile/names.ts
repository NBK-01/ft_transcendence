import type { Profile } from "./types";

/**
 * First and last name. The real backend only stores the full `name` today, so
 * until it adds firstName/lastName we split on the first space as a starting
 * guess ("Amina El Idrissi" → "Amina" / "El Idrissi"), which the user can fix
 * in the edit form.
 */
export function namesOf(profile: Profile) {
  if (profile.firstName || profile.lastName) {
    return { firstName: profile.firstName ?? "", lastName: profile.lastName ?? "" };
  }
  const [firstName = "", ...rest] = profile.name.trim().split(/\s+/);
  return { firstName, lastName: rest.join(" ") };
}

/** "1998-04-12" → a local date (not UTC, which can shift the day). */
export function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}
