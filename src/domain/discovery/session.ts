import type { ExperienceKind } from "@/domain/experience/types";
import { INTENTS, type IntentKey } from "./intents";
import type { Company, Situation, Window } from "./situation";

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
 * /discovery?intent=local&q=farm&who=child&how=half-day
 * ```
 *
 * Short keys because this is a URL somebody might see, and a stable order so
 * the same exploration always produces the same string.
 */
export interface DiscoverySession {
  readonly intent?: IntentKey;
  /** What they typed. */
  readonly query?: string;
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
  /** The invitation they tapped — an Atlas affordance name. */
  readonly doing?: string;
}

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
  const askedAge = Number(params.get("age"));
  const age =
    params.get("age") !== null &&
    Number.isInteger(askedAge) &&
    askedAge >= 0 &&
    askedAge <= 17
      ? askedAge
      : undefined;
  const doing = params.get("doing")?.trim();
  return {
    ...(oneOf(INTENT_KEYS, params.get("intent"))
      ? { intent: oneOf(INTENT_KEYS, params.get("intent"))! }
      : {}),
    ...(query ? { query } : {}),
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
    ...(doing ? { doing } : {}),
  };
}

/** The exploration as a query string. Empty where nothing has been chosen. */
export function sessionQuery(session: DiscoverySession): string {
  const params = new URLSearchParams();
  if (session.intent) params.set("intent", session.intent);
  if (session.query?.trim()) params.set("q", session.query.trim());
  if (session.kind) params.set("kind", session.kind);
  if (session.company) params.set("who", session.company);
  if (session.window) params.set("how", session.window);
  if (session.age !== undefined) params.set("age", String(session.age));
  if (session.doing) params.set("doing", session.doing);
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
