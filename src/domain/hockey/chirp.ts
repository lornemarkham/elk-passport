import {
  ARRIVALS,
  BOLD_LINES,
  CHALLENGE_LINES,
  CHIRPS,
  COUCH_LINES,
  GENERIC_CHIRPS,
  GENERIC_WELCOMES,
  LAST_CALL,
  LIBRARY,
  LINE_STORYLINE,
  NO_TEAM_CHIRPS,
  PICKS_LINES,
  PROMPTS,
  PROMPT_BY_ID,
  RIVAL_CHIRPS,
  RIVALRY_LINES,
  STORYLINE_BY_ID,
  SWITCHES,
  SWITCH_LINES,
  MISSION_LINES,
  DONE_LINES,
  LEAD_LINES,
  CHALLENGE_ISSUED,
  CHALLENGE_TAKEN,
  PROPHECY_LINES,
  RULED_BET,
  RULED_WON,
  RULED_LOST,
  RULED_PROPHECY,
  RULED_FALSE_PROPHECY,
  WORST_PICK_LINES,
  VERDICT_LINES,
  WELCOMES,
  currentStorylines,
  type LibraryLine,
} from "./chirp-library";
import { pairKey, rivalry, teamByAbbr, teamsMentioned } from "./fans";

/**
 * **Chirp Bot — the chat's heckler, in the night's own conversation.**
 *
 * Not a second chat. Chirp Bot's lines are rows in the same
 * `passport_occasion_moments` table, of kind `chirp`, read and reacted to
 * like anybody's, and seen only by members of the night. This file is the
 * pure half: when it speaks, what it says, how often, and how a stored line
 * becomes the words on the page. The server half (`_server/chirp.ts`)
 * reads and writes.
 *
 * ## When it speaks — and when it does not
 *
 * Only after a person does something: declares a team, arrives, says a
 * thing worth heckling (a bet, a bold call, a rival fan), or opens the chat
 * before the game when a fresh question is due. Never because of another
 * Chirp Bot line, so it cannot talk to itself. Every line has a `bot_key`
 * that the database keeps unique per night, so two phones doing the same
 * thing at the same second produce one line, not two.
 *
 * ## Whose line it is
 *
 * The database cannot tell this server from a member holding their own
 * session (every write runs as the person, never the service role). So a
 * line counts as Chirp Bot's only if the server can prove it wrote it:
 * a library line is stored as its id and re-rendered here on every read (a
 * forged row can only say something already in the library); a model's line
 * carries an HMAC the server checks. Anything else is not shown at all.
 */

export const CHIRP_BOT = { name: "Chirp Bot", emoji: "🎙️" } as const;

export type BotKind =
  | "welcome"
  | "arrival"
  | "challenge"
  | "bold"
  | "rivalry"
  | "prompt"
  | "lastcall"
  | "couch"
  | "picks"
  | "final"
  | "switch"
  | "mission"
  | "done"
  | "lead"
  | "chal"
  | "took"
  | "oracle"
  | "ruled"
  | "worst";

/**
 * **How much Chirp Bot talks**, the host's call (`details.chirpLevel`).
 *
 * - `quiet` — only the moments: welcomes, couch fans, picks sealed, a
 *   secret mission pulled off, a Cup lead change, the final verdict. No
 *   heckling the chat (a dare or side quest done is a heckle), no pregame
 *   questions.
 * - `normal` — that, plus a heckle at most every ten minutes and eight a
 *   day, and a pregame question every six hours.
 * - `rowdy` — heckles every four minutes, fourteen a day.
 *
 * Whatever the level, Chirp Bot never speaks twice in a row.
 */
export type ChirpLevel = "quiet" | "normal" | "rowdy";

export const CHIRP_LEVELS: readonly ChirpLevel[] = ["quiet", "normal", "rowdy"];

export function chirpLevelOf(details: { chirpLevel?: unknown }): ChirpLevel {
  const level = details.chirpLevel;
  return level === "quiet" || level === "rowdy" ? level : "normal";
}

export interface BotFact {
  readonly text: string;
  readonly source: string;
  readonly url: string;
  readonly verifiedOn: string;
}

/** A Chirp Bot line as the page draws it. */
export interface BotLine {
  readonly id: string;
  readonly at: string;
  readonly kind: BotKind;
  readonly text: string;
  /** Jokes are satire; questions are opinion. A fact, when there is one, is separate. */
  readonly tone: "satire" | "opinion";
  readonly fact?: BotFact;
  /** Who it is about, when it is about somebody. */
  readonly about?: string;
  readonly reactions: Readonly<Record<string, readonly string[]>>;
}

/** What the chat gets besides the lab's moments. */
export interface ChirpRoom {
  /** chirp-migration.sql is applied: teams and Chirp Bot can be stored. */
  readonly available: boolean;
  /** The host has not switched Chirp Bot off. */
  readonly on: boolean;
  /** Member id → team code, for everybody who has declared. */
  readonly fans: Readonly<Record<string, string>>;
  readonly lines: readonly BotLine[];
  /** A model is configured; otherwise Chirp Bot uses its own library. */
  readonly model: boolean;
  /** How much it talks (the host's setting). */
  readonly level?: ChirpLevel;
}

/** The columns of a stored line that matter here. */
export interface BotRow {
  readonly id: string;
  readonly actor_id: string;
  readonly text: string | null;
  readonly at: string;
  readonly bot_key: string | null;
  readonly bot_line: string | null;
  readonly bot_sig: string | null;
}

/** A line to post: a library id, or a model's text. */
export interface BotPlan {
  readonly key: string;
  readonly line: string;
  readonly text?: string;
}

export interface Fan {
  readonly id: string;
  readonly name: string;
  readonly team: string | null;
}

// ------------------------------------------------------------- keys

