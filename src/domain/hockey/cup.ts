import type { LiveExperience } from "@/experience-lab/core/engine";
import type { Participant, Prompt } from "@/experience-lab/core/types";
import {
  KIND_EMOJI,
  KIND_TITLE,
  isCupLine,
  sideWords,
  type ChallengeRow,
  type Game,
  type LedgerRow,
  type Settled,
  type TeamReactionRow,
} from "./challenges";
import { teamByAbbr } from "./fans";
import { answerText } from "./reveal";

/**
 * **The Sycle Cup: who leads, why, and whether anybody may say "champion".**
 *
 * Standings are the engine's, computed from rows every member reads alike
 * (the challenge lines and the mission ledger included, `challenges.ts`).
 * What this file adds is the honesty around them: a champion is named only
 * once every point that could still move has been settled — every pick
 * called, every jury closed, every question somebody asked called by them —
 * and until then the page says exactly what it is waiting on.
 */

/** The template's own scored questions (not the Cup's lines, not members' questions). */
function templatePicks(live: LiveExperience) {
  return live.prompts.filter(
    (p) => p.prompt.scoring && !p.prompt.askedBy && !isCupLine(p.prompt.id),
  );
}

export interface CupStatus {
  /** Somebody has a point. */
  readonly scoring: boolean;
  /** Every point is settled and the game is over: the champion can be named. */
  readonly verified: boolean;
  /** What is still open, in words, most important first. */
  readonly waitingOn: readonly string[];
  /** The game has reached the final horn. */
  readonly over: boolean;
}

export function cupStatus(
  live: LiveExperience,
  settled: readonly Settled[],
  people: readonly Participant[] = live.participants,
): CupStatus {
  const after = live.definition.phases.findIndex((p) => p.id === "after");
  const over = after >= 0 && live.phaseNumber >= after;
  const name = (id: string) =>
    people.find((p) => p.id === id)?.name ?? "somebody";
  const waitingOn: string[] = [];
  for (const p of templatePicks(live)) {
    // Somebody has to have answered for a call to matter.
    if (p.prompt.resolution === undefined && p.responses.length > 0)
      waitingOn.push(`the host to call “${shortQ(p.prompt.question)}”`);
  }
  for (const p of live.prompts) {
    if (!p.prompt.askedBy || !p.prompt.scoring || p.prompt.scoring.shared)
      continue;
    if (p.prompt.resolvedBy === "vote") continue;
    if (p.prompt.resolution === undefined && p.responses.length > 0)
      waitingOn.push(
        `${name(p.prompt.askedBy)} to call “${shortQ(p.prompt.question)}”`,
      );
  }
  for (const s of settled) {
    if (s.state === "on")
      waitingOn.push(
        `the result of ${name(s.challenge.challenger_id)} and ${name(s.challenge.target_id)}'s bet`,
      );
    if (s.state === "jury")
      waitingOn.push(
        `the jury on ${name(s.challenge.target_id)}'s ${KIND_TITLE[s.challenge.kind].replace(/^The /, "").toLowerCase()}`,
      );
    if (s.state === "awaiting-entry")
      waitingOn.push(
        `${name(s.challenge.target_id)} to deliver their ${KIND_TITLE[s.challenge.kind].replace(/^The /, "").toLowerCase()}`,
      );
  }
  const scoring = live.standings.some((s) => s.points > 0);
  return {
    scoring,
    verified: over && scoring && waitingOn.length === 0,
    waitingOn,
    over,
  };
}

function shortQ(q: string): string {
  return q.length > 44 ? `${q.slice(0, 41).trimEnd()}…` : q;
}

/**
 * The most wrong final-score call: furthest from the called score, by total
 * goals off. Shown only once the score is called and with two or more picks
 * — being the worst of one is just being there.
 */
