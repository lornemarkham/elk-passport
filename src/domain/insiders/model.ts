/**
 * **The Local Insider Network, as data** (owner brief "P0: Local Insider
 * Network", 2026-11-09; ADR 018).
 *
 * Locals tell Go Have a Day about the things a directory never has: the dirt
 * bike race in the hills, the Thursday badminton night, the jam in the back
 * of a bar. A visitor or an ambassador submits one; a person checks it; once
 * it passes, it is published on Go Have a Day and its organizer's page is
 * queued for Atlas to read (Atlas stays the source of truth for what it
 * learns; this network is the queue in front of it).
 *
 * Pure: no Next, no database, no clock it does not take as an argument.
 *
 * ## The rule this file exists to keep
 *
 * **Nothing is said that nobody checked.** A date, a registration link or an
 * organizer is shown only when a person verified it against a source, and an
 * event is "upcoming" only when its verified date is still ahead. A past
 * event is shown as what it was, with the organizer's page, until a new date
 * is confirmed. See `publicView`.
 */

export const KINDS = ["event", "club", "experience", "community"] as const;
export type Kind = (typeof KINDS)[number];

export const KIND_LABEL: Record<Kind, string> = {
  event: "Event",
  club: "Club",
  experience: "Experience",
  community: "Community",
};

/**
 * Where a listing is in review.
 *
 * ```
 * submitted → published
 *           ↘ needs-info → submitted
 *           ↘ declined
 * published → withdrawn
 * ```
 */
export const STATUSES = [
  "submitted",
  "needs-info",
  "published",
  "declined",
  "withdrawn",
] as const;
export type Status = (typeof STATUSES)[number];

/** How sure anyone is that the listing is right, said apart from status. */
export const VERIFICATIONS = [
  "unverified",
  "organizer-confirmed",
  "source-checked",
  "community-reported",
] as const;
export type Verification = (typeof VERIFICATIONS)[number];

export const VERIFICATION_LABEL: Record<Verification, string> = {
  unverified: "Not yet checked",
  "organizer-confirmed": "Confirmed by the organizer",
  "source-checked": "Checked against the organizer's page",
  "community-reported": "Shared by a local",
};

export type Confidence = "high" | "medium" | "low";

/** Who sent it in. */
export type SubmitterRole = "visitor" | "ambassador" | "organizer" | "admin";

export interface Place {
  /** The venue or area, in words ("Coldstream Elementary School gym"). */
  readonly name?: string;
  readonly town: string;
  readonly latitude?: number;
  readonly longitude?: number;
}

/**
 * Dates, with their honesty attached. `verifiedAt` set means a person checked
 * `starts` against `source`; absent means somebody said it and nobody has
 * checked yet, so it is never shown as a fact.
 */
export interface Dates {
  /** ISO date or date-time, as stated. */
  readonly starts: string;
  readonly ends?: string;
  readonly source?: string;
  readonly verifiedAt?: string;
}

/** A link with the same rule as dates: shown only once someone checked it. */
export interface CheckedLink {
  readonly url: string;
  readonly verifiedAt?: string;
}

