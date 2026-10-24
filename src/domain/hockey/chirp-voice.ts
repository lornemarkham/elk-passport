import { z } from "zod";
import { currentStorylines, type Storyline } from "./chirp-library";
import { acceptableChirp, type Fan } from "./chirp";
import { rivalry, teamByAbbr } from "./fans";

/**
 * **What a model is told, and what is kept of its answer.**
 *
 * Pure, so the persona and the rules can be read and tested without a key.
 * The model never sees anybody's email, account or anything but the first
 * names people chose for this night, their teams, and the game.
 *
 * It may only state as fact what it is handed as fact (`STORYLINES`, plus
 * long-settled Cup history it already knows); everything else it writes is
 * a joke and is shown labelled as one. Its output is validated, run through
 * `acceptableChirp`, and anything short is filled from the library.
 */

export const PERSONA = `You are CHIRP BOT, the heckler in a private group chat for friends going \
to an NHL game together. You are a sarcastic, hockey-obsessed commentator: funny, sharp, \
occasionally savage, playfully provocative, never corporate, never generic, never a cheerleader.

Hard rules — breaking any of them ruins the night:
- Roast TEAMS, records, droughts, trades, contracts, playoff history and sporting opinions. \
Never a person's body, looks, age, job, money, family, relationships, health, gender, \
sexuality, race, religion or nationality. Never anything cruel, discriminatory or abusive.
- Facts: state as fact ONLY what is in the FACTS list you are given, or long-settled Stanley \
Cup history (which years teams won or lost a Final). Never invent a score, a trade, an \
injury, a quote, a statistic or a news story. If you are not sure, make it an obvious joke \
or a question instead.
- Never pretend anyone said or did anything in the chat that you were not told.
- No slurs, no profanity stronger than "hell" or "damn", no hashtags, no emoji spam (one \
emoji at most), no links.
- One sentence or two short ones. Under 200 characters.
Return strict JSON only.`;

export interface GameContext {
  /** Tonight's two teams, by nickname: "Canucks", "Wild". */
  readonly home: string;
  readonly away: string;
}

function factsFor(teams: readonly (string | null)[], today: string): string {
  const relevant: Storyline[] = currentStorylines(today).filter((s) =>
    s.teams.some((t) => teams.includes(t)),
  );
  return relevant.length
    ? relevant.map((s) => `- ${s.fact}`).join("\n")
    : "- (none — stick to Cup history and jokes)";
}

function fanLine(fan: Fan): string {
  const team = teamByAbbr(fan.team);
  return team
    ? `${fan.name}, a ${team.city} ${team.name} fan`
    : `${fan.name}, who has not picked a team`;
}

/** Ask for three chirps `sender` might send about `target`. */
export function chirpsRequest(input: {
  readonly sender: Fan;
  readonly target: Fan;
  readonly game: GameContext;
  readonly today: string;
}): string {
  const { sender, target, game } = input;
  const why =
    sender.team && target.team ? rivalry(sender.team, target.team) : null;
  return `Tonight: ${game.home} vs ${game.away} at the ${game.home}' home arena. These are \
the teams PLAYING, not anybody's favourite team.

Write three different chirps that ${fanLine(sender)}, could send in the group chat at \
${fanLine(target)}. Address ${target.name} by name. Aim at their team (its history, \
rivalries, droughts, current storylines), not at them.${why ? ` Their teams are rivals: ${why}.` : ""}

FACTS (the only recent facts you may state):
${factsFor([sender.team, target.team], input.today)}

JSON: {"chirps": ["...", "...", "..."]}`;
}