export function spectacularlyWrong(
  live: LiveExperience,
): { participant: Participant; pick: string; actual: string } | null {
  const p = live.prompts.find((x) => x.prompt.id === "final-score");
  const r = p?.prompt.resolution;
  if (!p || !Array.isArray(r) || !p.showResolution || p.responses.length < 2)
    return null;
  const [h, a] = r as readonly number[];
  const off = (v: unknown) =>
    Array.isArray(v)
      ? Math.abs((v[0] as number) - h) + Math.abs((v[1] as number) - a)
      : -1;
  const worst = [...p.responses].sort(
    (x, y) =>
      off(y.value) - off(x.value) ||
      x.participantId.localeCompare(y.participantId),
  )[0];
  if (!worst || off(worst.value) <= 0) return null;
  const who = live.participants.find((q) => q.id === worst.participantId);
  if (!who) return null;
  return {
    participant: who,
    pick: answerText(p.prompt, worst.value),
    actual: `${h}–${a}`,
  };
}

/** Who called a question right, once it can be told. */
export function calledIt(
  live: LiveExperience,
  promptId: string,
): Participant[] {
  const p = live.prompts.find((x) => x.prompt.id === promptId);
  if (!p || p.prompt.resolution === undefined || !p.showResolution) return [];
  const right = live.standings.filter((s) =>
    s.lines.some((l) => l.promptId === promptId),
  );
  return right.map((s) => s.participant);
}

// ------------------------------------------------------------- drama

export interface DramaItem {
  readonly id: string;
  readonly at: string;
  readonly emoji: string;
  /** Who did it (for the avatar). */
  readonly by?: string;
  readonly text: string;
  /** Points changed hands. */
  readonly points?: number;
}

/**
 * **The latest drama**: what people actually did — challenges thrown and
 * taken, performances delivered, verdicts, prophecies, missions pulled off,
 * people reacting to each other's teams — newest first. Built only from rows
 * (nothing invented, nothing about a person who isn't here), and a decline
 * never appears: it is the two people's business.
 */
export function dramaOf(input: {
  readonly people: readonly Participant[];
  readonly fans: Readonly<Record<string, string>>;
  readonly game: Game;
  readonly settled: readonly Settled[];
  readonly reactions: readonly TeamReactionRow[];
  readonly ledger: readonly LedgerRow[];
  readonly viewerId: string | null;
  readonly limit?: number;
}): DramaItem[] {
  const ids = new Set(input.people.map((p) => p.id));
  const name = (id: string) =>
    id === input.viewerId
      ? "You"
      : (input.people.find((p) => p.id === id)?.name ?? "Somebody");
  const obj = (id: string) =>
    id === input.viewerId
      ? "you"
      : (input.people.find((p) => p.id === id)?.name ?? "somebody");
  const items: DramaItem[] = [];

  for (const s of input.settled) {
    const c: ChallengeRow = s.challenge;
    if (!ids.has(c.challenger_id) || !ids.has(c.target_id)) continue;
    if (c.status === "declined" || c.status === "withdrawn") continue;
    const self = c.challenger_id === c.target_id;
    const what =
      c.kind === "bet" && c.market && c.side
        ? `bet ${obj(c.target_id)} that ${sideWords(c.market, c.side, input.game)}`
        : c.kind === "defend"
          ? self
            ? `stepped up to defend the ${teamName(input.fans[c.target_id]) ?? "team"} unprompted`
            : `challenged ${obj(c.target_id)} to defend the ${teamName(input.fans[c.target_id]) ?? "team"}' honour`
          : c.kind === "commentary"
            ? self
              ? "grabbed the mic for some commentary"
              : `handed ${obj(c.target_id)} the commentator's mic`
            : c.kind === "hottake"
              ? self
                ? "dropped a hot take on the record"
                : `dared ${obj(c.target_id)} to post a hot take`
              : "made a prophecy";
    items.push({
      id: `${c.id}:made`,
      at: c.created_at,
      emoji: KIND_EMOJI[c.kind],
      by: c.challenger_id,
      text: `${name(c.challenger_id)} ${what}.`,
    });
    if (!self && c.status === "accepted" && c.answered_at)
      items.push({
        id: `${c.id}:took`,
        at: c.answered_at,
        emoji: "🔥",
        by: c.target_id,
        text: `${name(c.target_id)} accepted ${name(c.challenger_id) === "You" ? "your" : `${name(c.challenger_id)}'s`} challenge. It's on.`,
      });
    if (!self && c.entry && c.entry_at)
      items.push({
        id: `${c.id}:entry`,
        at: c.entry_at,
        emoji: KIND_EMOJI[c.kind],
        by: c.target_id,
        text: `${name(c.target_id)} delivered. The jury is out.`,
      });
    if ((s.state === "won" || s.state === "lost") && s.decidedAt) {
      const text =
        c.kind === "bet"
          ? `${name(s.winner!)} won the bet against ${obj(s.winner === c.challenger_id ? c.target_id : c.challenger_id)}.`
          : s.winner
            ? c.kind === "prophecy"
              ? `${name(c.target_id)}'s prophecy came true.`
              : `The jury ruled for ${obj(c.target_id)}.`
            : c.kind === "prophecy"
              ? `${name(c.target_id)}'s prophecy did not come true.`
              : `The jury was not convinced by ${obj(c.target_id)}.`;
      items.push({
        id: `${c.id}:ruled`,
        at: s.decidedAt,
        emoji: s.winner ? "🏆" : "⚖️",
        by: s.winner ?? c.target_id,
        text,
        points: s.winner ? s.points : undefined,
      });
    }
  }

  for (const r of input.reactions) {
    if (!ids.has(r.from_id) || !ids.has(r.to_id)) continue;
    const team = teamName(input.fans[r.to_id]);
    items.push({
      id: `react:${r.from_id}:${r.to_id}`,
      at: r.at,
      emoji: r.emoji,
      by: r.from_id,
      text: `${name(r.from_id)} ${r.emoji === "🫡" ? "saluted" : "reacted to"} ${team ? `${obj(r.to_id) === "you" ? "your" : `${obj(r.to_id)}'s`} ${team} allegiance` : `${obj(r.to_id)}`} ${r.emoji}`,
    });
  }

  for (const m of input.ledger) {
    if (!ids.has(m.earner)) continue;
    items.push({
      id: `ledger:${m.prompt_id}`,
      at: m.done_at,
      emoji: "🕵️",
      by: m.earner,
      text:
        m.family === "mission"
          ? `${name(m.earner)} pulled off a secret mission. What it was stays secret.`
          : `${name(m.earner)} did the dare.`,
    });
  }

  return items
    .sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id))
    .slice(0, input.limit ?? 12);
}

