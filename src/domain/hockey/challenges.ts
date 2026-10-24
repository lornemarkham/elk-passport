import type {
  Participant,
  Prompt,
  Response,
  ResponseValue,
} from "@/experience-lab/core/types";
import { rivalry, teamByAbbr, teamByName, type NhlTeam } from "./fans";

/**
 * **Challenges: one person calling out another, on the record.**
 *
 * PLAY used to be a questionnaire everybody filled in alone. A challenge is
 * the opposite: it names somebody, it waits for them, and what they do about
 * it is something the whole group sees. Five kinds, three mechanics:
 *
 * - **bet** — "the Wild win, and I'll prove it". The challenger picks a side
 *   of one of the night's own questions (who wins, first goal, overtime,
 *   over/under 5.5 goals); accepting takes the other side. Settled by the
 *   host's call of that question — the same call the sealed picks wait on —
 *   so nobody judges their own bet.
 * - **defend / commentary / hottake** — a performance. The target accepts,
 *   writes it (their defence of their team, their play-by-play, their take),
 *   and a **jury** of everybody else rules. A person can also volunteer one
 *   (challenger = target), which is how a Flames fan defends themself before
 *   anybody asks.
 * - **prophecy** — one ridiculous, measurable prediction of your own, made
 *   in public before puck drop. The jury rules once the game has started.
 *
 * The rules a cheater would want to break are enforced by the database
 * (`docs/product/hockey/mayhem-migration.sql`): you write only your own
 * challenge, only the target answers it, nobody votes on their own, one
 * challenge per pair per kind, a decline is seen by nobody but the two of
 * you. This file is the same rules for the page — and the one place points
 * are worked out, from rows every member reads alike, so everybody's Sycle
 * Cup is the same Sycle Cup.
 */

export const CHALLENGE_KINDS = [
  "bet",
  "defend",
  "commentary",
  "hottake",
  "prophecy",
] as const;
export type ChallengeKind = (typeof CHALLENGE_KINDS)[number];

export const MARKETS = ["winner", "first-goal", "overtime", "goals"] as const;
export type Market = (typeof MARKETS)[number];

export const SIDES = ["home", "away", "yes", "no", "over", "under"] as const;
export type Side = (typeof SIDES)[number];

/** The over/under line on total goals. Fixed, so a bet is one tap. */
export const GOALS_LINE = 5.5;

/** Which of the night's questions a market rides on. */
export const MARKET_PROMPT: Readonly<Record<Market, string>> = {
  winner: "final-score",
  "first-goal": "first-team",
  overtime: "overtime",
  goals: "total-goals",
};

const MARKET_SIDES: Readonly<Record<Market, readonly [Side, Side]>> = {
  winner: ["home", "away"],
  "first-goal": ["home", "away"],
  overtime: ["yes", "no"],
  goals: ["over", "under"],
};

export const PERFORMANCES: ReadonlySet<ChallengeKind> = new Set([
  "defend",
  "commentary",
  "hottake",
]);

/** Points, all of them fixed: nothing a member sends decides what anything is worth. */
export const POINTS = {
  bet: 3,
  performance: 3,
  prophecy: 5,
} as const;

/** The most a person can win from challenges in one night. */
export const CHALLENGE_CAP = 12;
/** The most challenges one person can issue in one night (the database's limit too). */
export const ISSUE_LIMIT = 8;
/** Secret missions and dares: at most this many count, per person, per night. */
export const MISSION_CAP = 2;

/** Minutes after puck drop: performances close at the final horn, prophecies the morning after. */
export const PERFORMANCE_CLOSES = 165;
export const PROPHECY_CLOSES = 900;

// ------------------------------------------------------------------ rows

export interface ChallengeRow {
  readonly id: string;
  readonly kind: ChallengeKind;
  readonly challenger_id: string;
  readonly target_id: string;
  readonly market: Market | null;
  readonly side: Side | null;
  readonly taunt: string | null;
  readonly status: "open" | "accepted" | "declined" | "withdrawn";
  readonly entry: string | null;
  readonly entry_at: string | null;
  readonly answered_at: string | null;
  readonly created_at: string;
}