export interface Listing {
  readonly id: string;
  readonly kind: Kind;
  readonly title: string;
  readonly description: string;
  readonly place: Place;
  /** Lower-case interests ("dirt biking", "badminton"). */
  readonly interests: readonly string[];
  readonly organizer?: string;
  /** The organizer's own page, or a public community page. */
  readonly organizerUrl?: string;
  /** Where the information came from: a page, a poster, "told by the organizer". */
  readonly provenance: string;
  /** Upcoming (or the most recent) dates, when stated. */
  readonly dates?: Dates;
  /** A recurring rhythm in words ("Mondays 7–9 pm, October to April"). */
  readonly schedule?: string;
  /** Past editions, kept so a past event can still be shown as what it was. */
  readonly history?: readonly {
    readonly starts: string;
    readonly source?: string;
  }[];
  readonly registration?: CheckedLink;
  /** Members only, or by permission: never promoted without the organizer's ok. */
  readonly access: "public" | "members" | "ask-first";
  /** For `members` / `ask-first`: whether the organizer agreed to be listed. */
  readonly permission?: { readonly by: string; readonly at: string };
  readonly status: Status;
  readonly verification: Verification;
  readonly confidence: Confidence;
  readonly lastVerifiedAt?: string;
  readonly lastCheckedAt?: string;
  /** When Go Have a Day first heard of it: the start of discovery lead time. */
  readonly discoveredAt: string;
  readonly submittedBy: { readonly role: SubmitterRole; readonly who: string };
  /** What an AI read, said apart from what a person typed. */
  readonly extractedBy?: "rules" | "rules+ai";
  /** An Atlas entity that already holds this, when someone linked one. */
  readonly atlasEntityId?: string;
  /** What happened when the organizer's page was handed to Atlas. */
  readonly atlas?: AtlasHandoff;
  readonly notes: readonly Note[];
  readonly updatedAt: string;
}

export interface AtlasHandoff {
  readonly state:
    "queued" | "already-queued" | "not-configured" | "failed" | "no-url";
  readonly at: string;
  readonly candidateId?: string;
  readonly detail?: string;
}

/** Everything that happened to a listing, in order: the audit trail. */
export interface Note {
  readonly at: string;
  readonly by: string;
  readonly kind:
    | "submitted"
    | "published"
    | "declined"
    | "needs-info"
    | "withdrawn"
    | "edited"
    | "report"
    | "correction"
    | "claim"
    | "checked";
  readonly text?: string;
}

export interface Ambassador {
  /** Lower-case email: the Passport account they sign in with. */
  readonly email: string;
  readonly name: string;
  readonly area: string;
  /** Trusted ambassadors publish their own checked listings without waiting. */
  readonly trusted: boolean;
  readonly bio?: string;
  readonly invitedBy: string;
  readonly invitedAt: string;
  readonly active: boolean;
}

/** The whole network: small enough to be one versioned document. */
export interface Network {
  readonly listings: readonly Listing[];
  readonly ambassadors: readonly Ambassador[];
}

export const EMPTY_NETWORK: Network = { listings: [], ambassadors: [] };

// ---------------------------------------------------------------------------
// Interests

/**
 * **Words people use, grouped by the interest they mean.** The first word is
 * the interest's name; the rest are what a person might type or a poster
 * might say. Deliberately small and plain: Atlas's activities do the heavy
 * lifting in Discovery, this only connects a local listing to a sentence.
 */
export const INTERESTS: readonly (readonly string[])[] = [
  [
    "dirt biking",
    "dirt bike",
    "dirtbike",
    "motocross",
    "mx",
    "enduro",
    "hare scramble",
    "off-road",
    "offroad",
    "trail riding",
    "dirt-bike",
  ],
  ["motorcycles", "motorcycle", "motorbike", "riding club", "moto", "bikers"],
  ["badminton", "shuttlecock", "racquet", "drop-in badminton"],
  [
    "music",
    "jam",
    "jam session",
    "open mic",
    "open-mic",
    "concert",
    "drum circle",
    "drumming",
    "folk",
    "bluegrass",
    "live music",
    "choir",
    "song circle",
  ],
  [
    "hiking",
    "hike",
    "hikes",
    "trail",
    "trails",
    "walk",
    "walking",
    "outdoors club",
  ],
  ["outdoor adventure", "outdoors", "adventure", "outdoor"],
  [
    "roller skating",
    "roller skate",
    "roller-skating",
    "rollerskating",
    "roller derby",
    "skate night",
    "roller rink",
    "rollerblading",
  ],
  ["cycling", "mountain biking", "mtb", "bike ride", "cyclists"],
  ["paddling", "kayak", "canoe", "paddleboard", "sup"],
  ["running", "run club", "trail running", "runners"],
  ["dance", "dancing", "swing dance", "salsa"],
  ["board games", "games night", "board game", "tabletop"],
  ["art", "painting", "makers", "craft", "crafts"],
  ["food", "potluck", "farmers market", "market"],
];

