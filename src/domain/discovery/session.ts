import type { ExperienceKind } from "@/domain/experience/types";
import { INTENTS, type IntentKey } from "./intents";
import type { Company, Situation, Window } from "./situation";
import { townById } from "./towns";

/**
 * **An exploration is a place, not a mood the page happens to be in.**
 *
 * What this fixes, reported by a person who actually used it: they picked
 * *Farms & markets*, said they had a young child and half a day, typed
 * `farm`, found Kangaroo Creek Farm, pressed **Want to do**, and were asked to
 * sign in. The invitation sent them to `/auth?next=%2Fdiscovery`.
 *
 * Every one of those choices lived in React state, so the full page load to
 * the sign-in form destroyed all of it. They came back to an empty Discovery,
 * and the farm they had asked for was never recorded.
 *
 * Only `intent` survived, because only `intent` was in the URL. So the rest
 * goes in the URL too, and the whole exploration becomes a link: it survives a
 * refresh, a trip to the board and back, and a round trip through sign-in,
 * because all three are the same problem.
 *
 * ```
 * /discovery?intent=local&who=child&how=half-day&ask=a+farm
 * ```
 *
 * Short keys because this is a URL somebody might see, and a stable order so
 * the same exploration always produces the same string.
 */
export interface DiscoverySession {
  readonly intent?: IntentKey;
  readonly kind?: ExperienceKind;
  readonly company?: Company;
  readonly window?: Window;
  /**
   * **A child's age in years, only where somebody actually said one.**
   *
   * Atlas answers `?childAge=N` with its own verdict per subject. Passport
   * never fills this in: "with a young child" is not five, and defaulting it
   * would invent the single fact the whole contract exists to carry.
   */
  readonly age?: number;
  /**
   * **The day they are asking about**, `YYYY-MM-DD`.
   *
   * "Sunday" is a question Atlas can answer — it states start dates and, for
   * sixteen subjects, the weekdays a thing recurs on. Absent means any day.
   */
  readonly on?: string;
  /**
   * **How far they will go**, in kilometres.
   *
   * Only ever narrows what Atlas has placed. Inert until somebody shares
   * where they are, because a distance needs two positions and Passport
   * refuses to invent the second.
   */
  readonly within?: number;
  /**
   * **A town they picked, by id** — `vernon`, `kelowna`, `revelstoke`.
   *
   * The answer to *"how far will you go?"* needs somewhere to measure from,
   * and browser geolocation is not the only honest way to get one. A person
   * who declines the permission, whose browser has no geolocation, or who is
   * planning a trip from their sofa to somewhere they are not, can say which
   * town instead.
   *
   * **An id, never a coordinate.** The point comes from `OCTOBER_PLACES` —
   * twenty-two town centroids verified against Wikidata and already used for
   * the forecast — so the URL carries a place a person chose and named, not a
   * position anyone measured. ADR 002 is about the reader's own position and
   * is untouched by this: there is nothing precise here to leak.
   */
  readonly at?: string;
  /** The invitation they tapped — an Atlas affordance name. */
  readonly doing?: string;
  /**
   * **Search everywhere, not just within the answers above.** Search follows
   * the chosen distance, day and age by default; this is the one explicit
   * way to widen it, and it widens search only — nothing else is reset.
   */
  readonly everywhere?: boolean;
  /**
   * **A question they asked in their own words** — "what can we do with three
   * hours?". Kept as the sentence, not as what it was read into: those
   * answers are already the fields above, and re-reading the sentence is how
   * the answer comes back after a refresh or a round trip through sign-in.
   */
  readonly ask?: readonly string[];
}

/** How many sentences of a conversation a URL keeps — the most recent. */
const TURNS_KEPT = 8;

const INTENT_KEYS: readonly IntentKey[] = INTENTS.map((i) => i.key);
const COMPANY: readonly Company[] = ["alone", "child", "group"];
const WINDOW: readonly Window[] = ["an-hour", "half-day", "all-day"];
const KINDS: readonly ExperienceKind[] = [
  "Place",
  "Event",
  "Organization",
  "Experience",
  "Activity",
];

/** A value a URL offered, kept only if it is one this product recognises. */
const oneOf = <T extends string>(
  allowed: readonly T[],
  value: string | null,
): T | undefined => allowed.find((a) => a === value);

/**
 * Read an exploration out of a URL.
 *
 * Anything unrecognised is dropped rather than repaired. A `who=badger` is
 * somebody editing the address bar, and the honest response is to behave as
 * though they had not.
 */