/**
 * Which kind of line a key is, from its prefix:
 *
 *   team:<user>:<ABBR>       welcome (or a switch) when someone declares
 *   arrive:<user>            someone joined without a team
 *   challenge:<moment>       a bet in the chat
 *   bold:<moment>            a bold call in the chat
 *   rivalry:<A-B>:<date>     rival fans, once per pair per day
 *   prompt:<start>:<slot>    a pregame question, once per six hours
 *   lastcall:<start>         picks lock soon, once per game time
 *   couch:<user>             someone is watching from home
 *   picks:<stamp>:<user>:<a>-<b>    picks sealed: the boldest score call
 *   final:<stamp>:<user>            the game is over: the Cup's leader
 *                                   (<stamp> is `gameStamp`: no colons)
 *   switch:<user>:<from>:<to>       someone moved their dinner vote
 *   mission:<user>:<prompt>         they pulled off their secret mission
 *   done:<user>:<prompt>            they did their dare / side quest
 *   lead:<stamp>:<user>:<n>         the n-th Cup lead change of the game
 *   chal:<user>:<challenge>         they threw a challenge (PLAY)
 *   took:<user>:<challenge>         they accepted one
 *   oracle:<user>:<challenge>       they made a prophecy
 *   ruled:<challenge>:<winner|none> the challenge is decided
 *   worst:<stamp>:<user>:<a>-<b>    the spectacularly wrong score call
 */
export function kindOfKey(key: string): BotKind | null {
  const prefix = key.split(":", 1)[0];
  switch (prefix) {
    case "team":
      return "welcome";
    case "arrive":
      return "arrival";
    case "challenge":
    case "bold":
    case "rivalry":
    case "prompt":
    case "lastcall":
    case "couch":
    case "picks":
    case "final":
    case "switch":
    case "mission":
    case "done":
    case "lead":
    case "chal":
    case "took":
    case "oracle":
    case "ruled":
    case "worst":
      return prefix;
    default:
      return null;
  }
}

/** Library prefixes each kind may use — a forged row cannot cross them. */
const LINES_FOR: Readonly<Record<BotKind, readonly string[]>> = {
  welcome: ["w.", "g.w.", "s."],
  arrival: ["a."],
  challenge: ["o.ch."],
  bold: ["o.bd."],
  rivalry: ["o.rv."],
  prompt: ["p."],
  lastcall: ["l."],
  couch: ["cw."],
  picks: ["pk."],
  final: ["fv."],
  switch: ["o.sw."],
  mission: ["ms."],
  done: ["dn."],
  lead: ["ld."],
  chal: ["ch."],
  took: ["tk."],
  oracle: ["or."],
  ruled: ["rl."],
  worst: ["wr."],
};

const ORGANIC: ReadonlySet<BotKind> = new Set([
  "challenge",
  "bold",
  "rivalry",
  "switch",
  "chal",
  "oracle",
]);

/** Kinds whose key names the person who must have caused the line. */
const SELF_KEYED: ReadonlySet<BotKind> = new Set([
  "welcome",
  "arrival",
  "couch",
  "switch",
  "mission",
  "done",
  "chal",
  "took",
  "oracle",
]);

// ----------------------------------------------------------- render

export function fill(
  template: string,
  vars: Readonly<Record<string, string>>,
): string {
  return template.replace(/\{(\w+)\}/g, (all, name: string) =>
    name in vars ? vars[name] : all,
  );
}

function storylineCurrent(lineId: string, today: string): boolean {
  const id = LINE_STORYLINE[lineId];
  if (!id) return true;
  const story = STORYLINE_BY_ID.get(id);
  return Boolean(story && today <= story.until);
}

/**
 * A stored row as Chirp Bot's line, or null when it is not provably one —
 * an unknown line, a line of the wrong kind for its key, a key about
 * somebody other than who wrote it, or a model's line whose signature does
 * not check.
 */
