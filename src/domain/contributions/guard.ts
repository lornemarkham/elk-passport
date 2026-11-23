/**
 * **Abuse protection without a daily cap** (owner brief 2026-11-23, P0).
 *
 * The Christmas lights map refused the eleventh pin of a day with _"That's a
 * lot of magic for one day — try again tomorrow."_ The owner drove around
 * Vernon adding ten real displays and hit it. The daily caps (5 anonymous,
 * 10 signed in) are gone, here and in `christmas/lights/actions.ts`, which
 * now calls these rules instead.
 *
 * What stays is what tells a script from a person:
 *
 * - **A burst** — more than `BURST.max` in a minute, or more than
 *   `HOURLY.max` in an hour — is asked to slow down, with a retry time, not
 *   turned away for the day. A person filling in a form every thirty seconds
 *   never meets either; twenty-five in one session is well inside both.
 * - **A cooling-off** for a contributor whose recent suggestions were
 *   declined as spam: three such declines among their last five decisions
 *   and nothing more is taken from them for a day. Moderation, not a quota.
 * - **A flood stop** on how many may wait for review at once, high enough
 *   that a busy weekend never meets it (`MAX_WAITING`).
 *
 * Exact repeats from the same person are not refused at all: they return the
 * suggestion already waiting (the route's job), so a double tap on a weak
 * signal is one suggestion, not two.
 */

export const BURST = { max: 12, windowMs: 60_000 } as const;
export const HOURLY = { max: 60, windowMs: 3_600_000 } as const;
export const COOLING_OFF_MS = 24 * 3_600_000;
export const SPAM_STRIKES = 3;
export const RECENT_DECISIONS = 5;
/** Most suggestions one queue holds before asking people to come back. */
export const MAX_WAITING = 1000;

export type Pace =
  | { readonly ok: true }
  | { readonly ok: false; readonly retryAfterSeconds: number };

/**
 * Is this contributor sending faster than a person could? `times` are the
 * ISO moments of their earlier submissions (any status, any experience).
 */
export function pace(times: readonly string[], now: Date): Pace {
  const t = now.getTime();
  let wait = 0;
  for (const w of [BURST, HOURLY]) {
    const inWindow = times
      .map((x) => new Date(x).getTime())
      .filter((x) => Number.isFinite(x) && t - x < w.windowMs && x <= t)
      .sort((a, b) => a - b);
    if (inWindow.length >= w.max) {
      // Room comes back when the oldest in the window leaves it.
      const oldest = inWindow[inWindow.length - w.max]!;
      wait = Math.max(wait, oldest + w.windowMs - t);
    }
  }
  return wait > 0
    ? { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(wait / 1000)) }
    : { ok: true };
}

export interface Decision {
  readonly at: string;
  readonly spam: boolean;
}

/**
 * A contributor whose last few decided suggestions were mostly declined as
 * spam is cooling off: `SPAM_STRIKES` spam declines among their last
 * `RECENT_DECISIONS` decisions, the latest within `COOLING_OFF_MS`.
 */
export function coolingOff(decisions: readonly Decision[], now: Date): boolean {
  const recent = [...decisions]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, RECENT_DECISIONS);
  const spam = recent.filter((d) => d.spam);
  if (spam.length < SPAM_STRIKES) return false;
  const latest = new Date(spam[0]!.at).getTime();
  return now.getTime() - latest < COOLING_OFF_MS;
}

/** Said to the person when they are sending too fast: a pause, never "tomorrow". */
export const TOO_FAST =
  "Whoa — that's a lot at once. Give it a minute and keep going.";
export const COOLING =
  "We've paused suggestions from here for a day while we catch up on the last few.";
export const FLOODED =
  "We have a lot waiting for review right now — please try again in a day or two.";