export interface VoteRow {
  readonly challenge_id: string;
  readonly voter_id: string;
  readonly verdict: boolean;
  readonly at: string;
}

/** Somebody reacting to somebody else's team (🫡 🤡 🧂 🔥 🪦). */
export interface TeamReactionRow {
  readonly from_id: string;
  readonly to_id: string;
  readonly emoji: string;
  readonly at: string;
}

export const TEAM_REACTIONS = ["🫡", "🤡", "🧂", "🔥", "🪦"] as const;
export const TEAM_REACTION_WORDS: Readonly<Record<string, string>> = {
  "🫡": "Respect",
  "🤡": "Clown",
  "🧂": "Salty",
  "🔥": "Bold",
  "🪦": "RIP",
};

/**
 * A completed secret mission or dare, from the database's own ledger
 * (`passport_occasion_mission_ledger`): its target said yes, its mastermind
 * confirmed, the target had opted in, and they are two different people.
 * Everyone reads the same ledger, whoever can see the mission itself.
 */
export interface LedgerRow {
  readonly prompt_id: string;
  readonly earner: string;
  readonly family: "mission" | "dare";
  readonly asked_by: string;
  readonly points: number | null;
  readonly done_at: string;
}

export interface PlayRows {
  readonly challenges: readonly ChallengeRow[];
  readonly votes: readonly VoteRow[];
  readonly teamReactions: readonly TeamReactionRow[];
  readonly ledger: readonly LedgerRow[];
}

/** What the page gets: the rows, and whether the database has them at all. */
export interface PlayRoom extends PlayRows {
  /** mayhem-migration.sql is applied. */
  readonly available: boolean;
}

export const NO_PLAY: PlayRoom = {
  available: false,
  challenges: [],
  votes: [],
  teamReactions: [],
  ledger: [],
};

// ------------------------------------------------------------------ game

export interface Game {
  /** Tonight's teams by nickname, as the night's subtitle has them. */
  readonly home: string;
  readonly away: string;
  readonly homeTeam: NhlTeam | null;
  readonly awayTeam: NhlTeam | null;
}

export function gameOf(home: string, away: string): Game {
  return {
    home,
    away,
    homeTeam: teamByName(home),
    awayTeam: teamByName(away),
  };
}

/**
 * Which side of tonight a fan of `team` is on. A Canucks fan is home, a
 * Wild fan away; a Flames fan at a Canucks game is against whichever team
 * is their rival — and with no rivalry either way, nobody's.
 */
export function naturalSide(
  team: string | null,
  game: Game,
): "home" | "away" | null {
  if (!team) return null;
  const home = game.homeTeam?.abbr;
  const away = game.awayTeam?.abbr;
  if (team === home) return "home";
  if (team === away) return "away";
  if (home && rivalry(team, home)) return "away";
  if (away && rivalry(team, away)) return "home";
  return null;
}

/** A fan of somebody who isn't playing tonight. */
export function isOutsider(team: string | null, game: Game): boolean {
  return (
    Boolean(team) &&
    team !== game.homeTeam?.abbr &&
    team !== game.awayTeam?.abbr
  );
}

// ------------------------------------------------------------ wording

export function sideWords(market: Market, side: Side, game: Game): string {
  switch (market) {
    case "winner":
      return `the ${side === "home" ? game.home : game.away} win`;
    case "first-goal":
      return `the ${side === "home" ? game.home : game.away} score first`;
    case "overtime":
      return side === "yes" ? "it goes to overtime" : "it's over in regulation";
    case "goals":
      return `${side === "over" ? "over" : "under"} ${GOALS_LINE} goals`;
  }
}

export function otherSide(market: Market, side: Side): Side {
  const [a, b] = MARKET_SIDES[market];
  return side === a ? b : a;
}

export const MARKET_LABEL: Readonly<Record<Market, string>> = {
  winner: "Who wins",
  "first-goal": "First goal",
  overtime: "Overtime?",
  goals: `Over/under ${GOALS_LINE} goals`,
};