export function renderBotRow(
  row: BotRow,
  ctx: {
    readonly fans: ReadonlyMap<string, Fan>;
    readonly verify: (row: BotRow) => boolean;
    readonly reactions?: Readonly<Record<string, readonly string[]>>;
    /** A dinner option's label, for a vote switch. */
    readonly optionLabel?: (optionId: string) => string | undefined;
    /**
     * Is what a key claims still true — this person's sealed pick really was
     * that score, this person really leads the Cup? A line whose claim does
     * not check is not shown, so a forged row cannot put words in the record.
     */
    readonly claimHolds?: (kind: BotKind, parts: readonly string[]) => boolean;
    /** A person's points as the standings have them now (the verdict says it). */
    readonly pointsOf?: (userId: string) => number | undefined;
    /** A PLAY challenge as the rows have it now (`chal`/`took`/`oracle`/`ruled`). */
    readonly challengeOf?: (id: string) => ChallengeView | undefined;
    /** The called final score, "4–3", for the spectacularly wrong pick. */
    readonly finalScore?: string;
  },
): BotLine | null {
  if (!row.bot_key || !row.bot_line) return null;
  const kind = kindOfKey(row.bot_key);
  if (!kind) return null;
  const parts = row.bot_key.split(":");
  const actor = ctx.fans.get(row.actor_id);
  const reactions = ctx.reactions ?? {};

  // Keys that name a person must name the one who caused the line.
  if (SELF_KEYED.has(kind) && parts[1] !== row.actor_id) return null;
  if (CHALLENGE_KINDS_OF_BOT.has(kind))
    return renderChallengeRow(row, kind, parts, ctx, reactions);
  const claims =
    kind === "picks" || kind === "final" || kind === "lead" || kind === "worst";
  if (claims && !ctx.claimHolds?.(kind, parts)) return null;
  const about = claims
    ? parts[2]
    : kind === "welcome" ||
        kind === "arrival" ||
        kind === "challenge" ||
        kind === "bold" ||
        kind === "couch" ||
        kind === "switch" ||
        kind === "mission" ||
        kind === "done"
      ? row.actor_id
      : undefined;

  if (row.bot_line === "ai") {
    if (!row.text || !ctx.verify(row)) return null;
    return {
      id: row.id,
      at: row.at,
      kind,
      text: row.text,
      tone: "satire",
      about,
      reactions,
    };
  }

  if (!LINES_FOR[kind].some((prefix) => row.bot_line!.startsWith(prefix)))
    return null;
  const line = LIBRARY.get(row.bot_line);
  if (!line) return null;

  const subject = claims ? ctx.fans.get(parts[2]) : actor;
  if (claims && !subject) return null;
  const vars: Record<string, string> = { name: subject?.name ?? "Someone" };
  if (kind === "picks") {
    const score = /^(\d{1,2})-(\d{1,2})$/.exec(parts[3] ?? "");
    if (!score) return null;
    vars.pick = `${score[1]}–${score[2]}`;
  }
  if (kind === "worst") {
    const score = /^(\d{1,2})-(\d{1,2})$/.exec(parts[3] ?? "");
    if (!score || !ctx.finalScore) return null;
    vars.pick = `${score[1]}–${score[2]}`;
    vars.actual = ctx.finalScore;
  }
  if (kind === "final" || kind === "lead") {
    const points = ctx.pointsOf?.(parts[2]);
    if (points === undefined) return null;
    vars.points = String(points);
  }
  if (kind === "switch") {
    const from = ctx.optionLabel?.(parts[2] ?? "");
    const to = ctx.optionLabel?.(parts[3] ?? "");
    if (!from || !to) return null;
    vars.from = from;
    vars.to = to;
  }
  if (kind === "welcome") {
    const team = teamByAbbr(parts[2]);
    if (!team) return null;
    vars.team = team.name;
    vars.full = `${team.city} ${team.name}`;
  }
  if (kind === "rivalry") {
    const [a, b] = (parts[1] ?? "").split("-");
    const ta = teamByAbbr(a);
    const tb = teamByAbbr(b);
    const why = ta && tb ? rivalry(ta.abbr, tb.abbr) : null;
    if (!ta || !tb || !why) return null;
    vars.a = ta.name;
    vars.b = tb.name;
    vars.rival = why;
  }

  let fact: BotFact | undefined;
  if (kind === "prompt") {
    const story = PROMPT_BY_ID.get(line.id)?.storyline;
    const s = story ? STORYLINE_BY_ID.get(story) : undefined;
    if (s)
      fact = {
        text: s.fact,
        source: s.source,
        url: s.url,
        verifiedOn: s.verifiedOn,
      };
  }

  return {
    id: row.id,
    at: row.at,
    kind,
    text: fill(line.text, vars),
    tone: kind === "prompt" ? "opinion" : "satire",
    fact,
    about,
    reactions,
  };
}

// --------------------------------------------------------- choosing

/** A small deterministic PRNG, so tests can say what "random" picked. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], seed: number): T[] {
  const random = seeded(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The first line from `pools`, in order of preference, that this night has
 * not heard yet — shuffled within each pool so two nights do not hear the
 * same jokes in the same order. When everything has been said, the least
 * recently said line of the first pool, rather than silence.
 */
export function chooseLine(
  pools: readonly (readonly LibraryLine[])[],
  used: readonly string[],
  seed: number,
  today: string,
): LibraryLine | null {
  const heard = new Set(used);
  const usable = pools.map((pool) =>
    pool.filter((line) => storylineCurrent(line.id, today)),
  );
  for (const [i, pool] of usable.entries()) {
    const fresh = shuffled(pool, seed + i).find((l) => !heard.has(l.id));
    if (fresh) return fresh;
  }
  const first = usable.find((pool) => pool.length > 0);
  if (!first) return null;
  // Oldest first in `used`, so the earliest index is the longest ago.
  return [...first].sort((a, b) => used.indexOf(a.id) - used.indexOf(b.id))[0];
}

/** Library ids this night has already used, oldest first. */
export function usedLines(rows: readonly BotRow[]): string[] {
  return [...rows]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((r) => r.bot_line)
    .filter((id): id is string => Boolean(id) && id !== "ai");
}

/** How many team lines one person may cause in one night: a declaration and two changes of heart. */
export const MAX_TEAM_LINES = 3;

/** The line for someone declaring (or changing) their team, or null if it is already said. */
export function welcomePlan(input: {
  readonly userId: string;
  readonly team: string;
  readonly previous: string | null;
  readonly rows: readonly BotRow[];
  readonly seed: number;
  readonly today: string;
}): BotPlan | null {
  if (!teamByAbbr(input.team)) return null;
  const key = `team:${input.userId}:${input.team}`;
  const keys = input.rows.map((r) => r.bot_key);
  if (keys.includes(key)) return null;
  if (
    keys.filter((k) => k?.startsWith(`team:${input.userId}:`)).length >=
    MAX_TEAM_LINES
  )
    return null;
  const pools =
    input.previous && input.previous !== input.team
      ? [SWITCHES, GENERIC_WELCOMES]
      : [WELCOMES[input.team] ?? [], GENERIC_WELCOMES];
  const line = chooseLine(
    pools,
    usedLines(input.rows),
    input.seed,
    input.today,
  );
  return line ? { key, line: line.id } : null;
}

/** Someone joined with no team: Chirp Bot asks, once. */
export function arrivalPlan(input: {
  readonly userId: string;
  readonly rows: readonly BotRow[];
  readonly seed: number;
  readonly today: string;
}): BotPlan | null {
  const key = `arrive:${input.userId}`;
  if (input.rows.some((r) => r.bot_key === key)) return null;
  const line = chooseLine(
    [ARRIVALS],
    usedLines(input.rows),
    input.seed,
    input.today,
  );
  return line ? { key, line: line.id } : null;
}

