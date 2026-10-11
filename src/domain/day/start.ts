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
