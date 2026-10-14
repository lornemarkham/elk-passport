import type { DayBrief } from "./brief";

/**
 * **Does the day know where it starts?**
 *
 * A sentence with no town, and no town carried in from Discovery, has no
 * origin — and a day built without one spans the province: M200 got Queen
 * Elizabeth Theatre in Vancouver, then a park 173 km away, then another 83 km
 * past that, for "taking my family out this afternoon". Passport never picks
 * a starting point for somebody. It reuses one it was told (`?at=`, a town in
 * the sentence, a position the person offered) and otherwise asks.
 */
export const needsStart = (brief: DayBrief): boolean => !brief.town;

/**
 * **Open product decision (doctrine §15.5, "when to proactively ask for
 * constraints"), proposed here and not resolved.** Asking *before* showing
 * anything is in tension with §4 ("do not force *How much time do you
 * have?* before showing anything"). It is applied to **building a day**
 * only — Discovery is untouched — because a day without a start is a fiction
 * (§7). See `docs/architecture/decisions/003-go-day-needs-a-start.md`.
 */