// ------------------------------------------------------------ chatter

export type Chatter =
  | { readonly kind: "challenge" }
  | { readonly kind: "bold" }
  | { readonly kind: "rivalry"; readonly pair: string };

const CHALLENGE =
  /\b(bet|bets|betting|wager|loser buys|winner buys|you'?re on|dare you|i dare|double or nothing|put your money)\b/i;
const BOLD =
  /\b(\d{1,2}\s*[-–]\s*\d{1,2}|sweep|guarantee[ds]?|lock it in|easy win|no chance|blow ?out|hat ?trick|shut ?out|calling it|mark my words|not even close)\b/i;

/**
 * Is this message worth a heckle, and what kind? A bet beats a rivalry beats
 * a bold call. A rivalry is two *people* in this night whose teams have a
 * real feud, triggered when one of them names the other's team (or their
 * own, at the other) — not just any mention of a team.
 */
export function readChatter(
  text: string,
  speaker: Fan,
  others: readonly Fan[],
): Chatter | null {
  if (CHALLENGE.test(text)) return { kind: "challenge" };
  if (speaker.team) {
    const named = teamsMentioned(text).map((t) => t.abbr);
    for (const other of others) {
      if (other.id === speaker.id || !other.team) continue;
      if (!rivalry(speaker.team, other.team)) continue;
      if (named.includes(other.team) || named.includes(speaker.team))
        return { kind: "rivalry", pair: pairKey(speaker.team, other.team) };
    }
  }
  if (BOLD.test(text)) return { kind: "bold" };
  return null;
}

/** Quiet time between heckles, and the most heckles in a day. */
export const ORGANIC_COOLDOWN_MS = 10 * 60_000;
export const ORGANIC_PER_DAY = 8;
export const ROWDY_COOLDOWN_MS = 4 * 60_000;
export const ROWDY_PER_DAY = 14;

/**
 * May Chirp Bot heckle right now? Not within ten minutes of its last heckle,
 * not more than eight times in a day, and never twice in a row: if the
 * newest thing in the chat is already Chirp Bot, it waits for a person.
 */
export function organicAllowed(
  rows: readonly BotRow[],
  newestIsBot: boolean,
  now: Date,
  level: ChirpLevel = "normal",
): boolean {
  if (newestIsBot || level === "quiet") return false;
  const cooldown = level === "rowdy" ? ROWDY_COOLDOWN_MS : ORGANIC_COOLDOWN_MS;
  const perDay = level === "rowdy" ? ROWDY_PER_DAY : ORGANIC_PER_DAY;
  const organic = rows
    .filter((r) => {
      const kind = r.bot_key ? kindOfKey(r.bot_key) : null;
      return kind !== null && ORGANIC.has(kind);
    })
    .map((r) => Date.parse(r.at));
  const t = now.getTime();
  if (organic.some((at) => t - at < cooldown)) return false;
  return organic.filter((at) => t - at < 86_400_000).length < perDay;
}

export function organicPlan(input: {
  readonly chatter: Chatter;
  readonly momentId: string;
  readonly rows: readonly BotRow[];
  readonly now: Date;
  readonly seed: number;
}): BotPlan | null {
  const today = input.now.toISOString().slice(0, 10);
  const { chatter } = input;
  const key =
    chatter.kind === "rivalry"
      ? `rivalry:${chatter.pair}:${today}`
      : `${chatter.kind}:${input.momentId}`;
  if (input.rows.some((r) => r.bot_key === key)) return null;
  const pool =
    chatter.kind === "challenge"
      ? CHALLENGE_LINES
      : chatter.kind === "bold"
        ? BOLD_LINES
        : RIVALRY_LINES;
  const line = chooseLine([pool], usedLines(input.rows), input.seed, today);
  return line ? { key, line: line.id } : null;
}

// ------------------------------------------------------------ pregame

const HOUR = 3_600_000;
/** Questions start three days out, one per six hours, until puck drop. */
export const PROMPT_WINDOW_HOURS = 72;
export const PROMPT_EVERY_HOURS = 6;

/** Which six-hour slot before puck drop `now` is in, or null outside the window. */
export function promptSlot(now: Date, startsAt: string): number | null {
  const before = (Date.parse(startsAt) - now.getTime()) / HOUR;
  if (!(before > 0) || before > PROMPT_WINDOW_HOURS) return null;
  return Math.floor(before / PROMPT_EVERY_HOURS);
}

/**
 * A fresh question to argue about, if one is due: before the game, with at
 * least two people in, at most one per slot, and only once somebody has
 * said something since the last one — Chirp Bot does not ask an empty room
 * a second question. Questions about teams somebody here cheers for (or
 * that are playing) come first; a question whose fact has gone stale is
 * never asked; a question is never asked twice in one night.
 */
export function promptPlan(input: {
  readonly now: Date;
  readonly startsAt: string;
  readonly members: number;
  readonly rows: readonly BotRow[];
  /** When people (not Chirp Bot) last said something. */
  readonly lastHumanNoteAt: string | null;
  readonly teams: readonly string[];
  readonly seed: number;
}): BotPlan | null {
  if (input.members < 2) return null;
  const slot = promptSlot(input.now, input.startsAt);
  if (slot === null) return null;
  const key = `prompt:${input.startsAt.slice(0, 16)}:${slot}`;
  const prompts = input.rows.filter((r) => r.bot_key?.startsWith("prompt:"));
  if (prompts.some((r) => r.bot_key === key)) return null;
  const latest = prompts
    .map((r) => r.at)
    .sort()
    .at(-1);
  if (latest && !(input.lastHumanNoteAt && input.lastHumanNoteAt > latest))
    return null;

  const today = input.now.toISOString().slice(0, 10);
  const current = new Set(currentStorylines(today).map((s) => s.id));
  const asked = new Set(usedLines(input.rows));
  const usable = PROMPTS.filter(
    (p) => !asked.has(p.id) && (!p.storyline || current.has(p.storyline)),
  );
  const here = new Set(input.teams);
  const relevant = usable.filter((p) => p.teams?.some((t) => here.has(t)));
  const general = usable.filter((p) => !p.teams);
  const pick =
    shuffled(relevant, input.seed)[0] ?? shuffled(general, input.seed)[0];
  return pick ? { key, line: pick.id } : null;
}

/** Ninety minutes before puck drop, once: picks lock soon. */
export function lastCallPlan(input: {
  readonly now: Date;
  readonly startsAt: string;
  readonly members: number;
  readonly picksOn: boolean;
  readonly rows: readonly BotRow[];
  readonly seed: number;
}): BotPlan | null {
  if (!input.picksOn || input.members < 2) return null;
  const before = (Date.parse(input.startsAt) - input.now.getTime()) / HOUR;
  if (!(before > 0) || before > 1.5) return null;
  const key = `lastcall:${input.startsAt.slice(0, 16)}`;
  if (input.rows.some((r) => r.bot_key === key)) return null;
  const line = chooseLine(
    [LAST_CALL],
    usedLines(input.rows),
    input.seed,
    input.now.toISOString().slice(0, 10),
  );
  return line ? { key, line: line.id } : null;
}

// ------------------------------------------------------ chirp someone

/**
 * Three chirps about `target` from Chirp Bot's own material: a rivalry line
 * if the sender's team has a real feud with the target's, then the target
 * team's own lines, then lines for any team. Never the same line twice.
 */
export function libraryChirps(input: {
  readonly sender: Fan;
  readonly target: Fan;
  readonly seed: number;
  readonly today: string;
}): string[] {
  const { sender, target, today } = input;
  const team = teamByAbbr(target.team);
  const vars: Record<string, string> = { target: target.name };
  if (!team) {
    return shuffled(NO_TEAM_CHIRPS, input.seed)
      .slice(0, 3)
      .map((l) => fill(l.text, vars));
  }
  vars.team = team.name;
  const why = sender.team ? rivalry(sender.team, team.abbr) : null;
  if (why) vars.rival = why;

  const own = shuffled(
    (CHIRPS[team.abbr] ?? []).filter((l) => storylineCurrent(l.id, today)),
    input.seed,
  );
  const picked: LibraryLine[] = [];
  if (why) picked.push(shuffled(RIVAL_CHIRPS, input.seed)[0]);
  for (const line of [...own, ...shuffled(GENERIC_CHIRPS, input.seed + 1)]) {
    if (picked.length >= 3) break;
    picked.push(line);
  }
  return picked.slice(0, 3).map((l) => fill(l.text, vars));
}

// -------------------------------------------------------------- safety

/**
 * Words a chirp about a hockey team never needs. A coarse net, not a
 * moderator: it catches a model wandering from the team to the person
 * (bodies, identity, health, self-harm, slurs). A caught line is dropped and
 * replaced from the library, never edited.
 */
const OFF_LIMITS =
  /\b(fat|obese|ugly|bald|skinny|wrinkl\w*|old (?:man|woman|lady)|virgin|divorc\w*|unemploy\w*|gay|lesbian|trans|transgender|queer|fag\w*|retard\w*|autis\w*|spaz|cripple\w*|midget|racis\w*|black people|white people|asian|jews?|jewish|muslims?|hindus?|immigrants?|terroris\w*|nazi\w*|hitler|rape\w*|kill (?:yourself|urself)|kys|suicid\w*|cancer|wife|husband|girlfriend|boyfriend|mom|mother|sex|sexy|whore|slut|bitch\w*|cunt|nigg\w*|chink|spic|kike|tranny)\b/i;

/** Is this a chirp Chirp Bot may offer? Length, one line, nothing off limits. */
export function acceptableChirp(text: unknown): text is string {
  if (typeof text !== "string") return false;
  const t = text.trim();
  return (
    t.length >= 8 &&
    t.length <= 240 &&
    !/[\n\r]/.test(t) &&
    !/https?:\/\//i.test(t) &&
    !OFF_LIMITS.test(t)
  );
}

// ------------------------------------------------------------ limits

/**
 * **A sliding-window limiter**, for what costs money: asking a model. Pure
 * apart from the clock it is given. Per server instance, so it bounds cost
 * per instance rather than globally — the persistent limits on what Chirp
 * Bot *posts* live in the database (`organicAllowed`, unique keys).
 */
export class Limiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly windowMs: number,
    private readonly max: number,
  ) {}

  /** Records a hit and says whether it was within the limit. */
  take(key: string, now: number): boolean {
    const recent = (this.hits.get(key) ?? []).filter(
      (t) => now - t < this.windowMs,
    );
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 5000) {
      for (const [k, v] of this.hits)
        if (v.every((t) => now - t >= this.windowMs)) this.hits.delete(k);
    }
    return true;
  }
}

