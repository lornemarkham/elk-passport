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
  "Experimental" | "Coming Soon" | "In Development" | "Archived";

export interface LabsExperience extends PassportExperience {
  readonly status: LabStatusLabel;
  readonly description: string;
  /** What is true about it today, in one honest sentence. */
  readonly statusNote: string;
  /** A real capture of the live page, under `public/`. */
  readonly preview: string;
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
    status: "Archived",
    description:
      "The original seasonal discovery experience: what is on tonight and this weekend near you, from Atlas.",
    statusNote:
      "Still runs on live data, but it is the first experiment and no longer where we are headed.",
    preview: "/labs/previews/october.jpg",
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
