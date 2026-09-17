import type { PlaceTemporal } from "@/lib/data/types";

/**
 * "as of Sep 8, 2026" — the date Atlas observed a time-bound value it has
 * decided is still current (Atlas ADR 072). Passport does not decide
 * currency: a value Atlas withheld never reaches `place`, and a value it
 * kept is shown with the date it was read, so a traveler knows how old
 * hours or a fee statement are. Empty when Atlas gave no date.
 */
export function asOfCaption(
  temporal: PlaceTemporal | undefined,
  field: string,
): string {
  const iso = temporal?.asOf?.[field];
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `as of ${d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Vancouver" })}`;
}