// ------------------------------------------------ the rest of the night

/**
 * The game time inside a key, without colons — keys are split on ":" to
 * read who and what they are about ("2026-10-25T19:00" → "2026-10-25T1900").
 */
export function gameStamp(startsAt: string): string {
  return startsAt.slice(0, 16).replace(":", "");
}

/** Someone said they're watching from home: once per person per night. */
export function couchPlan(input: {
  readonly userId: string;
  readonly rows: readonly BotRow[];
  readonly seed: number;
  readonly today: string;
}): BotPlan | null {
  const key = `couch:${input.userId}`;
  if (input.rows.some((r) => r.bot_key === key)) return null;
  const line = chooseLine(
    [COUCH_LINES],
    usedLines(input.rows),
    input.seed,
    input.today,
  );
  return line ? { key, line: line.id } : null;
}

/** A sealed final-score pick, as the database has it once picks lock. */
export interface ScorePick {
  readonly userId: string;
  readonly home: number;
  readonly away: number;
}

/**
 * The boldest score call: the biggest margin, then the most goals, then the
 * earliest member — so every phone that asks picks the same one and the
 * database keeps one line.
 */
export function boldestPick(picks: readonly ScorePick[]): ScorePick | null {
  const sorted = [...picks].sort(
    (a, b) =>
      Math.abs(b.home - b.away) - Math.abs(a.home - a.away) ||
      b.home + b.away - (a.home + a.away) ||
      a.userId.localeCompare(b.userId),
  );
  return sorted[0] ?? null;
}