export type LineOccasion =
  | {
      readonly kind: "welcome";
      readonly fan: Fan;
      readonly previous: string | null;
    }
  | {
      readonly kind: "challenge" | "bold";
      readonly fan: Fan;
      readonly said: string;
    }
  | {
      readonly kind: "rivalry";
      readonly a: Fan;
      readonly b: Fan;
      readonly said: string;
    }
  | {
      /** A PLAY challenge thrown, or taken on. */
      readonly kind: "dare";
      readonly stage: "issued" | "accepted";
      readonly challenger: Fan;
      readonly target: Fan;
      /** What it is, in words: "a bet that the Wild win". */
      readonly what: string;
    };

/** Ask for one line for a moment in the chat. */
export function lineRequest(input: {
  readonly occasion: LineOccasion;
  readonly game: GameContext;
  readonly fans: readonly Fan[];
  readonly today: string;
}): string {
  const { occasion, game } = input;
  const room = input.fans.map(fanLine).join("; ");
  const teams = input.fans.map((f) => f.team);
  let ask: string;
  switch (occasion.kind) {
    case "welcome": {
      const team = teamByAbbr(occasion.fan.team);
      const was = teamByAbbr(occasion.previous);
      ask = was
        ? `${occasion.fan.name} just switched their favourite team from the ${was.name} to the ${team?.name}. Heckle the switch.`
        : `${occasion.fan.name} just declared they are a ${team?.city} ${team?.name} fan. Welcome them with a team-specific joke. If their team is a rival of ${game.home} or ${game.away}, that is excellent material.`;
      break;
    }
    case "challenge":
      ask = `${occasion.fan.name} just made a bet or challenge in the chat: "${occasion.said}". React like a commentator who will hold everyone to it. Do not take a side on the outcome.`;
      break;
    case "bold":
      ask = `${occasion.fan.name} just made a bold prediction: "${occasion.said}". React to how bold it is. Do not say whether it will happen.`;
      break;
    case "dare": {
      const self = occasion.challenger.id === occasion.target.id;
      const strict =
        " Do NOT state any statistic, streak, record, standing or score — not even a joking one. Keep who said what exactly as written above.";
      ask =
        occasion.stage === "accepted"
          ? `${fanLine(occasion.target)} just ACCEPTED a challenge from ${fanLine(occasion.challenger)}: ${occasion.what}. Escalate the rivalry like a commentator. Do not predict who wins.`
          : self
            ? `${fanLine(occasion.challenger)} just volunteered, unprompted, for ${occasion.what}. React to the nerve of it. Do not predict how it goes.`
            : `${fanLine(occasion.challenger)} just challenged ${fanLine(occasion.target)} to ${occasion.what}. Stir the pot and dare ${occasion.target.name} to take it. Do not predict who wins.`;
      ask += strict;
      break;
    }
    case "rivalry": {
      const why =
        occasion.a.team && occasion.b.team
          ? rivalry(occasion.a.team, occasion.b.team)
          : null;
      ask = `${fanLine(occasion.a)} and ${fanLine(occasion.b)} are going at it: "${occasion.said}". Stir it up${why ? ` — their teams' feud is ${why}` : ""}.`;
      break;
    }
  }
  return `Tonight: ${game.home} vs ${game.away}. Those are the teams PLAYING, not anybody's favourite.
In the chat: ${room}.

${ask}

FACTS (the only recent facts you may state):
${factsFor(teams, input.today)}

JSON: {"line": "..."}`;
}

const chirpsShape = z.object({ chirps: z.array(z.unknown()).max(6) });
const lineShape = z.object({ line: z.unknown() });

/** The acceptable chirps in a model's answer, at most three, duplicates dropped. */
export function readChirps(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = chirpsShape.safeParse(JSON.parse(raw));
    if (!parsed.success) return [];
    const kept = parsed.data.chirps
      .filter(acceptableChirp)
      .map((c) => c.trim());
    return [...new Set(kept)].slice(0, 3);
  } catch {
    return [];
  }
}

/** The model's one line, if it is acceptable. */
export function readLine(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = lineShape.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const line = parsed.data.line;
    return acceptableChirp(line) ? line.trim() : null;
  } catch {
    return null;
  }
}
