import { z } from "zod";
import { offlineDaySchema, planLine, type OfflineDay } from "./day";
import { challengeById, type Pact } from "./pact";

/**
 * **One trip out with the phone away, from the pact to the postcard.**
 *
 * This is deliberately **not** an adventure model. The day itself belongs to
 * `DayPlanned` (`src/domain/day/build.ts`) and, once it lands, the Adventure
 * contract on `lane/domain`. An outing holds only what Go Offline adds: a
 * pocket copy of the printed day (`day.ts`), the pact if anybody made one,
 * when the phones went away, and what the person said when they came back.
 *
 * ## The pact is optional
 *
 * Going offline is the point; the game is extra. An outing with no pact is a
 * whole outing, and nobody is handed a stake or three cards they never chose.
 *
 * ## Why it never says DID, LOVED or SKIPPED about a place
 *
 * WANTED / PLANNED / DID / LOVED is doctrine §2.9, and its vocabulary is open
 * (§15 Q3, Q14). The return here is about **the outing** — which challenges
 * got pulled off, who cracked, the thing nobody planned — and never records a
 * state against an Atlas subject. When the lived-state question is answered,
 * this is where a place-by-place return would plug in.
 *
 * ## Where it lives
 *
 * In this browser, and nowhere else. Nothing is sent. How a person's report
 * flows into their own Passport, or anybody else's, is §15 Q11 and open.
 */

export const OUTING_VERSION = 1 as const;

const pactSchema = z.object({
  phone: z.string().min(1).max(40),
  stake: z.string().min(1).max(40),
  challenges: z.array(z.string().min(1).max(40)).max(12),
  seed: z.number().int(),
});

const returnSchema = z.object({
  at: z.string().datetime(),
  /** Challenge ids the person says they pulled off. Their word, not ours. */
  pulledOff: z.array(z.string().min(1).max(40)).max(12),
  /** Who cracked first, in their words. Empty means nobody owned up. */
  cracked: z.string().max(60),
  /** The best thing that wasn't on the paper. */
  unplanned: z.string().max(280),
  /** Who was there, in their words. A memory, not a contact list. */
  company: z.string().max(120).optional(),
});

export const outingSchema = z.object({
  version: z.literal(OUTING_VERSION),
  /**
   * The printed day, kept for when the paper blows away. Absent when somebody
   * goes offline with a plan that never passed through `/go`.
   */
  day: offlineDaySchema.optional(),
  /** Absent unless somebody chose to make it interesting. */
  pact: pactSchema.optional(),
  /** When the phones went away. Absent until somebody pressed the button. */
  leftAt: z.string().datetime().optional(),
  back: returnSchema.optional(),
});

export type Outing = z.infer<typeof outingSchema>;
export type OutingReturn = z.infer<typeof returnSchema>;

const copyPact = (pact: Pact): Outing["pact"] => ({
  ...pact,
  challenges: [...pact.challenges],
});

export function newOuting(
  start: { readonly pact?: Pact; readonly day?: OfflineDay } = {},
): Outing {
  return {
    version: OUTING_VERSION,
    ...(start.day ? { day: start.day } : {}),
    ...(start.pact ? { pact: copyPact(start.pact) } : {}),
  };
}

/** A changed pact — or no pact at all — before anyone has left. */
export function withPact(outing: Outing, pact: Pact | undefined): Outing {
  if (pact) return { ...outing, pact: copyPact(pact) };
  const rest = { ...outing };
  delete rest.pact;
  return rest;
}

/**
 * The day to keep. Once the phones are away the kept day is the one they left
 * with, so a later visit with a different query cannot swap it underneath.
 */
export function withDay(outing: Outing, day: OfflineDay | undefined): Outing {
  if (!day || outing.leftAt) return outing;
  return { ...outing, day };
}

/** The challenges in play: none, if there is no pact. */
export const dealtIn = (outing: Outing): readonly string[] =>
  outing.pact?.challenges ?? [];

/** Phones away. Leaving twice keeps the first time — the day started then. */
export function leave(outing: Outing, now: Date): Outing {
  return outing.leftAt ? outing : { ...outing, leftAt: now.toISOString() };
}