/**
 * Puck drop: picks are sealed and now visible to everybody, so Chirp Bot
 * reads out the boldest score call. Once per game time, within three hours
 * of puck drop, and only with two or more people in (a call is only bold
 * next to somebody else's).
 */
export function picksPlan(input: {
  readonly now: Date;
  readonly startsAt: string;
  readonly members: number;
  readonly picks: readonly ScorePick[];
  readonly rows: readonly BotRow[];
  readonly seed: number;
}): BotPlan | null {
  if (input.members < 2 || input.picks.length === 0) return null;
  const since = (input.now.getTime() - Date.parse(input.startsAt)) / HOUR;
  if (!(since >= 0) || since > 3) return null;
  const start = gameStamp(input.startsAt);
  if (input.rows.some((r) => r.bot_key?.startsWith(`picks:${start}:`)))
    return null;
  const pick = boldestPick(input.picks);
  if (!pick) return null;
  const line = chooseLine(
    [PICKS_LINES],
    usedLines(input.rows),
    input.seed,
    input.now.toISOString().slice(0, 10),
  );
  return line
    ? {
        key: `picks:${start}:${pick.userId}:${pick.home}-${pick.away}`,
        line: line.id,
      }
    : null;
}

/**
 * The horn has gone and the final score is called: Chirp Bot crowns the
 * leader. Only an outright leader with points (a tie is the page's to show,
 * not Chirp Bot's to break). The line names the person, not the points — it
 * says their points as they stand whenever it's read — and it shows only
 * while they lead, so a later call that changes the lead hides it and lets
 * the new leader have theirs: at most one verdict per person per game.
 */
export function finalPlan(input: {
  readonly now: Date;
  readonly startsAt: string;
  readonly gameOver: boolean;
  readonly called: boolean;
  readonly leader: { readonly id: string; readonly points: number } | null;
  readonly rows: readonly BotRow[];
  readonly seed: number;
}): BotPlan | null {
  if (!input.gameOver || !input.called || !input.leader) return null;
  if (input.leader.points <= 0) return null;
  const key = `final:${gameStamp(input.startsAt)}:${input.leader.id}`;
  if (input.rows.some((r) => r.bot_key === key)) return null;
  const line = chooseLine(
    [VERDICT_LINES],
    usedLines(input.rows),
    input.seed,
    input.now.toISOString().slice(0, 10),
  );
  return line ? { key, line: line.id } : null;
}

/**
 * Somebody moved their dinner vote from one place to another. A heckle like
 * any other (cooldown, daily cap, never twice in a row, nothing when the
 * host has Chirp Bot quiet), and once per person per pair of places.
 */
export function switchPlan(input: {
  readonly userId: string;
  readonly from: string;
  readonly to: string;
  readonly rows: readonly BotRow[];
  readonly newestIsBot: boolean;
  readonly now: Date;
  readonly level: ChirpLevel;
  readonly seed: number;
}): BotPlan | null {
  if (input.from === input.to) return null;
  if (!organicAllowed(input.rows, input.newestIsBot, input.now, input.level))
    return null;
  const key = `switch:${input.userId}:${input.from}:${input.to}`;
  if (key.length > 160 || input.rows.some((r) => r.bot_key === key))
    return null;
  const line = chooseLine(
    [SWITCH_LINES],
    usedLines(input.rows),
    input.seed,
    input.now.toISOString().slice(0, 10),
  );
  return line ? { key, line: line.id } : null;
}

/** The toy families whose completion Chirp Bot notices, and how it says so. */
export type DoneFamily = "mission" | "dare" | "sidequest";

/**
 * Somebody answered "yes" to their own secret mission, dare or side quest.
 * Self-keyed — only that person's own answer can set it off — once per
 * person per prompt, and the line never says what the thing was (a mission
 * stays secret; a dare someone passed on is never announced, because a pass
 * is never a "yes").
 *
 * A mission is one of the night's moments, so it speaks even when the host
 * has Chirp Bot quiet. A dare or side quest is a heckle: cooldown, daily
 * cap, never twice in a row, nothing when quiet.
 */
export function donePlan(input: {
  readonly userId: string;
  readonly promptId: string;
  readonly family: DoneFamily;
  readonly rows: readonly BotRow[];
  readonly newestIsBot: boolean;
  readonly now: Date;
  readonly level: ChirpLevel;
  readonly seed: number;
}): BotPlan | null {
  const mission = input.family === "mission";
  if (
    !mission &&
    !organicAllowed(input.rows, input.newestIsBot, input.now, input.level)
  )
    return null;
  const key = `${mission ? "mission" : "done"}:${input.userId}:${input.promptId}`;
  if (key.length > 160 || input.promptId.includes(":")) return null;
  if (input.rows.some((r) => r.bot_key === key)) return null;
  const line = chooseLine(
    [mission ? MISSION_LINES : DONE_LINES],
    usedLines(input.rows),
    input.seed,
    input.now.toISOString().slice(0, 10),
  );
  return line ? { key, line: line.id } : null;
}