export function readSession(params: URLSearchParams): DiscoverySession {
  const query = params.get("q")?.trim();
  // 0–17, whole years — the range Atlas accepts. Anything else is somebody
  // editing the address bar, and is dropped rather than clamped.
  // `YYYY-MM-DD` only. A half-parsed date is worse than no date.
  const askedOn = params.get("on") ?? "";
  const on = /^\d{4}-\d{2}-\d{2}$/.test(askedOn) ? askedOn : undefined;
  const askedWithin = Number(params.get("within"));
  const within =
    params.get("within") !== null &&
    Number.isFinite(askedWithin) &&
    askedWithin > 0 &&
    askedWithin <= 500
      ? askedWithin
      : undefined;
  const askedAge = Number(params.get("age"));
  const age =
    params.get("age") !== null &&
    Number.isInteger(askedAge) &&
    askedAge >= 0 &&
    askedAge <= 17
      ? askedAge
      : undefined;
  const doing = params.get("doing")?.trim();
  // A town Passport actually has a verified point for. An unknown id is
  // dropped rather than carried, so nothing downstream has to wonder.
  const at = townById(params.get("at")?.trim())?.id;
  // **A conversation is the sentences, in order** — `?ask=…&ask=…`. One
  // `ask` is the single question this used to hold, so old links still work.
  // **One box, one state.** Discovery used to hold a typed search (`?q=`)
  // beside the conversation, in a second box. The second box is gone; an old
  // link's search arrives as the first thing said, which the sentence box
  // answers by name (`findByName`) when it reads as nothing else.
  const said = params
    .getAll("ask")
    .map((sentence) => sentence.trim().slice(0, 300))
    .filter(Boolean);
  const ask = (said.length === 0 && query ? [query.slice(0, 300)] : said).slice(
    -TURNS_KEPT,
  );
  return {
    ...(oneOf(INTENT_KEYS, params.get("intent"))
      ? { intent: oneOf(INTENT_KEYS, params.get("intent"))! }
      : {}),
    ...(oneOf(KINDS, params.get("kind"))
      ? { kind: oneOf(KINDS, params.get("kind"))! }
      : {}),
    ...(oneOf(COMPANY, params.get("who"))
      ? { company: oneOf(COMPANY, params.get("who"))! }
      : {}),
    ...(oneOf(WINDOW, params.get("how"))
      ? { window: oneOf(WINDOW, params.get("how"))! }
      : {}),
    ...(age !== undefined ? { age } : {}),
    ...(on ? { on } : {}),
    ...(within !== undefined ? { within } : {}),
    ...(at ? { at } : {}),
    ...(doing ? { doing } : {}),
    ...(params.get("all") === "1" ? { everywhere: true } : {}),
    ...(ask.length > 0 ? { ask } : {}),
  };
}

/** The exploration as a query string. Empty where nothing has been chosen. */
export function sessionQuery(session: DiscoverySession): string {
  const params = new URLSearchParams();
  if (session.intent) params.set("intent", session.intent);
  if (session.kind) params.set("kind", session.kind);
  if (session.company) params.set("who", session.company);
  if (session.window) params.set("how", session.window);
  if (session.age !== undefined) params.set("age", String(session.age));
  if (session.on) params.set("on", session.on);
  if (session.within !== undefined)
    params.set("within", String(session.within));
  if (session.at) params.set("at", session.at);
  if (session.doing) params.set("doing", session.doing);
  if (session.everywhere) params.set("all", "1");
  for (const said of session.ask ?? [])
    if (said.trim()) params.append("ask", said.trim());
  return params.toString();
}

/** The link back to exactly this exploration. */
export function sessionHref(
  session: DiscoverySession,
  extra?: Readonly<Record<string, string>>,
): string {
  const params = new URLSearchParams(sessionQuery(session));
  for (const [key, value] of Object.entries(extra ?? {})) {
    params.set(key, value);
  }
  const query = params.toString();
  return query ? `/discovery?${query}` : "/discovery";
}

/** The two situational answers, as the panel wants them. */
export function situationOf(session: DiscoverySession): Situation {
  return {
    ...(session.company ? { company: session.company } : {}),
    ...(session.window ? { window: session.window } : {}),
  };
}

/**
 * **What somebody was trying to do when Passport interrupted them.**
 *
 * They pressed a button; Passport asked who they were. Losing the button press
 * on the way to the sign-in form is the part that made the product feel
 * broken — they signed in, came back, and nothing had happened.
 *
 * So the intent rides along in the same URL and is replayed once on the far
 * side. `want` and `save` stay separate because they do genuinely different
 * things: `want` puts a Thing in your October, `save` puts an experience on a
 * board. Merging them here would quietly change which one happened.
 */
export interface PendingAction {
  readonly act: "save" | "want";
  readonly id: string;
}

export function readPending(
  params: URLSearchParams,
): PendingAction | undefined {
  const raw = params.get("do");
  if (!raw) return undefined;
  const at = raw.indexOf(":");
  if (at < 1) return undefined;
  const act = raw.slice(0, at);
  const id = raw.slice(at + 1).trim();
  if (!id || (act !== "save" && act !== "want")) return undefined;
  return { act, id };
}

export const pendingParam = (action: PendingAction): string =>
  `${action.act}:${action.id}`;
