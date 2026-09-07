/**
 * List of the 25 official Qatar Virtual fleet airframe registrations.
 */
export const FLEET_REGISTRATIONS = [
  // A321
  "A7ADS",
  // A333
  "A7AED",
  "A7AEE",
  // A359
  "A7-ALR",
  "A7-DAC",
  "A7DAA",
  "A7DAB",
  // A35K
  "A7-ANG",
  "A7-ANN",
  "A7-AOB",
  // A388
  "A7-APC",
  "A7APD",
  // B77W
  "A7-BAE",
  "A7BAB",
  "A7BAF",
  "A7BAG",
  "IF-CHTA",
  // B77L
  "A7BBA",
  "A7BFA",
  "A7BFC",
  "IF-PMXB",
  // B788
  "A7-BCA",
  "A7BCB",
  "A7BCC",
  "IF-JVLK",
];

const normalizedFleetSet = new Set(
  FLEET_REGISTRATIONS.map((r) => r.replace(/[^A-Za-z0-9]/g, "").toUpperCase()),
);

/**
 * Normalizes an aircraft registration string (removes hyphens, spaces, uppercase).
 */
export function normalizeRegistration(reg: string | null | undefined): string {
  if (!reg) return "";
  return reg.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/**
 * Returns true if the given registration belongs to the official 25 Fleet airframes.
 */
export function isFleetAircraft(registration: string | null | undefined): boolean {
  if (!registration) return false;
  return normalizedFleetSet.has(normalizeRegistration(registration));
}