export const KIND_TITLE: Readonly<Record<ChallengeKind, string>> = {
  bet: "The Bet",
  defend: "Enemy Territory",
  commentary: "The Commentator",
  hottake: "The Hot Take",
  prophecy: "The Prophecy",
};

export const KIND_EMOJI: Readonly<Record<ChallengeKind, string>> = {
  bet: "🤝",
  defend: "🛡️",
  commentary: "🎙️",
  hottake: "🌶️",
  prophecy: "🔮",
};

/** What the target has to do, in a line. */
export function kindAsk(kind: ChallengeKind, teamName?: string): string {
  switch (kind) {
    case "bet":
      return "Take the other side. Loser gets nothing but the receipts.";
    case "defend":
      return teamName
        ? `Defend the ${teamName}' honour in front of the group. The jury decides.`
        : "Defend your team's honour in front of the group. The jury decides.";
    case "commentary":
      return "Call a goal like a broadcaster who has lost all perspective. The jury decides.";
    case "hottake":
      return "One take so outrageous the jury has to rule on it.";
    case "prophecy":
      return "One ridiculous, measurable prediction, on the record before puck drop.";
  }
}

/** The jury's two buttons. */
export function juryWords(kind: ChallengeKind): { yes: string; no: string } {
  switch (kind) {
    case "defend":
      return { yes: "Honour defended", no: "Not convinced" };
    case "commentary":
      return { yes: "Hall of fame call", no: "Mute button" };
    case "hottake":
      return { yes: "Certified spicy 🌶️", no: "Lukewarm" };
    case "prophecy":
      return { yes: "It came true", no: "Didn't happen" };
    case "bet":
      return { yes: "Yes", no: "No" };
  }
}

// --------------------------------------------------------- validation

export interface IssueInput {
  readonly kind: ChallengeKind;
  readonly targetId: string;
  readonly market?: Market;
  readonly side?: Side;
  readonly taunt?: string;
  readonly entry?: string;
}

/**
 * Is this a challenge `byId` may issue right now? The database asks the same
 * questions; this one answers in words a person can read.
 */
export function issueProblem(
  input: IssueInput,
  byId: string,
  ctx: {
    readonly memberIds: readonly string[];
    readonly existing: readonly ChallengeRow[];
    readonly startsAt: string;
    readonly now: Date;
    /** Template questions this night has (a bet rides on one). */
    readonly promptIds: readonly string[];
  },
): string | null {
  const { kind } = input;
  if (!ctx.memberIds.includes(input.targetId))
    return "Challenge somebody who is actually on this night.";
  const self = input.targetId === byId;
  const start = Date.parse(ctx.startsAt);
  const now = ctx.now.getTime();
  if (kind === "bet") {
    if (self) return "Betting against yourself is a cry for help.";
    if (!input.market || !input.side) return "Pick what you're betting on.";
    if (!MARKET_SIDES[input.market].includes(input.side))
      return "That isn't a side of that bet.";
    if (!ctx.promptIds.includes(MARKET_PROMPT[input.market]))
      return "That question isn't on tonight.";
    if (now >= start) return "Bets close at puck drop.";
  } else if (kind === "prophecy") {
    if (!self) return "A prophecy is your own.";
    if (!input.entry?.trim()) return "Say what's going to happen.";
    if (now >= start) return "Prophecies close at puck drop.";
  } else {
    if (now >= start + PERFORMANCE_CLOSES * 60_000)
      return "The night's over. Save it for the next one.";
    if (self && !input.entry?.trim())
      return "Volunteering means going first. Write it.";
  }
  const mine = ctx.existing.filter((c) => c.challenger_id === byId);
  if (mine.length >= ISSUE_LIMIT)
    return `That's ${ISSUE_LIMIT} challenges from you tonight. Let somebody else start something.`;
  if (
    ctx.existing.some(
      (c) =>
        c.challenger_id === byId &&
        c.target_id === input.targetId &&
        c.kind === kind &&
        (c.market ?? null) === (input.market ?? null),
    )
  )
    return self
      ? "You've already done that one tonight."
      : "You've already thrown that one at them.";
  return null;
}