/**
 * Broader interests a sentence may name, and the narrower ones they include.
 * "Outdoor adventure → hikes, group activities, local events" (the brief).
 */
const BROADER: Record<string, readonly string[]> = {
  "outdoor adventure": [
    "hiking",
    "dirt biking",
    "cycling",
    "paddling",
    "running",
  ],
  motorcycles: ["dirt biking"],
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function mentions(text: string, word: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escape(word)}($|[^a-z0-9])`, "i").test(
    text,
  );
}

/** The interests a piece of text mentions, by name, in table order. */
export function interestsIn(text: string): string[] {
  const lower = text.toLowerCase();
  return INTERESTS.filter((words) => words.some((w) => mentions(lower, w))).map(
    (words) => words[0]!,
  );
}

/** One interest, cleaned: lower case, trimmed, its table name when it has one. */
export function canonicalInterest(raw: string): string {
  const lower = raw.trim().toLowerCase().replace(/\s+/g, " ");
  const row = INTERESTS.find((words) => words.includes(lower));
  return row ? row[0]! : lower;
}

/**
 * Whether a listing answers what somebody said. A sentence that names an
 * interest matches listings with that interest (or a narrower one it
 * includes); a sentence that names none matches on the listing's own words.
 */
export function matchesSaid(
  listing: Pick<Listing, "title" | "description" | "organizer" | "interests">,
  said: readonly string[],
): boolean {
  const text = said.join(" ").toLowerCase().trim();
  if (!text) return true;
  const wanted = interestsIn(text);
  if (wanted.length > 0) {
    const include = new Set(wanted.flatMap((i) => [i, ...(BROADER[i] ?? [])]));
    return listing.interests.some((i) => include.has(i));
  }
  const words = text.split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  if (words.length === 0) return false;
  const hay = [
    listing.title,
    listing.description,
    listing.organizer ?? "",
    ...listing.interests,
  ]
    .join(" ")
    .toLowerCase();
  return words.some((w) => hay.includes(w));
}

// ---------------------------------------------------------------------------
// Duplicates

const STOP = new Set([
  "the",
  "a",
  "an",
  "of",
  "and",
  "club",
  "society",
  "association",
  "vernon",
  "bc",
]);

/** A name reduced to what distinguishes it. */
export function nameKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .join(" ");
}

/** A URL reduced to host and path, so `https://www.x.ca/a/` equals `http://x.ca/a`. */
export function urlKey(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return undefined;
  }
}

/**
 * **The listings that are probably the same thing**, so a second submission
 * of The Squealing Pig joins the first instead of becoming a second card.
 * Same organizer page, or the same distinguishing name in the same town.
 * Declined and withdrawn listings do not count: a fresh, better submission
 * of a declined one is allowed.
 */
export function duplicatesOf(
  candidate: Pick<Listing, "title" | "organizerUrl" | "place"> & {
    id?: string;
  },
  listings: readonly Listing[],
): Listing[] {
  const name = nameKey(candidate.title);
  const url = urlKey(candidate.organizerUrl);
  const town = candidate.place.town.trim().toLowerCase();
  return listings.filter((l) => {
    if (l.id === candidate.id) return false;
    if (l.status === "declined" || l.status === "withdrawn") return false;
    if (url && urlKey(l.organizerUrl) === url) return true;
    return (
      name.length > 0 &&
      nameKey(l.title) === name &&
      l.place.town.trim().toLowerCase() === town
    );
  });
}

// ---------------------------------------------------------------------------
// Review

/**
 * **What still has to be true before a listing may be published.** Each
 * line is said to the reviewer in words. The brief's list: location,
 * category and interests, provenance, verification of dates and registration
 * details, and permission for anything private.
 */
