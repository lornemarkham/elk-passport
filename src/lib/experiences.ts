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
}

export const EXPERIENCES: readonly PassportExperience[] = [
  { href: "/conferences", label: "Conference", testId: "conference" },
  { href: "/hockey", label: "Hockey Night", testId: "hockey" },
  { href: "/october", label: "October", testId: "october" },
  { href: "/christmas", label: "Christmas", testId: "christmas" },
  { href: "/snow", label: "Snow Day", testId: "snow" },
  { href: "/snow/sesh-wars", label: "Sesh Wars", testId: "sesh-wars" },
  { href: "/datenight", label: "Date Night", testId: "date-night" },
  { href: "/badminton", label: "Badminton Game Night", testId: "badminton" },
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
  return EXPERIENCES.filter((e) => within(pathname, e.href)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
}
