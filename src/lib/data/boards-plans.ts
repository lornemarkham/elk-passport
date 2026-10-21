/**
 * **A day somebody built, offered to everyone on a board.**
 *
 * Go Have A Day already turns a sentence into a day and a day into a printed
 * guide, and the guide's URL is the day: stop ids in order, plus the sentence
 * and the context it was read with (`/go/print?stops=…`). A shared plan is
 * that URL, put on a board where the rest of the group can see it and say
 * they're in.
 *
 * ## Not a second planner
 *
 * Nothing is copied out of Atlas and nothing is re-planned. The board keeps
 * the query and nothing else; opening it runs exactly the print page anybody
 * would have run, which re-reads every stop from Atlas. If Atlas has since
 * lost a stop, the guide shows the stops it still has — the same thing that
 * happens to a printed link today.
 *
 * ## "I'm in" is interest, not an RSVP
 *
 * Saying you're in on a shared day is the board's existing interest mark,
 * with the plan as the item (`planItemId`). It is a raised hand, exactly as
 * it is on the hockey game: counted, named only if you chose to be, and never
 * a commitment anybody can hold you to. Whether a group day should *also*
 * have a commitment state is the doctrine's open question (§2.6, §15.12) and
 * is not answered here.
 *
 * ## Who shared it
 *
 * Named only if they chose to be, and only while they are still on the
 * board. Somebody who leaves takes their name with them; the day they shared
 * stays, because other people may already be in on it.
 */

/** Board event kinds for shared days. Core's kinds stay Core's. */
export const PLAN_EVENT_KINDS = {
  planShared: "plan-shared",
  planWithdrawn: "plan-withdrawn",
} as const;

/** The parameters `/go/print` reads. Anything else is dropped. */
const DAY_KEYS = ["stops", "say", "hours", "age", "at", "on"] as const;

/** Go Have A Day builds two to five stops. More is not a day from `/go`. */
export const PLAN_STOPS_MAX = 5;
export const PLAN_TITLE_MAX = 80;
const SAY_MAX = 300;
const ID_MAX = 200;
const TOWN = /^[a-z0-9-]{1,60}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The canonical query for a day, from a `/go/print` link or its query string —
 * or `null` if it is not one.
 *
 * Only same-site print links are accepted, so a board can never be made to
 * carry a link that leaves Passport. The result is rebuilt from whitelisted
 * keys in a fixed order: two people sharing the same day share the same text.
 */
export function canonicalDayQuery(link: string): string | null {
  const raw = link.trim();
  if (!raw || raw.length > 2000) return null;

  let params: URLSearchParams;
  if (raw.startsWith("/") || /^https?:\/\//i.test(raw)) {
    let url: URL;
    try {
      url = new URL(raw, "http://passport.invalid");
    } catch {
      return null;
    }
    if (url.pathname !== "/go/print") return null;
    // An absolute link is fine to paste from your own address bar; where it
    // points is ignored because only the query survives.
    params = url.searchParams;
  } else {
    params = new URLSearchParams(raw.replace(/^\?/, ""));
  }

  const stops = (params.get("stops") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (
    stops.length === 0 ||
    stops.length > PLAN_STOPS_MAX ||
    stops.some((s) => s.length > ID_MAX) ||
    new Set(stops).size !== stops.length
  ) {
    return null;
  }

  const out = new URLSearchParams();
  out.set("stops", stops.join(","));

  const say = params.get("say")?.trim();
  if (say) out.set("say", say.slice(0, SAY_MAX));

  const hours = Number(params.get("hours"));
  if (params.get("hours") && Number.isFinite(hours) && hours > 0 && hours <= 24)
    out.set("hours", String(hours));

  const age = Number(params.get("age"));
  if (params.get("age") && Number.isInteger(age) && age >= 0 && age <= 17)
    out.set("age", String(age));

  const at = params.get("at")?.trim();
  if (at && TOWN.test(at)) out.set("at", at);

  const on = params.get("on")?.trim();
  if (on && DATE.test(on) && realDate(on)) out.set("on", on);

  // Fixed order, whatever order the link arrived in.
  const ordered = new URLSearchParams();
  for (const key of DAY_KEYS) {
    const value = out.get(key);
    if (value !== null) ordered.set(key, value);
  }
  return ordered.toString();
}

/** `2026-02-31` matches the pattern and is not a day anybody can go out on. */
function realDate(on: string): boolean {
  const date = new Date(`${on}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === on
  );
}

export const planHref = (dayQuery: string): string => `/go/print?${dayQuery}`;

/** The interest item for a plan. Prefixed so it can never collide with an Atlas id. */
export const planItemId = (planId: string): string => `plan:${planId}`;

export interface PlanRow {
  readonly id: string;
  readonly userId: string;
  readonly title: string | null;
  readonly dayQuery: string;
  /** The name they chose to show, or `null` to share it unnamed. */
  readonly shownAs: string | null;
  readonly createdAt: string;
}

/** What a member's browser receives. No user ids. */
export interface SharedPlan {
  readonly id: string;
  /** The interest item id for "I'm in". */
  readonly itemId: string;
  readonly title: string;
  readonly href: string;
  readonly stops: number;
  readonly on: string | null;
  readonly sharedBy: string | null;
  readonly yours: boolean;
  /** The sharer, and the board's owner, may take it down. */
  readonly canWithdraw: boolean;
  readonly createdAt: string;
}

function defaultTitle(params: URLSearchParams): string {
  const n = (params.get("stops") ?? "").split(",").filter(Boolean).length;
  const say = params.get("say")?.trim();
  if (say) return say.length > 60 ? `${say.slice(0, 57)}…` : say;
  return `A day of ${n} ${n === 1 ? "stop" : "stops"}`;
}

export function summarisePlans(
  rows: readonly PlanRow[],
  viewer: { readonly id: string; readonly isOwner: boolean },
  memberIds: ReadonlySet<string>,
): readonly SharedPlan[] {
  return [...rows]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((row) => {
      const params = new URLSearchParams(row.dayQuery);
      const yours = row.userId === viewer.id;
      const named =
        memberIds.has(row.userId) && row.shownAs?.trim()
          ? row.shownAs.trim()
          : null;
      return {
        id: row.id,
        itemId: planItemId(row.id),
        title: row.title?.trim() || defaultTitle(params),
        href: planHref(row.dayQuery),
        stops: (params.get("stops") ?? "").split(",").filter(Boolean).length,
        on: params.get("on"),
        sharedBy: yours ? null : named,
        yours,
        canWithdraw: yours || viewer.isOwner,
        createdAt: row.createdAt,
      };
    });
}

/** What the browser may send to share a day. Anything else is a 400. */
export interface PlanRequest {
  readonly dayQuery: string;
  readonly title: string | null;
  readonly showName: boolean;
}

export function parsePlanRequest(body: unknown): PlanRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const { link, title, showName } = body as Record<string, unknown>;
  if (typeof link !== "string") return null;
  const dayQuery = canonicalDayQuery(link);
  if (!dayQuery) return null;
  const named =
    typeof title === "string" ? title.trim().slice(0, PLAN_TITLE_MAX) : "";
  return { dayQuery, title: named || null, showName: showName === true };
}