export function blockers(listing: Listing): string[] {
  const out: string[] = [];
  if (!listing.title.trim()) out.push("It needs a name.");
  if (!listing.place.town.trim()) out.push("It needs a town or place.");
  if (listing.interests.length === 0)
    out.push("It needs at least one interest.");
  if (!listing.provenance.trim()) out.push("Say where this came from.");
  if (!listing.organizerUrl && !listing.dates?.source)
    out.push("It needs a link to the organizer or a public page about it.");
  if (listing.dates && !listing.dates.verifiedAt)
    out.push("Check the date against a source, or remove it.");
  if (listing.dates?.verifiedAt && !listing.dates.source)
    out.push("A checked date needs the page it was checked on.");
  if (listing.registration && !listing.registration.verifiedAt)
    out.push("Check the registration link, or remove it.");
  if (listing.access !== "public" && !listing.permission)
    out.push(
      "This is members-only or private: record the organizer's permission first.",
    );
  return out;
}

/** Whether a person in this role may publish without someone else's review. */
export function publishesDirectly(
  role: SubmitterRole,
  ambassador: Ambassador | undefined,
): boolean {
  return role === "admin" || (role === "ambassador" && !!ambassador?.trusted);
}

// ---------------------------------------------------------------------------
// Time

const DAY = 86_400_000;

function dayOf(iso: string): number {
  return Date.parse(iso.length === 10 ? `${iso}T12:00:00-07:00` : iso);
}

/**
 * **Discovery lead time:** how many days before it started Go Have a Day
 * first heard of it. Only for a verified date; negative means we heard after
 * it began, which is the failure the brief names.
 */
export function leadTimeDays(listing: Listing): number | undefined {
  if (!listing.dates?.verifiedAt) return undefined;
  const starts = dayOf(listing.dates.starts);
  const found = Date.parse(listing.discoveredAt);
  if (Number.isNaN(starts) || Number.isNaN(found)) return undefined;
  return Math.floor((starts - found) / DAY);
}

export type When =
  | {
      readonly state: "upcoming";
      readonly starts: string;
      readonly ends?: string;
      readonly source?: string;
    }
  | { readonly state: "ongoing"; readonly schedule: string }
  | { readonly state: "past"; readonly last: string; readonly source?: string }
  | { readonly state: "unconfirmed" };

/**
 * **What may be said about when.** Upcoming only with a checked date still
 * ahead; a recurring rhythm as the rhythm; a past edition as past; otherwise
 * nothing beyond "dates not confirmed yet".
 */
export function whenOf(listing: Listing, now: Date): When {
  const d = listing.dates;
  const endOf = (iso: string) =>
    dayOf(iso) + (iso.length === 10 ? 12 * 3_600_000 : 0);
  if (d?.verifiedAt) {
    const end = endOf(d.ends ?? d.starts);
    if (end >= now.getTime())
      return {
        state: "upcoming",
        starts: d.starts,
        ...(d.ends ? { ends: d.ends } : {}),
        ...(d.source ? { source: d.source } : {}),
      };
  }
  if (listing.schedule) return { state: "ongoing", schedule: listing.schedule };
  const past = [
    ...(d?.verifiedAt ? [{ starts: d.starts, source: d.source }] : []),
    ...(listing.history ?? []),
  ]
    .filter((h) => endOf(h.starts) < now.getTime())
    .sort((a, b) => dayOf(b.starts) - dayOf(a.starts))[0];
  if (past)
    return {
      state: "past",
      last: past.starts,
      ...(past.source ? { source: past.source } : {}),
    };
  return { state: "unconfirmed" };
}

// ---------------------------------------------------------------------------
// What the public sees

/**
 * A published listing as Go Have a Day shows it. Who submitted it, the notes
 * and the Atlas handoff stay behind; an unchecked link is dropped.
 */
export interface PublicListing {
  readonly id: string;
  readonly kind: Kind;
  readonly title: string;
  readonly description: string;
  readonly place: Place;
  readonly interests: readonly string[];
  readonly organizer?: string;
  readonly organizerUrl?: string;
  readonly registrationUrl?: string;
  readonly when: When;
  readonly access: Listing["access"];
  readonly verification: Verification;
  readonly lastVerifiedAt?: string;
  readonly provenance: string;
  readonly atlasEntityId?: string;
}