/** At most this many lead-change lines in one game, and this far apart. */
export const LEAD_LINES_PER_GAME = 4;
export const LEAD_COOLDOWN_MS = 10 * 60_000;

/**
 * **A Sycle Cup lead change**, while the game is on. When somebody new leads
 * outright (points above zero, nobody level), Chirp Bot says so — once per
 * change, at most four a game and ten minutes apart, so a host calling three
 * results in a row is one line, not three. The final verdict takes over once
 * the game is over and called. Like the verdict, a lead line shows only
 * while it is true (`claimHolds`), so the chat never claims a lead that was
 * since lost or never real.
 */
export function leadPlan(input: {
  readonly now: Date;
  readonly startsAt: string;
  readonly gameOver: boolean;
  readonly called: boolean;
  readonly leader: { readonly id: string; readonly points: number } | null;
  readonly rows: readonly BotRow[];
  readonly seed: number;
}): BotPlan | null {
  if (!input.leader || input.leader.points <= 0) return null;
  if (input.gameOver && input.called) return null;
  const since = (input.now.getTime() - Date.parse(input.startsAt)) / HOUR;
  if (!(since >= 0) || since > 4) return null;
  const stamp = gameStamp(input.startsAt);
  const leads = input.rows
    .filter((r) => r.bot_key?.startsWith(`lead:${stamp}:`))
    .map((r) => ({
      who: r.bot_key!.split(":")[2],
      n: Number(r.bot_key!.split(":")[3]),
      at: Date.parse(r.at),
    }))
    .sort((a, b) => a.n - b.n);
  const last = leads.at(-1);
  if (last?.who === input.leader.id) return null;
  if (leads.length >= LEAD_LINES_PER_GAME) return null;
  if (last && input.now.getTime() - last.at < LEAD_COOLDOWN_MS) return null;
  const line = chooseLine(
    [LEAD_LINES],
    usedLines(input.rows),
    input.seed,
    input.now.toISOString().slice(0, 10),
  );
  const n = (last?.n ?? 0) + 1;
  return line
    ? { key: `lead:${stamp}:${input.leader.id}:${n}`, line: line.id }
    : null;
}

// ------------------------------------------------------- challenges

/** A PLAY challenge as Chirp Bot needs it (`challenges.ts` decides the state). */
export interface ChallengeView {
  readonly id: string;
  readonly kind: "bet" | "defend" | "commentary" | "hottake" | "prophecy";
  readonly challenger: string;
  readonly target: string;
  readonly status: "open" | "accepted" | "declined" | "withdrawn";
  /** A bet's side in words, "the Wild win" (the challenger's). */
  readonly side?: string;
  /** The other side, "the Canucks win" (the target's). */
  readonly against?: string;
  /** Decided: who won (null: the jury wasn't convinced). Undefined: not decided. */
  readonly winner?: string | null;
  /** When it was decided, ISO. */
  readonly decidedAt?: string | null;
}

const CHALLENGE_KINDS_OF_BOT: ReadonlySet<BotKind> = new Set([
  "chal",
  "took",
  "oracle",
  "ruled",
]);

/** The library pool for a decided challenge. */
function ruledPool(c: ChallengeView): readonly LibraryLine[] {
  if (c.kind === "bet") return RULED_BET;
  if (c.kind === "prophecy")
    return c.winner ? RULED_PROPHECY : RULED_FALSE_PROPHECY;
  return c.winner ? RULED_WON : RULED_LOST;
}

/** The pool a thrown challenge's line comes from. */
function issuedPool(c: ChallengeView): readonly LibraryLine[] {
  if (c.challenger === c.target)
    return c.kind === "prophecy" ? PROPHECY_LINES : CHALLENGE_ISSUED.self;
  return CHALLENGE_ISSUED[c.kind] ?? [];
}

/**
 * A challenge line, checked against the challenge as it stands: the key's
 * person did the thing, the line is from that kind's own pool, and — for a
 * verdict — the rows still say what the line says.
 */
function renderChallengeRow(
  row: BotRow,
  kind: BotKind,
  parts: readonly string[],
  ctx: Parameters<typeof renderBotRow>[1],
  reactions: Readonly<Record<string, readonly string[]>>,
): BotLine | null {
  const id = kind === "ruled" ? parts[1] : parts[2];
  const c = id ? ctx.challengeOf?.(id) : undefined;
  if (!c) return null;
  const nameOf = (who: string) => ctx.fans.get(who)?.name ?? "Someone";
  let pool: readonly LibraryLine[];
  let about: string;
  let vars: Record<string, string>;
  const teamOf = (who: string) =>
    teamByAbbr(ctx.fans.get(who)?.team ?? null)?.name ?? "their team";

  switch (kind) {
    case "chal":
    case "oracle": {
      if (c.challenger !== row.actor_id) return null;
      if ((kind === "oracle") !== (c.kind === "prophecy")) return null;
      if (c.status !== "open" && c.status !== "accepted") return null;
      pool = issuedPool(c);
      about = c.target;
      vars = {
        name: nameOf(c.challenger),
        target: nameOf(c.target),
        team: teamOf(c.target),
        side: c.side ?? "",
      };
      break;
    }
    case "took": {
      if (c.target !== row.actor_id || c.status !== "accepted") return null;
      if (c.target === c.challenger) return null;
      pool = CHALLENGE_TAKEN;
      about = c.target;
      vars = { name: nameOf(c.target), target: nameOf(c.challenger) };
      break;
    }
    case "ruled": {
      if (c.winner === undefined) return null;
      if ((parts[2] ?? "") !== (c.winner ?? "none")) return null;
      pool = ruledPool(c);
      if (c.kind === "bet") {
        if (!c.winner) return null;
        const loser = c.winner === c.challenger ? c.target : c.challenger;
        about = c.winner;
        vars = { name: nameOf(c.winner), target: nameOf(loser) };
      } else {
        about = c.target;
        vars = { name: nameOf(c.target) };
      }
      break;
    }
    default:
      return null;
  }

  if (row.bot_line === "ai") {
    // A model may voice a challenge being thrown or taken; never a verdict.
    if (kind === "ruled" || !row.text || !ctx.verify(row)) return null;
    return {
      id: row.id,
      at: row.at,
      kind,
      text: row.text,
      tone: "satire",
      about,
      reactions,
    };
  }
  const line = pool.find((l) => l.id === row.bot_line);
  if (!line) return null;
  return {
    id: row.id,
    at: row.at,
    kind,
    text: fill(line.text, vars),
    tone: "satire",
    about,
    reactions,
  };
}