/**
 * Back home. Only challenges that were actually in the pact are kept, and
 * free text is trimmed and capped rather than rejected — a long story about a
 * bakery is not an error.
 */
export function comeBack(
  outing: Outing,
  now: Date,
  report: {
    readonly pulledOff: readonly string[];
    readonly cracked: string;
    readonly unplanned: string;
    readonly company?: string;
  },
): Outing {
  const dealt = new Set(dealtIn(outing));
  const company = report.company?.trim().slice(0, 120);
  return {
    ...outing,
    back: {
      at: now.toISOString(),
      pulledOff: [...new Set(report.pulledOff)].filter((id) => dealt.has(id)),
      cracked: report.cracked.trim().slice(0, 60),
      unplanned: report.unplanned.trim().slice(0, 280),
      ...(company ? { company } : {}),
    },
  };
}

/** `unknown` from storage → an outing, or nothing. Never throws. */
export function parseOuting(raw: unknown): Outing | undefined {
  const parsed = outingSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

/**
 * **How long the phones were away**, in words.
 *
 * Said once, on the way back in, as a fact about the day — not tracked, not
 * compared, not turned into a streak. Past a day it stops pretending to be
 * precise: somebody who forgot to press "we're back" was not offline for
 * seventy-one hours, and it would be silly to congratulate them for it.
 */
export function awayFor(outing: Outing, now: Date): string | undefined {
  if (!outing.leftAt) return undefined;
  const until = outing.back ? new Date(outing.back.at) : now;
  const minutes = Math.floor(
    (until.getTime() - new Date(outing.leftAt).getTime()) / 60_000,
  );
  if (!Number.isFinite(minutes) || minutes < 0) return undefined;
  if (minutes < 1) return "less than a minute";
  if (minutes >= 24 * 60) return "more than a day";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = h === 0 ? "" : h === 1 ? "1 hour" : `${h} hours`;
  const mins = m === 0 ? "" : m === 1 ? "1 minute" : `${m} minutes`;
  return [hours, mins].filter(Boolean).join(" and ");
}

export interface Postcard {
  readonly headline: string;
  readonly lines: readonly string[];
}

/**
 * **The postcard** — the outing said back in a few lines worth keeping.
 *
 * Warm about every outcome. Zero challenges is still a day out; cracking
 * first is a story, and the stake is what makes it a good one. With no pact
 * there is nothing to count, so nothing is counted.
 *
 * The plan is said as **the plan** — never as a list of places "done". What
 * was actually lived at each stop is §15 Q3 / Q14, and still open.
 */
export function postcard(outing: Outing, now: Date): Postcard {
  const back = outing.back;
  const dealt = dealtIn(outing);
  const done = back?.pulledOff.length ?? 0;
  const away = awayFor(outing, now);

  const headline =
    dealt.length === 0
      ? "You went. That was the whole idea."
      : done === dealt.length
        ? `${count(done)} for ${count(dealt.length).toLowerCase()}. Show-offs.`
        : done === 0
          ? "No challenges, and a whole day anyway."
          : `${count(done)} out of ${count(dealt.length).toLowerCase()}. Respectable.`;

  const lines: string[] = [];
  if (outing.day) lines.push(`The plan: ${planLine(outing.day)}.`);
  if (back?.company) lines.push(`With ${back.company}.`);
  if (away && away !== "more than a day")
    lines.push(`Phones away for ${away}.`);
  for (const id of back?.pulledOff ?? []) {
    const challenge = challengeById(id);
    if (challenge) lines.push(`✓ ${challenge.line}`);
  }
  if (back) {
    if (back.cracked)
      lines.push(`${back.cracked} cracked first. A deal is a deal.`);
    else if (outing.pact)
      lines.push("Nobody cracked. Somebody check the phones still work.");
    if (back.unplanned) lines.push(`Not on the paper: ${back.unplanned}`);
  }
  return { headline, lines };
}

const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];
const count = (n: number) => WORDS[n] ?? String(n);