export function publicView(listing: Listing, now: Date): PublicListing {
  return {
    id: listing.id,
    kind: listing.kind,
    title: listing.title,
    description: listing.description,
    place: listing.place,
    interests: listing.interests,
    ...(listing.organizer ? { organizer: listing.organizer } : {}),
    ...(listing.organizerUrl ? { organizerUrl: listing.organizerUrl } : {}),
    ...(listing.registration?.verifiedAt
      ? { registrationUrl: listing.registration.url }
      : {}),
    when: whenOf(listing, now),
    access: listing.access,
    verification: listing.verification,
    ...(listing.lastVerifiedAt
      ? { lastVerifiedAt: listing.lastVerifiedAt }
      : {}),
    provenance: listing.provenance,
    ...(listing.atlasEntityId ? { atlasEntityId: listing.atlasEntityId } : {}),
  };
}

/**
 * Published listings, soonest first: upcoming by date, then ongoing, then
 * the rest. Listings Atlas already holds are still shown here — the card
 * links to Atlas's page — so nothing disappears while Atlas catches up.
 */
export function published(network: Network, now: Date): PublicListing[] {
  const rank = (w: When) =>
    w.state === "upcoming"
      ? 0
      : w.state === "ongoing"
        ? 1
        : w.state === "past"
          ? 2
          : 3;
  return network.listings
    .filter((l) => l.status === "published")
    .map((l) => publicView(l, now))
    .sort((a, b) => {
      const r = rank(a.when) - rank(b.when);
      if (r !== 0) return r;
      if (a.when.state === "upcoming" && b.when.state === "upcoming")
        return dayOf(a.when.starts) - dayOf(b.when.starts);
      return a.title.localeCompare(b.title);
    });
}

/** The ambassador's own record, for the profile page. */
export function contributionsOf(network: Network, email: string) {
  const mine = network.listings.filter(
    (l) => l.submittedBy.who.toLowerCase() === email.toLowerCase(),
  );
  const leads = mine
    .map(leadTimeDays)
    .filter((d): d is number => d !== undefined);
  return {
    listings: mine,
    published: mine.filter((l) => l.status === "published").length,
    waiting: mine.filter(
      (l) => l.status === "submitted" || l.status === "needs-info",
    ).length,
    /** Median days of warning their checked events gave. */
    medianLeadDays: leads.length
      ? [...leads].sort((a, b) => a - b)[Math.floor(leads.length / 2)]
      : undefined,
  };
}

/** The network-wide lead-time picture: the brief's success metric. */
export function leadTimeReport(network: Network) {
  return network.listings
    .filter((l) => l.kind === "event" && l.status === "published")
    .map((l) => ({
      id: l.id,
      title: l.title,
      starts: l.dates?.starts,
      days: leadTimeDays(l),
    }))
    .filter((r) => r.days !== undefined);
}

/**
 * **What to check next, so the next race isn't found after race weekend.**
 * Published events and clubs with no checked date ahead of them, least
 * recently checked first, each with the page to look at. Atlas's queue
 * reads the same pages on its own schedule; this is the human half.
 */
export function watchList(network: Network, now: Date) {
  return network.listings
    .filter(
      (l) =>
        l.status === "published" && (l.kind === "event" || l.kind === "club"),
    )
    .filter((l) => whenOf(l, now).state !== "upcoming")
    .filter((l) => l.organizerUrl)
    .map((l) => ({
      id: l.id,
      title: l.title,
      url: l.organizerUrl!,
      lastCheckedAt: l.lastCheckedAt ?? l.discoveredAt,
      daysSinceChecked: Math.floor(
        (now.getTime() - Date.parse(l.lastCheckedAt ?? l.discoveredAt)) / DAY,
      ),
    }))
    .sort((a, b) => a.lastCheckedAt.localeCompare(b.lastCheckedAt));
}