/**
 * **A challenge was thrown, taken, or a prophecy made.** Thrown and
 * prophecy are heckles (cooldown, daily cap, never twice in a row, nothing
 * on Quiet); taken is one of the night's moments — the rivalry escalating —
 * so it speaks on every level. Once per challenge per event. A decline is
 * never announced: there is no plan for it.
 */
export function challengePlan(input: {
  readonly event: "issued" | "accepted";
  readonly challenge: ChallengeView;
  readonly userId: string;
  readonly rows: readonly BotRow[];
  readonly newestIsBot: boolean;
  readonly now: Date;
  readonly level: ChirpLevel;
  readonly seed: number;
}): BotPlan | null {
  const c = input.challenge;
  const prophecy = c.kind === "prophecy";
  let key: string;
  let pool: readonly LibraryLine[];
  if (input.event === "issued") {
    if (c.challenger !== input.userId) return null;
    if (!organicAllowed(input.rows, input.newestIsBot, input.now, input.level))
      return null;
    key = `${prophecy ? "oracle" : "chal"}:${input.userId}:${c.id}`;
    pool = issuedPool(c);
  } else {
    if (c.target !== input.userId || c.status !== "accepted") return null;
    if (c.target === c.challenger) return null;
    key = `took:${input.userId}:${c.id}`;
    pool = CHALLENGE_TAKEN;
  }
  if (input.rows.some((r) => r.bot_key === key)) return null;
  const line = chooseLine(
    [pool],
    usedLines(input.rows),
    input.seed,
    input.now.toISOString().slice(0, 10),
  );
  return line ? { key, line: line.id } : null;
}

/** How long after a challenge is decided Chirp Bot will still announce it. */
export const RULED_WINDOW_MS = 6 * HOUR;

/**
 * **The verdict.** Once a challenge is decided — a bet by the host's call, a
 * jury by its last vote or its deadline — Chirp Bot says who won. A moment:
 * it speaks on every level, once per challenge, and only for a fresh
 * decision (a night reopened next week does not get a backlog).
 */
export function ruledPlan(input: {
  readonly challenge: ChallengeView;
  readonly rows: readonly BotRow[];
  readonly now: Date;
  readonly seed: number;
}): BotPlan | null {
  const c = input.challenge;
  if (c.winner === undefined || c.status !== "accepted") return null;
  if (c.kind === "bet" && !c.winner) return null;
  const at = c.decidedAt ? Date.parse(c.decidedAt) : NaN;
  if (!(input.now.getTime() - at <= RULED_WINDOW_MS)) return null;
  const key = `ruled:${c.id}:${c.winner ?? "none"}`;
  if (input.rows.some((r) => r.bot_key?.startsWith(`ruled:${c.id}:`)))
    return null;
  const line = chooseLine(
    [ruledPool(c)],
    usedLines(input.rows),
    input.seed,
    input.now.toISOString().slice(0, 10),
  );
  return line ? { key, line: line.id } : null;
}

/**
 * The spectacularly wrong final-score pick: furthest from the called score
 * (total goals off, then margin off, then earliest member), once per game,
 * once the game is over and the score is called — only with two picks or
 * more, because being the worst of one is just being there.
 */
export function worstPick(
  picks: readonly ScorePick[],
  actual: readonly [number, number],
): ScorePick | null {
  if (picks.length < 2) return null;
  const off = (p: ScorePick) =>
    Math.abs(p.home - actual[0]) + Math.abs(p.away - actual[1]);
  const sorted = [...picks].sort(
    (a, b) => off(b) - off(a) || a.userId.localeCompare(b.userId),
  );
  return off(sorted[0]) > 0 ? sorted[0] : null;
}

export function worstPlan(input: {
  readonly now: Date;
  readonly startsAt: string;
  readonly gameOver: boolean;
  readonly actual: readonly [number, number] | null;
  readonly picks: readonly ScorePick[];
  readonly rows: readonly BotRow[];
  readonly seed: number;
}): BotPlan | null {
  if (!input.gameOver || !input.actual) return null;
  const since = (input.now.getTime() - Date.parse(input.startsAt)) / HOUR;
  if (!(since >= 0) || since > 30) return null;
  const stamp = gameStamp(input.startsAt);
  if (input.rows.some((r) => r.bot_key?.startsWith(`worst:${stamp}:`)))
    return null;
  const pick = worstPick(input.picks, input.actual);
  if (!pick) return null;
  const line = chooseLine(
    [WORST_PICK_LINES],
    usedLines(input.rows),
    input.seed,
    input.now.toISOString().slice(0, 10),
  );
  return line
    ? {
        key: `worst:${stamp}:${pick.userId}:${pick.home}-${pick.away}`,
        line: line.id,
      }
    : null;
}
