/**
 * **The Chairlift Feed** — what to watch between the top and the bottom.
 *
 * Sections, each a short list, all derived: trending at my mountain, today's
 * best tricks, new challenges, rivals' clips (riders you've faced — Sesh Wars
 * has no friend list of its own yet), champions dethroned, and the best from
 * other mountains for spectators at home. Nothing autoplays: a card is a
 * still until someone taps it (see ClipPlayer).
 */
import type { Challenge, Clip, Viewer, World } from "./model";
import {
  challengeState,
  clipOf,
  dethronings,
  featureOf,
  reactionTotal,
  type Result,
} from "./rules";
import { hillDay } from "./time";

const HOUR = 3_600_000;

/** Reactions and votes, fading over three days. */
export function heat(w: World, c: Clip, now: number): number {
  const age = Math.max(0, now - Date.parse(c.at)) / HOUR;
  const votes = w.challenges
    .filter((ch) => ch.defenderClipId === c.id || ch.challengerClipId === c.id)
    .reduce((n, ch) => {
      const s = challengeState(w, ch, now);
      return (
        n + (ch.defenderClipId === c.id ? s.tally.defender : s.tally.challenger)
      );
    }, 0);
  return (reactionTotal(w, c.id) + 2 * votes + 1) / Math.pow(1 + age / 24, 1.4);
}

const mountainOf = (w: World, c: Clip) => featureOf(w, c.featureId)?.mountainId;

export interface Feed {
  readonly trending: Clip[];
  readonly bestTricks: Clip[];
  readonly newChallenges: Challenge[];
  readonly rivals: Clip[];
  readonly dethroned: { result: Result; featureId: string }[];
  readonly elsewhere: Clip[];
}

export function chairliftFeed(
  w: World,
  v: Viewer,
  mountainId: string,
  now: number,
): Feed {
  const here = w.clips.filter((c) => mountainOf(w, c) === mountainId);
  const byHeat = (a: Clip, b: Clip) =>
    heat(w, b, now) - heat(w, a, now) || b.at.localeCompare(a.at);
  const today = hillDay(now);
  const rivalIds = new Set<string>();
  if (v.riderId)
    for (const ch of w.challenges) {
      const pair = [
        clipOf(w, ch.defenderClipId)?.riderId,
        clipOf(w, ch.challengerClipId)?.riderId,
      ];
      if (pair.includes(v.riderId))
        pair.forEach((id) => id && id !== v.riderId && rivalIds.add(id));
    }
  return {
    trending: [...here].sort(byHeat).slice(0, 8),
    bestTricks: here
      .filter((c) => c.category === "best-trick" && hillDay(c.at) === today)
      .sort(byHeat)
      .slice(0, 6),
    newChallenges: w.challenges
      .filter(
        (ch) =>
          featureOf(w, ch.featureId)?.mountainId === mountainId &&
          Date.parse(ch.closesAt) > now,
      )
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 6),
    rivals: w.clips
      .filter((c) => rivalIds.has(c.riderId))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 6),
    dethroned: dethronings(w, now)
      .filter((d) => featureOf(w, d.featureId)?.mountainId === mountainId)
      .slice(0, 4),
    elsewhere: w.clips
      .filter((c) => mountainOf(w, c) !== mountainId)
      .sort(byHeat)
      .slice(0, 6),
  };
}

/** Riders on a mountain by recent heat — "trending riders". */
export function trendingRiders(w: World, mountainId: string, now: number) {
  const score = new Map<string, number>();
  for (const c of w.clips)
    if (mountainOf(w, c) === mountainId)
      score.set(c.riderId, (score.get(c.riderId) ?? 0) + heat(w, c, now));
  return [...score.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([riderId]) => riderId);
}
