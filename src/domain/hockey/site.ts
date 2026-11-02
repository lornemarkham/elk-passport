/**
 * **Where the hockey site lives, in one place.**
 *
 * The public hockey pages are `/hockey` on Go Have a Day today and are meant
 * to have their own domain one day. Everything that would change on that day
 * is here: the path every link is built from, the absolute origin canonical
 * URLs and structured data are written against, the site's name, and the
 * team it features. Pages and components call `hockeyPath()` rather than
 * writing "/hockey/…", so the move is a change to this file and a rewrite,
 * not a search-and-replace across the app.
 *
 * `HOCKEY_SITE_ORIGIN` may override the origin per deployment; nothing reads
 * it in the browser.
 */
export const HOCKEY_SITE = {
  name: "Hockey Night",
  by: "Go Have a Day",
  /** The path the site is mounted at. "" once it has its own domain. */
  base: "/hockey",
  origin: process.env.HOCKEY_SITE_ORIGIN ?? "https://gohaveaday.com",
  /**
   * The editorial preference: the club the home page leads with when it
   * plays, and spotlights when it doesn't. Every other club keeps the same
   * scoreboard, table and page.
   */
  featuredTeam: "CGY",
} as const;

/** "/hockey/teams/calgary-flames" — every public hockey link is built here. */
export function hockeyPath(path = ""): string {
  const p =
    path && !path.startsWith("/") && !path.startsWith("?") ? `/${path}` : path;
  return `${HOCKEY_SITE.base}${p}` || "/";
}

/** The same, absolute: canonical links, sitemaps, structured data. */
export function hockeyUrl(path = ""): string {
  return `${HOCKEY_SITE.origin}${hockeyPath(path)}`;
}

/** Where a click on "Create a Hockey Night" goes, with the game when there is one. */
export function createNightPath(from: string, gameId?: number): string {
  const q = new URLSearchParams();
  if (gameId) q.set("game", String(gameId));
  q.set("via", from);
  return hockeyPath(`/my-nights?${q}`);
}

/** The words under every page that shows league data. */
export const ATTRIBUTION =
  "Scores, schedules, standings and statistics are the NHL's, read from its public data and shown as published. Hockey Night is not affiliated with or endorsed by the NHL or any club. Team names and colours are used only to say which team is which.";
