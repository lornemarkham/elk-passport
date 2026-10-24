import "server-only";

/**
 * **The conference's "now".** The real clock, always, in production.
 *
 * In development and tests `CONFERENCE_NOW` (an ISO instant) stands in for
 * it, so a walkthrough of "what's on now" at 10:40 on day one can be seen at
 * any hour. A production build ignores it: no deployed page can be told what
 * time it is.
 */
export function conferenceNow(
  env: Readonly<Record<string, string | undefined>> = process.env,
): Date {
  if (env.NODE_ENV !== "production" && env.CONFERENCE_NOW) {
    const t = Date.parse(env.CONFERENCE_NOW);
    if (!Number.isNaN(t)) return new Date(t);
  }
  return new Date();
}
