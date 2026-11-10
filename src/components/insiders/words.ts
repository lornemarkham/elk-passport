import {
  KIND_LABEL,
  VERIFICATION_LABEL,
  type PublicListing,
  type When,
} from "@/domain/insiders/model";

/** How a listing's "when" is said. Never more than was checked. */
export function whenLine(when: When): string {
  const day = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "America/Vancouver",
    }).format(new Date(iso.length === 10 ? `${iso}T12:00:00-07:00` : iso));
  switch (when.state) {
    case "upcoming":
      return when.ends && when.ends !== when.starts
        ? `${day(when.starts)} – ${day(when.ends)}`
        : day(when.starts);
    case "ongoing":
      return when.schedule;
    case "past":
      return `Last held ${day(when.last)} · next date not announced yet`;
    case "unconfirmed":
      return "Dates not confirmed yet";
  }
}

export const kindLabel = (l: PublicListing) => KIND_LABEL[l.kind];
export const verificationLabel = (l: PublicListing) =>
  VERIFICATION_LABEL[l.verification];

export function checkedLine(l: PublicListing): string {
  const v = verificationLabel(l);
  if (!l.lastVerifiedAt) return v;
  const d = new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Vancouver",
  }).format(new Date(l.lastVerifiedAt));
  return `${v} · ${d}`;
}

/**
 * Where the card sends people: registration when checked, else the page we
 * have. Named by its site, not as "the organizer's page": a series results
 * page or a public Facebook page is not the organizer's own site.
 */
export function outLink(
  l: PublicListing,
): { href: string; label: string } | undefined {
  if (l.registrationUrl) return { href: l.registrationUrl, label: "Register" };
  if (!l.organizerUrl) return undefined;
  let host = "";
  try {
    host = new URL(l.organizerUrl).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
  return { href: l.organizerUrl, label: `See it on ${host}` };
}
