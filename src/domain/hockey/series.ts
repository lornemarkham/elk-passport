import { liveExperience } from "@/experience-lab/core/engine";
import { receiptsFrom } from "@/experience-lab/core/lineage";
import type {
  ExperienceDefinition,
  ExperienceState,
  Lineage,
  Participant,
} from "@/experience-lab/core/types";
import { editionLabel } from "./edition";
import { OVER_AFTER_MS } from "./schedule";

/**
 * **Where a night stops being a night and starts being a tradition.**
 *
 * The lab's fourth load-bearing property was _"It accumulates. The next
 * edition can inherit the roster, the standings and the running joke."_ Its
 * `lineage.ts` built the cheap version of that: a next edition is the same
 * night with a later anchor and a memory of the last one, and the memory —
 * the receipts — is found in what actually happened rather than written.
 *
 * The shared night kept none of it (`lineage: undefined`). This puts it back,
 * with the one thing the lab could not have: real people across real nights.
 *
 * A **series** is the run of nights that started with one of them
 * (`edition.ts`). Everything here is derived per viewer from nights
 * that viewer can already read — RLS decides what a person may know about
 * last time, and this file never asks for more.
 *
 * **Points are not carried over.** That is the lab's finding, kept on
 * purpose: _"a defending champion is funny, a head start is not."_ What
 * persists is the Cup — who has held it, and how often.
 */

/** What one night's page knows about the rest of its run. */
export interface SeriesView {
  readonly edition: number;
  readonly cup: Cup;
  /** The last finished night before this one, as receipts. */
  readonly lastTime: Lineage | null;
  /** People from last time who are not on this night yet. For the host's guest list. */
  readonly crew: readonly Participant[];
  /** A later night in this run that this person is already on. */
  readonly next: { readonly id: string; readonly edition: number } | null;
}

/** A night, composed for one viewer, as the series sees it. */
export interface SeriesNight {
  readonly id: string;
  readonly edition: number;
  readonly startsAt: string;
  readonly definition: ExperienceDefinition;
  readonly state: ExperienceState;
}

/** Who won one night — or why nobody did. */
export interface CupResult {
  readonly id: string;
  readonly edition: number;
  readonly startsAt: string;
  readonly opponent: string;
  /** More than one when they tied. Empty when nobody won. */
  readonly champions: readonly Participant[];
  /** Some scored question was never called, so this is the table as it stood. */
  readonly unofficial: boolean;
  readonly status: "upcoming" | "won" | "no-result";
}

/** The page as it stood when the night was over — not as it is right now. */
function liveAtEnd(night: SeriesNight, now: Date) {
  const ended = new Date(new Date(night.startsAt).getTime() + OVER_AFTER_MS);
  return liveExperience(
    night.definition,
    { ...night.state, nowOverride: null },
    ended.getTime() > now.getTime() ? now : ended,
  );
}

export function cupResult(night: SeriesNight, now: Date): CupResult {
  const base = {
    id: night.id,
    edition: night.edition,
    startsAt: night.startsAt,
    opponent: night.definition.subtitle,
  };
  if (now.getTime() <= new Date(night.startsAt).getTime() + OVER_AFTER_MS) {
    return { ...base, champions: [], unofficial: false, status: "upcoming" };
  }
  const live = liveAtEnd(night, now);
  const top = live.standings[0];
  if (!top || top.points === 0) {
    return { ...base, champions: [], unofficial: false, status: "no-result" };
  }
  return {
    ...base,
    // The night's own tie-break (exact calls), so the Cup never disagrees
    // with the "Sycle Cup Champion" award the recap already gave out.
    champions: live.standings
      .filter((s) => s.points === top.points && s.exactCount === top.exactCount)
      .map((s) => s.participant),
    unofficial: !live.settled,
    status: "won",
  };
}

export interface CupHolder {
  readonly participant: Participant;
  readonly titles: number;
  readonly played: number;
}

export interface Cup {
  readonly series: string;
  /** Oldest first. */
  readonly nights: readonly CupResult[];
  /** Most titles first; then most nights played. Shared titles count for everybody in them. */
  readonly holders: readonly CupHolder[];
  /** Who holds it now: the champions of the most recent night that had any. */
  readonly holding: readonly Participant[];
}

/**
 * The Sycle Cup, across every night of one series this viewer was at.
 *
 * A person is the same person across nights because a participant id is a
 * Passport account. Their name is whatever they called themselves most
 * recently — people rename themselves, and the Cup should not show last
 * March's joke name as if it were current.
 */
export function sycleCup(
  series: string,
  nights: readonly SeriesNight[],
  now: Date,
): Cup {
  const ordered = [...nights].sort(
    (a, b) => a.edition - b.edition || a.startsAt.localeCompare(b.startsAt),
  );
  const results = ordered.map((n) => cupResult(n, now));

  const latest = new Map<string, Participant>();
  const played = new Map<string, number>();
  const titles = new Map<string, number>();
  for (const night of ordered) {
    for (const p of night.definition.participants) latest.set(p.id, p);
  }
  for (const [i, result] of results.entries()) {
    if (result.status === "upcoming") continue;
    for (const p of ordered[i].definition.participants) {
      played.set(p.id, (played.get(p.id) ?? 0) + 1);
    }
    for (const c of result.champions) {
      titles.set(c.id, (titles.get(c.id) ?? 0) + 1);
    }
  }

  const holders = [...titles.entries()]
    .map(([id, count]) => ({
      participant: latest.get(id)!,
      titles: count,
      played: played.get(id) ?? 0,
    }))
    .filter((h) => h.participant)
    .sort((a, b) => b.titles - a.titles || b.played - a.played);

  const lastWon = [...results].reverse().find((r) => r.status === "won");

  return {
    series,
    nights: results,
    holders,
    holding: (lastWon?.champions ?? []).map((c) => latest.get(c.id) ?? c),
  };
}

/**
 * What the last night is still holding over everybody, for the next one's
 * page. The lab's `receiptsFrom` does the finding; this only decides which
 * night is "last time" and keeps the result to the people who are here.
 *
 * `receiptsFrom` insists on a settled night — every scored question called —
 * and a real host forgets one. A night with a winner still has a defending
 * champion, so that much survives an uncalled overtime question.
 */
export function lastTime(
  current: {
    readonly edition: number;
    readonly participants: readonly Participant[];
  },
  nights: readonly SeriesNight[],
  now: Date,
): Lineage | null {
  const previous = [...nights]
    .filter((n) => n.edition < current.edition)
    .sort((a, b) => b.edition - a.edition)
    .find((n) => cupResult(n, now).status !== "upcoming");
  if (!previous) return null;

  const here = new Set(current.participants.map((p) => p.id));
  const label = `${editionLabel(previous.edition)} · ${previous.definition.subtitle}`;
  const found = receiptsFrom(previous.definition, previous.state, now);
  const result = cupResult(previous, now);
  const champion: Participant | undefined = result.champions[0];
  if (!champion) return null;

  const tied = result.champions.length > 1;
  return {
    previousLabel: label,
    defendingChampionId:
      !tied && here.has(champion.id) ? champion.id : undefined,
    // Shown, never scored. Only people who are actually on this night.
    standing: (found?.standing ?? []).filter((s) => here.has(s.participantId)),
    callback: tied
      ? `${result.champions.map((c) => c.name).join(" and ")} tied for it, and neither has conceded.`
      : (found?.callback ??
        `${champion.name} won it${result.unofficial ? ", on the results anybody bothered to call," : ""} and has mentioned this since.`),
    receipts: found?.receipts ?? [],
  };
}