// --------------------------------------------------------- settlement

export interface MarketFacts {
  /** The question's result, once it is known (the engine's `knownPrompts`). */
  readonly resolution: ResponseValue | undefined;
  /** When it becomes known: the phase the question resolves at. */
  readonly resolvesAtPhaseId?: string;
}

/** Which side of a market the result came out on, or null for "no result / no contest". */
export function outcomeOf(
  market: Market,
  resolution: ResponseValue | undefined,
): Side | null {
  if (resolution === undefined || resolution === null) return null;
  switch (market) {
    case "winner": {
      if (!Array.isArray(resolution) || resolution.length !== 2) return null;
      const [h, a] = resolution as readonly number[];
      return h > a ? "home" : a > h ? "away" : null;
    }
    case "first-goal":
      return resolution === "canucks"
        ? "home"
        : resolution === "opponent"
          ? "away"
          : null;
    case "overtime":
      return resolution === true ? "yes" : resolution === false ? "no" : null;
    case "goals":
      return typeof resolution === "number"
        ? resolution > GOALS_LINE
          ? "over"
          : "under"
        : null;
  }
}

export interface Settled {
  readonly challenge: ChallengeRow;
  /** Pending: still waiting on the target, the result or the jury. */
  readonly state:
    "waiting" | "on" | "awaiting-entry" | "jury" | "won" | "lost" | "void";
  /** Who won it, once it is decided. */
  readonly winner: string | null;
  readonly points: number;
  /** Everybody who judges it (performances and prophecies). */
  readonly jurors: readonly string[];
  readonly votes: readonly VoteRow[];
  readonly yes: number;
  readonly no: number;
  /** The jury can vote right now. */
  readonly voting: boolean;
  /** When the jury closes, ISO. */
  readonly closesAt: string | null;
  /** When it was decided, ISO, as best the rows can say. */
  readonly decidedAt: string | null;
}

/**
 * Where one challenge stands, from the rows alone and the clock — the same
 * answer for every member, because every member reads the same rows.
 */
export function settle(
  challenge: ChallengeRow,
  ctx: {
    readonly memberIds: readonly string[];
    readonly votes: readonly VoteRow[];
    readonly startsAt: string;
    readonly now: Date;
    /** For a bet: the question it rides on, as the group may know it now. */
    readonly market?: (
      market: Market,
    ) => MarketFacts & { readonly knownAt?: string };
  },
): Settled {
  const base = {
    challenge,
    winner: null,
    points: 0,
    jurors: [] as string[],
    votes: [] as VoteRow[],
    yes: 0,
    no: 0,
    voting: false,
    closesAt: null,
    decidedAt: null,
  };
  if (challenge.status === "open") return { ...base, state: "waiting" };
  if (challenge.status !== "accepted") return { ...base, state: "void" };

  if (challenge.kind === "bet") {
    if (!challenge.market || !challenge.side) return { ...base, state: "void" };
    const facts = ctx.market?.(challenge.market);
    const outcome = outcomeOf(challenge.market, facts?.resolution);
    if (facts?.resolution === undefined) return { ...base, state: "on" };
    if (!outcome)
      return { ...base, state: "void", decidedAt: facts.knownAt ?? null };
    const winner =
      outcome === challenge.side
        ? challenge.challenger_id
        : challenge.target_id;
    return {
      ...base,
      state: "won",
      winner,
      points: POINTS.bet,
      decidedAt: facts.knownAt ?? null,
    };
  }

  // Performances and prophecies: a jury of everybody but the person judged.
  const jurors = ctx.memberIds.filter((id) => id !== challenge.target_id);
  const votes = ctx.votes.filter(
    (v) => v.challenge_id === challenge.id && jurors.includes(v.voter_id),
  );
  const yes = votes.filter((v) => v.verdict).length;
  const no = votes.length - yes;
  const start = Date.parse(ctx.startsAt);
  const prophecy = challenge.kind === "prophecy";
  const closesAtMs =
    start + (prophecy ? PROPHECY_CLOSES : PERFORMANCE_CLOSES) * 60_000;
  const closesAt = new Date(closesAtMs).toISOString();
  const jury = { ...base, jurors, votes, yes, no, closesAt };
  const now = ctx.now.getTime();
  if (!challenge.entry)
    return now >= closesAtMs
      ? { ...jury, state: "void", decidedAt: closesAt }
      : { ...jury, state: "awaiting-entry" };
  const everyone = jurors.length > 0 && votes.length >= jurors.length;
  const closed = now >= closesAtMs || everyone;
  // A prophecy is judged once there is a game to judge it by.
  const opens = prophecy ? start : 0;
  if (!closed) return { ...jury, state: "jury", voting: now >= opens };
  const lastVote =
    votes
      .map((v) => v.at)
      .sort()
      .at(-1) ?? null;
  const decidedAt = everyone && now < closesAtMs ? lastVote : closesAt;
  if (yes > no)
    return {
      ...jury,
      state: "won",
      winner: challenge.target_id,
      points: prophecy ? POINTS.prophecy : POINTS.performance,
      decidedAt,
    };
  return { ...jury, state: votes.length ? "lost" : "void", decidedAt };
}

