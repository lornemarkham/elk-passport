/**
 * **The one list of Passport's Experiences.**
 *
 * The Experiences menu (`PassportNav`) is generated from this and from
 * nothing else, so shipping an Experience means adding one entry here — not
 * remembering to edit a component. Every entry is a real, built product with
 * a route that answers; there are no placeholders (a test checks each `href`
 * resolves to a page under `src/app`).
 *
 * Each Experience keeps its own access rules (`/hockey` asks a visitor to
 * sign in, `/conferences` asks for a code); these are links, not doors.
 *
 * Order is the order of the menu.
 */
export interface PassportExperience {
  readonly href: string;
  readonly label: string;
  /** Stable suffix for `data-testid="passport-experience-…"`. */
  readonly testId: string;
  /**
   * Other routes the same Experience lives under (Hockey Night's pages are
   * `/night/[id]`, Date Night has two prefixes), so its entry is lit there too.
   */
  readonly also?: readonly string[];
}

export const EXPERIENCES: readonly PassportExperience[] = [
  { href: "/christmas", label: "Christmas", testId: "christmas" },
  { href: "/hockey", label: "Hockey Night", testId: "hockey" },
  { href: "/snow", label: "Snow Day", testId: "snow" },
  { href: "/snow/sesh-wars", label: "Sesh Wars", testId: "sesh-wars" },
  {
    href: "/datenight",
    label: "Date Night",
    testId: "date-night",
    also: ["/date-night", "/night"],
  },
];

/**
 * **Where the rest live** (owner brief P1, 2026-11-17): the five above are the
 * strongest products and own the menu; everything else sits one step away in
 * Labs. Nothing was deleted and no URL moved — these are the same routes they
 * always were, only no longer listed in the bar.
 */
export const LABS_HREF = "/labs";

export type LabStatusLabel =
  | "Experimental"
  | "Coming Soon"
  | "In Development"
  | "Archived"
  | "Out of Season";

/**
 * **Seasonal Archive** (owner addendum, 2026-11-17): a seasonal experience is
 * never deleted when its season ends. It keeps its routes and content, stays
 * public, says "Out of Season", and waits here. Bringing it back is a code
 * change that moves the entry into `EXPERIENCES` — never a date check that
 * flips it on by itself — and `reactivation` is the list a person must have
 * confirmed first (a test refuses an entry with an empty list).
 */
export interface SeasonalInfo {
  /** When it is in season, in words ("Late September to early November"). */
  readonly season: string;
  /** What must be true before it goes back on the menu. */
  readonly reactivation: readonly string[];
}

export interface LabsExperience extends PassportExperience {
  readonly status: LabStatusLabel;
  readonly description: string;
  /** What is true about it today, in one honest sentence. */
  readonly statusNote: string;
  /** A real capture of the live page, under `public/`. */
  readonly preview: string;
  /** Present only on an experience that belongs to a season. */
  readonly seasonal?: SeasonalInfo;
}

/**
 * Statuses are verified against production on 2026-11-17 (see
 * `docs/release/GHAD-EXPERIENCES-AUDIT-2026-11-17.md`), not assumed:
 *
 * - **Conference** works, but is built around one event and a private code.
 * - **Badminton Game Night** (CourtQueue) is in real use by one club; the
 *   public demo works.
 * - **October** still runs on live data but is the first experiment, not the
 *   product we are building towards (doctrine §10).
 */
export const LAB_EXPERIENCES: readonly LabsExperience[] = [
  {
    href: "/labs/pulse",
    label: "People's Pulse",
    testId: "pulse",
    status: "Experimental",
    description:
      "What do people really think? Ask a question, share the link, and compare your circle with everyone — no account needed.",
    statusNote:
      "New. Voluntary responses, not a scientific poll: one vote per browser, places are self-reported, and small groups stay hidden.",
    preview: "/labs/previews/pulse.jpg",
  },
  {
    href: "/conferences",
    label: "Conference",
    testId: "conference",
    also: ["/boards/conference", "/labs/conference"],
    status: "Experimental",
    description:
      "One private place for a group at an event: who is coming, what is on, and what to do with the hours in between.",
    statusNote:
      "Works end to end with a conference code. Built around one event, so organising your own needs a Passport account.",
    preview: "/labs/previews/conference.jpg",
  },
  {
    href: "/october",
    label: "October",
    testId: "october",
    status: "Out of Season",
    description:
      "The original seasonal discovery experience: what is on tonight and this weekend near you, from Atlas.",
    statusNote:
      "Out of Season. Every page still works and runs on live data, so you can look around; it comes back with October.",
    preview: "/labs/previews/october.jpg",
    seasonal: {
      season: "October, running up to Halloween",
      reactivation: [
        "Dates: the season window and any dated copy name the coming year",
        "Content: Atlas events for the new October are present, and the Halloween-name rule in Discovery hygiene still matches",
        "Functionality: the October e2e specs pass against current Atlas data",
        "Owner has agreed to move it back into the Experiences menu",
      ],
    },
  },
  {
    href: "/badminton",
    label: "Badminton Game Night",
    testId: "badminton",
    status: "Experimental",
    description:
      "CourtQueue: tap play, put your phone down, and the club's queue calls you to court.",
    statusNote:
      "In real use by one club. Try the 25-player Test Game Night to see how a night works; nothing in it is real.",
    preview: "/labs/previews/badminton.jpg",
  },
];

const within = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

/**
 * The Experience a path belongs to — the most specific match, so
 * `/snow/sesh-wars` lights Sesh Wars and not Snow Day as well.
 */
export function currentExperience(
  pathname: string,
): PassportExperience | undefined {
  const matches = EXPERIENCES.flatMap((e) =>
    [e.href, ...(e.also ?? [])]
      .filter((href) => within(pathname, href))
      .map((href) => ({ e, length: href.length })),
  );
  return matches.sort((a, b) => b.length - a.length)[0]?.e;
}

/**
 * The Labs experience a path belongs to, if any — so the bar can light Labs
 * (and not Experiences) while someone is inside Conference, October or
 * Badminton.
 */
export function currentLabsExperience(
  pathname: string,
): LabsExperience | undefined {
  return LAB_EXPERIENCES.flatMap((e) =>
    [e.href, ...(e.also ?? [])]
      .filter((href) => within(pathname, href))
      .map((href) => ({ e, length: href.length })),
  ).sort((a, b) => b.length - a.length)[0]?.e;
}

/** Seasonal experiences whose season has ended: public, labelled, never removed. */
export const SEASONAL_ARCHIVE: readonly LabsExperience[] =
  LAB_EXPERIENCES.filter((e) => e.status === "Out of Season");

/** Labs experiences that are not in the Seasonal Archive. */
export const LABS_NOW: readonly LabsExperience[] = LAB_EXPERIENCES.filter(
  (e) => e.status !== "Out of Season",
);