function teamName(abbr: string | undefined): string | undefined {
  return teamByAbbr(abbr ?? null)?.name;
}

// --------------------------------------------------------- bold calls

export interface CallPersona {
  /** The card's big word. */
  readonly title: string;
  /** One line of personality under the question. */
  readonly line: string;
  /** Which way the card leans in colour. */
  readonly tone: "home" | "away" | "gold" | "red" | "ice";
}

/**
 * **Every sealed pick has a personality.** The question, its scoring and its
 * rules are the template's, unchanged; this is only how the card introduces
 * itself.
 */
export function personaOf(
  prompt: Pick<Prompt, "id" | "askedBy">,
  host?: string,
): CallPersona {
  switch (prompt.id) {
    case "final-score":
      return {
        title: "The Big One",
        line: "Everybody remembers who called it. Everybody remembers who said 7–1 more.",
        tone: "gold",
      };
    case "first-team":
      return {
        title: "First Blood",
        line: "The first goal decides who is insufferable at the first intermission.",
        tone: "home",
      };
    case "overtime":
      return {
        title: "Sudden Death",
        line: "Three-on-three. A coin toss with skates.",
        tone: "red",
      };
    case "total-goals":
      return {
        title: "Goal Fest",
        line: "Goalie duel or pinball machine? Pick a number and live with it.",
        tone: "away",
      };
    case "host-beer":
      return {
        title: "The $19 Beer",
        line: `${host ? `${host}'s` : "The host's"} most expensive decision of the night. Ten points if you know them.`,
        tone: "gold",
      };
    case "refs":
      return {
        title: "Ref Rage",
        line: "It will happen. The only question is who cracks first.",
        tone: "red",
      };
    case "sides":
      return {
        title: "Pick a Side",
        line: "The losing side pays a harmless forfeit. Opt in, or don't.",
        tone: "ice",
      };
    default:
      return {
        title: prompt.askedBy ? "House Rules" : "Bold Call",
        line: "Asked by somebody here, so somebody here is going to be wrong.",
        tone: "ice",
      };
  }
}