// ------------------------------------------------------------- the Cup

/** Score-line ids live in a namespace no stored question can have (":" is refused). */
export const CUP_PREFIX = "cup:";
export const isCupLine = (promptId: string) => promptId.startsWith(CUP_PREFIX);

/**
 * Settled challenges and confirmed missions, as questions the engine already
 * knows how to score: one resolved yes/no question per award, answered "yes"
 * by whoever earned it. The leaderboard, awards, recap and series Cup then
 * count them with no change to the engine — and since every member reads the
 * same challenge rows and the same ledger, every member counts the same
 * points.
 *
 * The caps are applied here, in the order things were started, so they are
 * deterministic too.
 */
export function cupLines(
  play: PlayRows,
  ctx: {
    readonly people: readonly Participant[];
    readonly startsAt: string;
    readonly now: Date;
    readonly game: Game;
    readonly market: (
      market: Market,
    ) => MarketFacts & { readonly knownAt?: string };
  },
): { prompts: Prompt[]; responses: Response[]; settled: Settled[] } {
  const memberIds = ctx.people.map((p) => p.id);
  const name = (id: string) =>
    ctx.people.find((p) => p.id === id)?.name ?? "somebody";
  const prompts: Prompt[] = [];
  const responses: Response[] = [];
  const earned = new Map<string, number>();

  const settled = [...play.challenges]
    .filter(
      (c) =>
        memberIds.includes(c.challenger_id) && memberIds.includes(c.target_id),
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((c) =>
      settle(c, {
        memberIds,
        votes: play.votes,
        startsAt: ctx.startsAt,
        now: ctx.now,
        market: ctx.market,
      }),
    );

  for (const s of settled) {
    if (s.state !== "won" || !s.winner) continue;
    const so_far = earned.get(s.winner) ?? 0;
    const points = Math.min(s.points, CHALLENGE_CAP - so_far);
    if (points <= 0) continue;
    earned.set(s.winner, so_far + points);
    const c = s.challenge;
    const other = s.winner === c.challenger_id ? c.target_id : c.challenger_id;
    const note =
      c.kind === "bet"
        ? `Won a bet vs ${name(other)}`
        : c.kind === "prophecy"
          ? "Prophecy came true"
          : `${KIND_TITLE[c.kind]}: the jury agreed`;
    const id = `${CUP_PREFIX}${c.id}`;
    const facts =
      c.kind === "bet" && c.market ? ctx.market(c.market) : undefined;
    prompts.push({
      id,
      question:
        c.kind === "bet" && c.market && c.side
          ? `${name(c.challenger_id)} bet ${name(c.target_id)} ${sideWords(c.market, c.side, ctx.game)}`
          : `${KIND_TITLE[c.kind]} — ${name(c.target_id)}`,
      kind: "boolean",
      phaseId: "before",
      reveal: "immediate",
      resolution: true,
      // A bet's points appear when its question's answer may (`knownPrompts`).
      resolvesAtPhaseId: facts?.resolvesAtPhaseId,
      scoring: { points, label: note },
    });
    responses.push({
      promptId: id,
      participantId: s.winner,
      value: true,
      at: s.decidedAt ?? c.created_at,
    });
  }

  const missions = new Map<string, number>();
  for (const row of [...play.ledger].sort((a, b) =>
    a.done_at.localeCompare(b.done_at),
  )) {
    if (!memberIds.includes(row.earner) || !memberIds.includes(row.asked_by))
      continue;
    const count = missions.get(row.earner) ?? 0;
    if (count >= MISSION_CAP) continue;
    missions.set(row.earner, count + 1);
    const max = row.family === "mission" ? 8 : 5;
    const points = Math.max(1, Math.min(max, row.points ?? 5));
    const id = `${CUP_PREFIX}m:${row.prompt_id}`;
    prompts.push({
      id,
      question:
        row.family === "mission"
          ? `${name(row.earner)} pulled off a secret mission`
          : `${name(row.earner)} did the dare`,
      kind: "boolean",
      phaseId: "before",
      reveal: "immediate",
      resolution: true,
      scoring: {
        points,
        label: row.family === "mission" ? "Secret mission" : "Dare",
      },
    });
    responses.push({
      promptId: id,
      participantId: row.earner,
      value: true,
      at: row.done_at,
    });
  }

  return { prompts, responses, settled };
}

// -------------------------------------------------------- the rivalry

export interface Rivalry {
  readonly kind: "enemy" | "divided" | "united" | "undeclared";
  readonly kicker: string;
  readonly title: string;
  readonly lines: readonly string[];
  /** The person the banner is about, when it is about one person. */
  readonly about?: string;
  /** Their team's colours lead the banner. */
  readonly team?: NhlTeam;
  /** A real rivalry between that team and tonight's, from `fans.ts`. */
  readonly feud?: string;
}

/**
 * **What tonight's allegiances add up to, for the person looking.** Built
 * from who actually declared what — no joke here is about a name, only about
 * a team somebody picked. A fan of a team that isn't playing is the best
 * story there is; a split room is the next best; a room that agrees is told
 * so, and asked to pick a fight anyway.
 */
export function rivalryFor(
  viewerId: string,
  people: readonly Participant[],
  fans: Readonly<Record<string, string>>,
  game: Game,
  ctx: { readonly venue: string; readonly untilStart: string | null },
): Rivalry {
  const teamOf = (id: string) => fans[id] ?? null;
  const outsiders = people.filter((p) => isOutsider(teamOf(p.id), game));
  const mine = teamOf(viewerId);
  const others = people.filter((p) => p.id !== viewerId);
  const homeAbbr = game.homeTeam?.abbr;
  const awayAbbr = game.awayTeam?.abbr;
  const clock = ctx.untilStart ? ` The group has ${ctx.untilStart}` : "";

  if (isOutsider(mine, game)) {
    const team = teamByAbbr(mine)!;
    const feud =
      (homeAbbr && rivalry(team.abbr, homeAbbr)) ||
      (awayAbbr && rivalry(team.abbr, awayAbbr)) ||
      undefined;
    return {
      kind: "enemy",
      kicker: "🔥 Enemy territory",
      title: `You're a ${team.name} fan at a ${game.home} game.`,
      lines: [
        others.length
          ? `${others.length === 1 ? "One person" : `${others.length} people`} ${ctx.untilStart ? `have ${ctx.untilStart}` : "have all night"} to make you regret it.`
          : "Nobody else is here yet. Enjoy it while it lasts.",
        "Defend yourself — or go on the attack.",
      ],
      about: viewerId,
      team,
      feud,
    };
  }

  if (outsiders.length > 0) {
    const first = outsiders[0];
    const team = teamByAbbr(teamOf(first.id))!;
    const feud =
      (homeAbbr && rivalry(team.abbr, homeAbbr)) ||
      (awayAbbr && rivalry(team.abbr, awayAbbr)) ||
      undefined;
    const more = outsiders.length - 1;
    return {
      kind: "enemy",
      kicker: "🔥 Enemy territory",
      title: `A ${team.name} fan has entered ${ctx.venue}.`,
      lines: [
        `${first.name} has willingly agreed to attend a ${game.home} game.${more > 0 ? ` And ${more === 1 ? "one more neutral" : `${more} more neutrals`} came with them.` : ""}`,
        `${clock ? `${clock.trim()} to make them question that decision.` : "Make them question that decision."}`,
      ],
      about: first.id,
      team,
      feud,
    };
  }

  const home = people.filter((p) => teamOf(p.id) === homeAbbr);
  const away = people.filter((p) => teamOf(p.id) === awayAbbr);
  if (home.length > 0 && away.length > 0) {
    const feud = homeAbbr && awayAbbr ? rivalry(homeAbbr, awayAbbr) : null;
    return {
      kind: "divided",
      kicker: "⚔️ House divided",
      title: `${home.length} ${game.home} ${home.length === 1 ? "fan" : "fans"}. ${away.length} ${game.away} ${away.length === 1 ? "fan" : "fans"}.`,
      lines: [
        "Same row. Opposite sides. One of you is going home unhappy.",
        clock ? `${clock.trim()} to settle it with words first.` : "Settle it.",
      ],
      team:
        mine === awayAbbr
          ? (game.awayTeam ?? undefined)
          : (game.homeTeam ?? undefined),
      feud: feud ?? undefined,
    };
  }

  const declared = people.filter((p) => teamOf(p.id));
  if (declared.length > 0) {
    const team = teamByAbbr(teamOf(declared[0].id))!;
    const quiet = people.length - declared.length;
    return {
      kind: "united",
      kicker: "🤝 United front",
      title:
        quiet > 0
          ? `${declared.length} ${team.name} ${declared.length === 1 ? "fan" : "fans"}, and ${quiet} ${quiet === 1 ? "person who won't say" : "people who won't say"}.`
          : `Everybody here is a ${team.name} fan.`,
      lines: [
        quiet > 0
          ? "Undeclared is a choice. A suspicious one."
          : "Chirp Bot finds this deeply boring. Pick a fight anyway.",
      ],
      team,
    };
  }

  return {
    kind: "undeclared",
    kicker: "Who do you bleed for?",
    title: "Nobody has picked a team.",
    lines: [
      "Pick one — any of the 32. Allegiance changes the jokes, the challenges and who's coming for you.",
    ],
  };
}

// ------------------------------------------------------ tonight's chaos

export interface ChaosCard {
  readonly key: string;
  readonly kind: ChallengeKind;
  readonly targetId: string;
  readonly market?: Market;
  readonly side?: Side;
  readonly title: string;
  readonly pitch: string;
  readonly cta: string;
}

/**
 * **Three things to start, for this person, tonight.** Chosen from who is
 * actually here and what they support — the outsider gets challenged to
 * defend their team, the fan on the other side gets a bet, the quiet one
 * gets the microphone. Never one they've already sent, rotated by the day
 * so a second look tomorrow is a different three.
 */
export function chaosFor(
  viewerId: string,
  people: readonly Participant[],
  fans: Readonly<Record<string, string>>,
  game: Game,
  existing: readonly ChallengeRow[],
  ctx: {
    readonly beforeStart: boolean;
    readonly beforeHorn: boolean;
    readonly day: string;
  },
): ChaosCard[] {
  if (!ctx.beforeHorn) return [];
  const others = people.filter((p) => p.id !== viewerId);
  const mine = fans[viewerId] ?? null;
  const mySide = naturalSide(mine, game);
  const sent = (kind: ChallengeKind, target: string, market?: Market) =>
    existing.some(
      (c) =>
        c.challenger_id === viewerId &&
        c.target_id === target &&
        c.kind === kind &&
        (c.market ?? null) === (market ?? null),
    );
  const teamName = (id: string) => teamByAbbr(fans[id])?.name;
  const cards: ChaosCard[] = [];
  const rotate = <T>(items: readonly T[]): T[] => {
    if (items.length === 0) return [];
    const n = [...`${ctx.day}${viewerId}`].reduce(
      (s, ch) => (s * 31 + ch.charCodeAt(0)) >>> 0,
      7,
    );
    const k = n % items.length;
    return [...items.slice(k), ...items.slice(0, k)];
  };

  // An outsider in the room: make them defend it.
  for (const p of rotate(
    others.filter((o) => isOutsider(fans[o.id] ?? null, game)),
  )) {
    if (sent("defend", p.id)) continue;
    const t = teamName(p.id);
    cards.push({
      key: `defend:${p.id}`,
      kind: "defend",
      targetId: p.id,
      title: "Enemy Territory",
      pitch: `${p.name} is a ${t} fan at a ${game.home} game. Make them defend the ${t}' honour in front of everybody.`,
      cta: `Challenge ${p.name}`,
    });
    break;
  }

  // You are the outsider: go first.
  if (isOutsider(mine, game) && !sent("defend", viewerId)) {
    const t = teamByAbbr(mine)?.name;
    cards.push({
      key: "defend:self",
      kind: "defend",
      targetId: viewerId,
      title: "Defend Yourself",
      pitch: `Get your defence of the ${t} on the record before anybody asks. The jury rules.`,
      cta: "Defend the honour",
    });
  }

  // A bet against somebody on the other side — or anybody at all.
  if (ctx.beforeStart) {
    const opposite = others.filter((o) => {
      const theirs = naturalSide(fans[o.id] ?? null, game);
      return theirs && mySide && theirs !== mySide;
    });
    const pool = opposite.length ? opposite : others;
    const side: Side = mySide ?? "away";
    for (const p of rotate(pool)) {
      if (sent("bet", p.id, "winner")) continue;
      cards.push({
        key: `bet:${p.id}`,
        kind: "bet",
        targetId: p.id,
        market: "winner",
        side,
        title: "The Bet",
        pitch: `Bet ${p.name} that ${sideWords("winner", side, game)}. They take the other side. The host's call settles it.`,
        cta: `Bet ${p.name}`,
      });
      break;
    }
  }

  // The microphone, or a take, for somebody who hasn't been asked yet.
  const asked = new Set(
    existing
      .filter((c) => c.challenger_id === viewerId)
      .map((c) => c.target_id),
  );
  for (const p of rotate(
    [...others].sort(
      (a, b) => Number(asked.has(a.id)) - Number(asked.has(b.id)),
    ),
  )) {
    if (!sent("commentary", p.id)) {
      cards.push({
        key: `commentary:${p.id}`,
        kind: "commentary",
        targetId: p.id,
        title: "The Commentator",
        pitch: `Dare ${p.name} to call a ${game.home} goal like a broadcaster who has lost all perspective.`,
        cta: `Hand ${p.name} the mic`,
      });
      break;
    }
    if (!sent("hottake", p.id)) {
      cards.push({
        key: `hottake:${p.id}`,
        kind: "hottake",
        targetId: p.id,
        title: "The Hot Take",
        pitch: `Dare ${p.name} to post a take so outrageous the jury has to rule on it.`,
        cta: `Dare ${p.name}`,
      });
      break;
    }
  }

  if (ctx.beforeStart && !sent("prophecy", viewerId)) {
    cards.push({
      key: "prophecy:self",
      kind: "prophecy",
      targetId: viewerId,
      title: "The Prophecy",
      pitch:
        "One ridiculous but measurable prediction, on the record. The jury rules after puck drop. +5 if it happens.",
      cta: "Make a prophecy",
    });
  }

  return cards.slice(0, 3);
}
