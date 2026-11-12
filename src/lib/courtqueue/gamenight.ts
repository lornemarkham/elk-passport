import { localClock, weekdayLabel } from "./clock";
import { registrationCountdown, type Countdown } from "./countdown";
import {
  applySession,
  unsound,
  type Actor,
  type Outcome,
  type SessionCommand,
} from "./engine";
import { inOrder, prepared, tonight } from "./fair";
import { LEVELS, type Level } from "./journey";
import {
  DEFAULT_COURTS,
  DEFAULT_RULES,
  MINUTE,
  MOODS,
  emptySession,
  filled,
  isActiveGame,
  partnerIn,
  type Club,
  type Court,
  type Game,
  type Mood,
  type Session,
  type Slots,
} from "./model";
import {
  registrationOpensAt,
  seasonDates,
  sessionWindow,
  upcomingNights,
} from "./schedule";

/**
 * **Test Game Night.** A whole badminton night with 25 fictional players,
 * run by the real engine (`engine.ts`, `fair.ts`) on a copy that lives only
 * in the organizer's browser. Nothing here reads or writes the store, sends
 * a notification or posts to the Clubhouse: there is no I/O in this file at
 * all, so the real club cannot be touched by it. Closing it throws the copy
 * away.
 *
 * The night is a list of things that will happen — sign-ups from 8:00 am,
 * arrivals, games starting and finishing, people catching their breath or
 * taking a break — and **Next event** jumps the clock to the next one. The
 * organizer can step in at any moment with the same commands the real app
 * uses; the fictional players react the way people do.
 */

export interface Fictional {
  readonly id: string;
  readonly name: string;
  /** Their own private guide (`journey.ts`). Shown only in the demo. */
  readonly level: Level | null;
  readonly mood: Mood | null;
  /** Club nights they came to this season before tonight. */
  readonly nights: number;
  /** "Happy to welcome newcomers." */
  readonly host?: boolean;
  readonly wantsHelp?: boolean;
}

type Spec = Omit<Fictional, "id">;

/** The 25 who sign up. Realistic, made up, nobody real. */
const CAST: readonly Spec[] = [
  {
    name: "Maya Chen",
    level: "beginner",
    mood: "fun",
    nights: 0,
    wantsHelp: true,
  },
  {
    name: "Sam Okafor",
    level: "advanced",
    mood: "help",
    nights: 19,
    host: true,
  },
  { name: "Priya Sharma", level: "intermediate", mood: "fun", nights: 11 },
  { name: "Tom Becker", level: "intermediate", mood: null, nights: 7 },
  { name: "Lena Novak", level: "beginner", mood: "rallies", nights: 3 },
  { name: "Ravi Patel", level: "intermediate", mood: "fun", nights: 14 },
  { name: "Jo Tremblay", level: "advanced", mood: "challenge", nights: 21 },
  { name: "Ben Wright", level: "intermediate", mood: "fun", nights: 9 },
  { name: "Aiko Tanaka", level: "advanced", mood: "challenge", nights: 16 },
  { name: "Carlos Mendes", level: "intermediate", mood: "rallies", nights: 5 },
  { name: "Grace Liu", level: "beginner", mood: "fun", nights: 1 },
  {
    name: "Owen MacLeod",
    level: "advanced",
    mood: "fun",
    nights: 22,
    host: true,
  },
  {
    name: "Fatima Rahman",
    level: "intermediate",
    mood: "challenge",
    nights: 8,
  },
  { name: "Dylan Fraser", level: null, mood: "fun", nights: 2 },
  { name: "Nina Kowalski", level: "intermediate", mood: "help", nights: 13 },
  { name: "Jamal Ward", level: "beginner", mood: "fun", nights: 0 },
  { name: "Sofia Rossi", level: "advanced", mood: "rallies", nights: 18 },
  { name: "Harpreet Gill", level: "intermediate", mood: "fun", nights: 10 },
  {
    name: "Ellie Dubois",
    level: "beginner",
    mood: "rallies",
    nights: 4,
    wantsHelp: true,
  },
  { name: "Marcus Lee", level: "intermediate", mood: "challenge", nights: 6 },
  { name: "Hannah Price", level: "intermediate", mood: "fun", nights: 12 },
  { name: "Kenji Mori", level: "advanced", mood: "challenge", nights: 15 },
  { name: "Rosa Alvarez", level: null, mood: null, nights: 0 },
  { name: "Liam O'Brien", level: "intermediate", mood: "fun", nights: 3 },
  { name: "Zara Ahmed", level: "beginner", mood: "fun", nights: 2 },
];

/** Walk-ins the organizer can add, one at a time. */
const WALK_INS: readonly Spec[] = [
  { name: "Theo Grant", level: "intermediate", mood: "fun", nights: 5 },
  { name: "Mei Wong", level: "beginner", mood: "rallies", nights: 0 },
  { name: "Ivan Petrov", level: "advanced", mood: "challenge", nights: 12 },
  { name: "Chloe Martin", level: "intermediate", mood: "help", nights: 9 },
  { name: "Ade Bello", level: "beginner", mood: "fun", nights: 1 },
  { name: "Ruth Klein", level: "intermediate", mood: "fun", nights: 17 },
];

export const FICTIONAL_COUNT = CAST.length;

const ORG: Actor = { id: "demo-org", organizer: true };
const as = (id: string): Actor => ({ id, organizer: false });

export interface LogLine {
  readonly at: number;
  readonly text: string;
}

export interface GameNight {
  readonly v: 1;
  readonly seed: number;
  readonly date: string;
  now: number;
  club: Club;
  session: Session;
  cast: Fictional[];
  /** When each fictional player taps sign-up. */
  registersAt: Record<string, number>;
  /** When they walk in; null = signed up but doesn't come. */
  arrivesAt: Record<string, number | null>;
  /** Heading home early. */
  leavesAt: Record<string, number>;
  /** When they'll tap BACK IN THE QUEUE. */
  returnsAt: Record<string, number>;
  /** Marked unavailable by the organizer: never put back by the simulation. */
  unavailable: string[];
  /** Removed by the organizer: the simulation leaves them be. */
  removed: string[];
  walkIns: number;
  /** Things that could not happen (`kind:id`), so they are not tried again. */
  dropped: string[];
  log: LogLine[];
}

// -----------------------------------------------------------------------------
// Chance, without state: the same seed always plays the same night.

function hash(seed: number, key: string): number {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

const between = (seed: number, key: string, lo: number, hi: number) =>
  lo + Math.floor(hash(seed, key) * (hi - lo + 1));

/** How long a game lasts, in minutes. */
export const gameMinutes = (n: GameNight, gameId: string) =>
  between(n.seed, `len:${gameId}`, 11, 17);

/** How long the four take to walk on and tap START. */
const walkOn = (n: GameNight, gameId: string) =>
  between(n.seed, `walk:${gameId}`, 1, 3);

// -----------------------------------------------------------------------------

/** The night the demo plays: the club's next one, else the season's last. */
export function demoDate(now: number): string {
  return upcomingNights(now, undefined, 1)[0] ?? seasonDates().at(-1)!;
}

function makePlayer(club: Club, f: Fictional, date: string) {
  const day = 24 * 60 * MINUTE;
  club.players[f.id] = {
    id: f.id,
    name: f.name,
    // A first-timer joined this week; everyone else long ago.
    createdAt:
      f.nights === 0
        ? Date.parse(date) - 2 * day
        : Date.parse(date) - (40 + f.nights * 4) * day,
    pinHash: "",
    tokenHashes: [],
    mentor: !!f.host,
    organizer: false,
    photo: false,
    journey: {
      asked: true,
      goals: [],
      practising: [],
      done: [],
      ...(f.level ? { level: f.level } : {}),
      ...(f.wantsHelp ? { wantsHelp: true } : {}),
    },
  };
}

export interface GameNightOptions {
  /** The club's own courts (names and where they are). */
  readonly courts?: readonly Court[];
  readonly capacity?: number;
  readonly seed?: number;
  /** Real time now, to pick the night. */
  readonly today?: number;
}

export function newGameNight(opts: GameNightOptions = {}): GameNight {
  const seed = opts.seed ?? 1;
  const date = demoDate(opts.today ?? Date.now());
  const opens = registrationOpensAt(date);
  const { start, end } = sessionWindow(date);
  const club: Club = {
    players: {},
    courts: structuredClone(
      opts.courts?.length ? [...opts.courts] : DEFAULT_COURTS.slice(0, 3), // the practice night keeps its three
    ),
    rules: { ...DEFAULT_RULES, capacity: opts.capacity ?? 25 },
    sessions: [],
  };
  club.players[ORG.id] = {
    id: ORG.id,
    name: "Organizer (demo)",
    createdAt: 0,
    pinHash: "",
    tokenHashes: [],
    mentor: false,
    organizer: true,
    photo: false,
  };
  const cast = CAST.map((s, i) => ({ ...s, id: `demo-${i + 1}` }));
  for (const f of cast) makePlayer(club, f, date);

  // Sign-ups: a rush at 8:00, a second wave over coffee, a few at lunch, the
  // last ones after work.
  const registersAt: Record<string, number> = {};
  const waves = [
    { n: 10, from: 0, to: 4 },
    { n: 7, from: 12, to: 70 },
    { n: 5, from: 4 * 60, to: 5 * 60 },
    { n: 3, from: 8 * 60, to: 9 * 60 + 30 },
  ];
  let k = 0;
  for (const w of waves)
    for (let i = 0; i < w.n; i++, k++)
      registersAt[cast[k]!.id] =
        opens + between(seed, `reg:${k}`, w.from, w.to) * MINUTE;

  // Arrivals: from doors open to twenty minutes in. One doesn't come.
  const arrivesAt: Record<string, number | null> = {};
  cast.forEach((f, i) => {
    arrivesAt[f.id] =
      i === 22
        ? null
        : start + between(seed, `arr:${f.id}`, -15, i > 18 ? 25 : 12) * MINUTE;
  });
  // Two head home half an hour early.
  const leavesAt: Record<string, number> = {
    [cast[3]!.id]: end - 30 * MINUTE,
    [cast[10]!.id]: end - 25 * MINUTE,
  };
  const n: GameNight = {
    v: 1,
    seed,
    date,
    now: opens - 25 * MINUTE,
    club,
    session: emptySession({ id: date, date, label: weekdayLabel(date) }),
    cast,
    registersAt,
    arrivesAt,
    leavesAt,
    returnsAt: {},
    unavailable: [],
    removed: [],
    walkIns: 0,
    dropped: [],
    log: [
      {
        at: opens - 25 * MINUTE,
        text: `Test Game Night for ${weekdayLabel(date)}. 25 fictional players will sign up when registration opens.`,
      },
    ],
  };
  return n;
}

// -----------------------------------------------------------------------------

const name = (n: GameNight, id: string) =>
  n.club.players[id]?.name ?? "Someone";
const first = (n: GameNight, id: string) => name(n, id).split(" ")[0]!;
const rosterOf = (n: GameNight, id: string) =>
  n.session.roster.find((r) => r.playerId === id);
const here = (n: GameNight, id: string) =>
  !!n.session.present[id] && n.session.present[id]!.leftAt === undefined;
const gameOf = (n: GameNight, id: string) =>
  n.session.games.find((g) => isActiveGame(g) && g.slots.includes(id));
const queued = (n: GameNight, id: string) =>
  n.session.queue.some((q) => q.playerId === id);

function say(n: GameNight, text: string) {
  n.log.push({ at: n.now, text });
  if (n.log.length > 200) n.log.splice(0, n.log.length - 200);
}

/** Run one engine command on the copy. Refusals are returned, not thrown. */
function run(n: GameNight, actor: Actor, cmd: SessionCommand): string | null {
  const before = n.session;
  const out = applySession(n.club, before, actor, cmd, n.now);
  if (!out.ok) return out.error;
  n.session = out.value;
  noticeChanges(n, before);
  return null;
}

/**
 * What changed, in words, and what the fictional players will do about it:
 * the four off a finished game catch their breath and tap BACK IN THE QUEUE
 * (now and then someone takes a longer break).
 */
function noticeChanges(n: GameNight, before: Session) {
  const was = new Map(before.games.map((g) => [g.id, g.status]));
  for (const g of n.session.games) {
    const old = was.get(g.id);
    if (old === g.status) continue;
    const four = filled(g.slots).map((id) => first(n, id));
    if (g.status === "called" && old === undefined)
      say(
        n,
        `Court ${g.court} called: ${teamWords(n, g)}. ${g.why.join(" · ")}`,
      );
    else if (g.status === "playing")
      say(n, `Court ${g.court} started: ${four.join(", ")}.`);
    else if (g.status === "finished") {
      const mins = Math.round(
        ((g.finishedAt ?? 0) - (g.startedAt ?? 0)) / MINUTE,
      );
      say(n, `Court ${g.court} finished after ${mins} min.`);
      for (const id of filled(g.slots)) {
        if (n.unavailable.includes(id) || n.removed.includes(id)) continue;
        const rest =
          hash(n.seed, `break:${g.id}:${id}`) < 0.12
            ? between(n.seed, `breaklen:${g.id}:${id}`, 6, 12)
            : between(n.seed, `breath:${g.id}:${id}`, 0, 2);
        n.returnsAt[id] = n.now + rest * MINUTE;
        if (rest >= 6)
          say(n, `${first(n, id)} is taking a ${rest}-minute break.`);
      }
    } else if (g.status === "cancelled" && old && old !== "cancelled")
      say(
        n,
        `Court ${g.court}'s call was sent back; those four keep their places in line.`,
      );
  }
}

export function teamWords(n: GameNight, g: Game): string {
  const t = (a: string | null, b: string | null) =>
    [a, b].map((id) => (id ? first(n, id) : "open spot")).join(" & ");
  return `${t(g.slots[0], g.slots[1])} vs ${t(g.slots[2], g.slots[3])}`;
}

// -----------------------------------------------------------------------------
// The clock.

const ORDER = [
  "doors",
  "register",
  "arrive",
  "finish",
  "start",
  "return",
  "leave",
  "end",
] as const;

type Due = { at: number; kind: (typeof ORDER)[number]; id: string };

function due(n: GameNight): Due[] {
  const s = n.session;
  const { start, end } = sessionWindow(n.date);
  const out: Due[] = [];
  if (s.status === "ended") return out;
  for (const f of n.cast) {
    if (n.removed.includes(f.id)) continue;
    const r = rosterOf(n, f.id);
    if (!r && n.registersAt[f.id] !== undefined)
      out.push({ at: n.registersAt[f.id]!, kind: "register", id: f.id });
    // A walk-in promoted off the waitlist comes when the doors open.
    const arrives =
      f.id in n.arrivesAt ? n.arrivesAt[f.id] : start - 15 * MINUTE;
    if (
      r?.status === "confirmed" &&
      arrives !== null &&
      arrives !== undefined &&
      !s.present[f.id]
    )
      out.push({
        at: Math.max(arrives, start - 15 * MINUTE),
        kind: "arrive",
        id: f.id,
      });
    if (here(n, f.id) && n.leavesAt[f.id] !== undefined && !gameOf(n, f.id))
      out.push({ at: n.leavesAt[f.id]!, kind: "leave", id: f.id });
    if (
      here(n, f.id) &&
      n.returnsAt[f.id] !== undefined &&
      !n.unavailable.includes(f.id) &&
      !queued(n, f.id) &&
      !gameOf(n, f.id)
    )
      out.push({ at: n.returnsAt[f.id]!, kind: "return", id: f.id });
  }
  if (s.status === "upcoming")
    out.push({ at: start - 15 * MINUTE, kind: "doors", id: "" });
  for (const g of s.games) {
    if (g.status === "called" && filled(g.slots).length === 4)
      out.push({
        at: g.calledAt + walkOn(n, g.id) * MINUTE,
        kind: "start",
        id: g.id,
      });
    if (g.status === "playing")
      out.push({
        at: (g.startedAt ?? n.now) + gameMinutes(n, g.id) * MINUTE,
        kind: "finish",
        id: g.id,
      });
  }
  if (s.status === "live") out.push({ at: end, kind: "end", id: "" });
  return out.filter((d) => !n.dropped.includes(`${d.kind}:${d.id}`));
}

/** When the next thing happens, or null once the night is over. */
export function nextAt(n: GameNight): number | null {
  const all = due(n);
  if (!all.length) return null;
  return Math.max(n.now, Math.min(...all.map((d) => d.at)));
}

/** Do everything due by now. */
function settle(n: GameNight) {
  for (let guard = 0; guard < 200; guard++) {
    const ready = due(n)
      .filter((d) => d.at <= n.now)
      .sort(
        (a, b) => a.at - b.at || ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind),
      );
    const d = ready[0];
    if (!d) return;
    happen(n, d);
  }
}

function happen(n: GameNight, d: Due) {
  const s = n.session;
  switch (d.kind) {
    case "register": {
      const err = run(n, as(d.id), { type: "register" });
      if (err) {
        // Never retried: an organizer can add them back by hand.
        delete n.registersAt[d.id];
        return;
      }
      const r = rosterOf(n, d.id);
      const count = n.session.roster.filter(
        (x) => x.status === "confirmed",
      ).length;
      if (count === 1 && r?.status === "confirmed")
        say(n, "Registration is open!");
      say(
        n,
        r?.status === "waitlist"
          ? `${name(n, d.id)} joined the waitlist.`
          : `${name(n, d.id)} signed up (${count} of ${n.club.rules.capacity}).`,
      );
      return;
    }
    case "arrive": {
      const f = n.cast.find((c) => c.id === d.id);
      if (run(n, as(d.id), { type: "check-in" })) {
        n.arrivesAt[d.id] = null;
        return;
      }
      if (f?.mood) run(n, as(d.id), { type: "mood", mood: f.mood });
      const why = f?.nights === 0 ? " — first night at the club" : "";
      say(n, `${name(n, d.id)} arrived and tapped PLAY${why}.`);
      if (!n.unavailable.includes(d.id)) run(n, as(d.id), { type: "play" });
      return;
    }
    case "start":
    case "finish": {
      const g = s.games.find((x) => x.id === d.id)!;
      if (run(n, as(filled(g.slots)[0]!), { type: d.kind, gameId: d.id }))
        n.dropped.push(`${d.kind}:${d.id}`);
      return;
    }
    case "return":
      delete n.returnsAt[d.id];
      run(n, as(d.id), { type: "play" });
      return;
    case "leave":
      delete n.leavesAt[d.id];
      if (!run(n, as(d.id), { type: "leave" }))
        say(n, `${name(n, d.id)} headed home early.`);
      return;
    case "doors":
    case "end":
      if (run(n, ORG, { type: d.kind === "doors" ? "go-live" : "end" }))
        n.dropped.push(`${d.kind}:`);
      else
        say(
          n,
          d.kind === "doors"
            ? "Doors open. Check-in has started."
            : "That's a wrap — the session is complete.",
        );
      return;
  }
}

function copy(n: GameNight): GameNight {
  return structuredClone(n);
}

/** **Next event.** Jump the clock to the next thing that happens, and do it. */
export function nextEvent(night: GameNight): GameNight {
  const n = copy(night);
  const at = nextAt(n);
  if (at === null) return n;
  n.now = at;
  settle(n);
  return n;
}

/** Let time pass: everything due in the next `minutes` happens. */
export function advance(night: GameNight, minutes: number): GameNight {
  let n = copy(night);
  const until = n.now + minutes * MINUTE;
  for (let guard = 0; guard < 500; guard++) {
    const at = nextAt(n);
    if (at === null || at > until) break;
    n = nextEvent(n);
  }
  if (n.session.status !== "ended") n.now = Math.max(n.now, until);
  return n;
}

/** Straight to the end of the night. */
export function playToEnd(night: GameNight): GameNight {
  let n = night;
  for (let guard = 0; guard < 2000 && nextAt(n) !== null; guard++)
    n = nextEvent(n);
  return n;
}

// -----------------------------------------------------------------------------
// The organizer's controls. Each returns the new night or why not.

function organizer(
  night: GameNight,
  change: (n: GameNight) => string | null,
): Outcome<GameNight> {
  const n = copy(night);
  const err = change(n);
  if (err) return { ok: false, error: err };
  const broken = unsound(n.club, n.session);
  if (broken)
    return { ok: false, error: `That would break the night (${broken}).` };
  return { ok: true, value: n };
}

export const startGame = (night: GameNight, gameId: string) =>
  organizer(night, (n) => run(n, ORG, { type: "start", gameId }));

export const finishGame = (night: GameNight, gameId: string) =>
  organizer(night, (n) => run(n, ORG, { type: "finish", gameId }));

export const sendBack = (night: GameNight, gameId: string) =>
  organizer(night, (n) =>
    run(n, ORG, { type: "cancel-game", gameId, reason: "Organizer" }),
  );

/** Every game on court ends; the next fours are called on. */
export const rotate = (night: GameNight) =>
  organizer(night, (n) => {
    const playing = n.session.games.filter((g) => g.status === "playing");
    if (!playing.length) return "No games are being played yet.";
    for (const g of playing) {
      const err = run(n, ORG, { type: "finish", gameId: g.id });
      if (err) return err;
    }
    say(n, "Organizer rotated the courts.");
    return null;
  });

/**
 * **Assign the next group.** The game on that court ends now and the four
 * the fairness engine has prepared go on, by the same rule as always.
 */
export const assignNext = (night: GameNight, court: number) =>
  organizer(night, (n) => {
    if (n.session.status !== "live") return "The night hasn't started yet.";
    if (n.session.closedCourts.includes(court)) return "That court is closed.";
    const g = n.session.games.find((x) => x.court === court && isActiveGame(x));
    if (g?.status === "called")
      return `Court ${court}'s next group is already called — start it, or send it back.`;
    if (g) {
      const err = run(n, ORG, { type: "finish", gameId: g.id });
      if (err) return err;
    }
    const now = n.session.games.find(
      (x) => x.court === court && isActiveGame(x),
    );
    if (!now || now.id === g?.id)
      return "Fewer than four people are waiting for that court.";
    return null;
  });

/** The organizer picks four for a free court. */
export const assignFour = (
  night: GameNight,
  court: number,
  slots: [string, string, string, string],
) => organizer(night, (n) => run(n, ORG, { type: "assign", court, slots }));

/**
 * **Move a player to another court**: they swap places with someone in the
 * game there. A demonstration control — the club app does this by sending a
 * call back and assigning four.
 */
export const movePlayer = (
  night: GameNight,
  playerId: string,
  swapWith: string,
) =>
  organizer(night, (n) => {
    const a = gameOf(n, playerId);
    const b = gameOf(n, swapWith);
    if (!a) return `${name(n, playerId)} isn't on a court.`;
    if (!b) return `${name(n, swapWith)} isn't on a court.`;
    if (a.id === b.id) return "They're already on the same court.";
    const i = a.slots.indexOf(playerId);
    const j = b.slots.indexOf(swapWith);
    a.slots = a.slots.map((x, k) => (k === i ? swapWith : x)) as Slots;
    b.slots = b.slots.map((x, k) => (k === j ? playerId : x)) as Slots;
    for (const g of [a, b])
      g.why = [
        ...g.why.filter((w) => !w.startsWith("Moved")),
        "Moved by the organizer",
      ];
    say(
      n,
      `Organizer moved ${first(n, playerId)} to court ${b.court} and ${first(n, swapWith)} to court ${a.court}.`,
    );
    return null;
  });

/** Unavailable: out of the line until marked available again. */
export const setUnavailable = (
  night: GameNight,
  playerId: string,
  off: boolean,
) =>
  organizer(night, (n) => {
    if (off) {
      const g = gameOf(n, playerId);
      if (g?.status === "called") {
        const err = run(n, as(playerId), {
          type: "decline",
          gameId: g.id,
          pause: true,
        });
        if (err) return err;
      }
      run(n, ORG, { type: "pause", playerId });
      if (!n.unavailable.includes(playerId)) n.unavailable.push(playerId);
      delete n.returnsAt[playerId];
      say(
        n,
        g?.status === "playing"
          ? `${first(n, playerId)} will sit out after this game.`
          : `${first(n, playerId)} is marked unavailable.`,
      );
      return null;
    }
    n.unavailable = n.unavailable.filter((x) => x !== playerId);
    say(n, `${first(n, playerId)} is available again.`);
    if (here(n, playerId) && !gameOf(n, playerId))
      return run(n, as(playerId), { type: "play" });
    return null;
  });

export const setPlayNext = (night: GameNight, playerId: string, on: boolean) =>
  organizer(night, (n) => run(n, ORG, { type: "play-next", playerId, on }));

export const setCourtClosed = (
  night: GameNight,
  court: number,
  closed: boolean,
) =>
  organizer(night, (n) => run(n, ORG, { type: "court-closed", court, closed }));

/** A walk-in: signs up (a waitlist once 25 are in) and, if in, plays. */
export const addPlayer = (night: GameNight) =>
  organizer(night, (n) => {
    const spec = WALK_INS[n.walkIns % WALK_INS.length]!;
    const round = Math.floor(n.walkIns / WALK_INS.length);
    const f: Fictional = {
      ...spec,
      name: round ? `${spec.name} ${round + 1}` : spec.name,
      id: `demo-w${n.walkIns + 1}`,
    };
    makePlayer(n.club, f, n.date);
    const err = run(n, ORG, { type: "register", playerId: f.id });
    if (err) {
      delete n.club.players[f.id];
      return err;
    }
    n.walkIns += 1;
    n.cast.push(f);
    const r = rosterOf(n, f.id)!;
    if (r.status === "waitlist") {
      say(
        n,
        `${f.name} was added — tonight is full, so they're on the waitlist.`,
      );
      return null;
    }
    say(n, `${f.name} was added.`);
    if (n.session.status === "live") {
      run(n, ORG, { type: "check-in", playerId: f.id });
      run(n, as(f.id), { type: "play" });
    } else n.arrivesAt[f.id] = sessionWindow(n.date).start;
    return null;
  });

/** Removed from tonight: their space goes to the waitlist. */
export const removePlayer = (night: GameNight, playerId: string) =>
  organizer(night, (n) => {
    const g = gameOf(n, playerId);
    if (g?.status === "playing") return "Finish their game first.";
    if (g?.status === "called") {
      const err = run(n, as(playerId), {
        type: "decline",
        gameId: g.id,
        pause: true,
      });
      if (err) return err;
    }
    if (!rosterOf(n, playerId)) {
      delete n.registersAt[playerId];
      n.removed.push(playerId);
      say(n, `${name(n, playerId)} won't sign up tonight.`);
      return null;
    }
    const err = run(n, ORG, { type: "cancel", playerId });
    if (err) return err;
    n.removed.push(playerId);
    delete n.returnsAt[playerId];
    say(n, `${name(n, playerId)} was removed from tonight.`);
    return null;
  });

// -----------------------------------------------------------------------------
// What the screen shows.

export type Stage = "before" | "during" | "after";

export interface Moment {
  readonly stage: Stage;
  /** "Waiting for registration", "Players arriving", … */
  readonly title: string;
  readonly detail: string;
}

export function moment(n: GameNight): Moment {
  const s = n.session;
  const { start } = sessionWindow(n.date);
  const confirmed = s.roster.filter((r) => r.status === "confirmed").length;
  if (s.status === "ended")
    return {
      stage: "after",
      title: "Session complete",
      detail: "Everyone's games, minutes and new partners are below.",
    };
  if (s.status === "live") {
    const active = s.games.filter(isActiveGame).length;
    if (!s.games.length)
      return {
        stage: "before",
        title: "Waiting for courts",
        detail: `${Object.keys(s.present).length} checked in. A court is called as soon as four are in line.`,
      };
    const arriving = n.cast.filter(
      (f) =>
        rosterOf(n, f.id)?.status === "confirmed" &&
        !s.present[f.id] &&
        n.arrivesAt[f.id] != null,
    ).length;
    return {
      stage: "during",
      title: arriving ? "Players arriving" : "Courts in play",
      detail: `${active} court${active === 1 ? "" : "s"} busy · ${s.queue.length} in line${arriving ? ` · ${arriving} still on their way` : ""}`,
    };
  }
  if (n.now < registrationOpensAt(n.date))
    return {
      stage: "before",
      title: "Before registration",
      detail: "Nobody can sign up until 8:00 a.m. on the day.",
    };
  if (n.now < start - 15 * MINUTE)
    return {
      stage: "before",
      title: "Players registered",
      detail: `${confirmed} of ${n.club.rules.capacity} signed up so far.`,
    };
  return {
    stage: "before",
    title: "Doors about to open",
    detail: `${confirmed} signed up.`,
  };
}

export interface SeatView {
  readonly id: string;
  readonly name: string;
}

export interface CourtView {
  readonly id: number;
  readonly name: string;
  readonly where: string;
  readonly closed: boolean;
  readonly game: {
    readonly id: string;
    readonly status: "called" | "playing";
    readonly teams: [SeatView[], SeatView[]];
    readonly why: readonly string[];
    readonly source: Game["source"];
    /** Minutes on court so far (playing), or since called. */
    readonly minutes: number;
  } | null;
  /** The four prepared to go on next, and why. */
  readonly next: {
    readonly players: SeatView[];
    readonly why: readonly string[];
  } | null;
}

export type PlayerState =
  | "not signed up"
  | "registered"
  | "waitlist"
  | "on the way"
  | "no-show"
  | "in line"
  | "called"
  | "playing"
  | "catching breath"
  | "on a break"
  | "unavailable"
  | "headed home"
  | "removed"
  | "done";

export interface PlayerRow {
  readonly id: string;
  readonly name: string;
  readonly level: string | null;
  readonly mood: string | null;
  readonly nights: number;
  readonly state: PlayerState;
  readonly court: number | null;
  readonly games: number;
  readonly minutes: number;
  /** Minutes waiting in line tonight, including now. */
  readonly waited: number;
  /** Minutes in line right now, if in line. */
  readonly waitingNow: number | null;
  readonly linePosition: number | null;
  readonly playNext: boolean;
  readonly met: number;
  readonly partners: number;
}

export interface Picture {
  readonly now: string;
  readonly date: string;
  readonly moment: Moment;
  readonly countdown: Countdown;
  readonly capacity: number;
  readonly confirmed: number;
  readonly waitlisted: number;
  readonly courts: CourtView[];
  readonly line: PlayerRow[];
  readonly players: PlayerRow[];
  readonly gamesPlayed: number;
  readonly spread: { readonly fewest: number; readonly most: number } | null;
  readonly log: LogLine[];
  readonly next: string | null;
  /** The engine's own check: null when nobody is in two places. */
  readonly broken: string | null;
}

export function picture(n: GameNight): Picture {
  const s = n.session;
  const t = tonight(s);
  const line = inOrder(n.club, s);
  const pos = new Map(line.map((w, i) => [w.playerId, i]));
  const ready = prepared(n.club, s, n.now);
  const seat = (id: string): SeatView => ({ id, name: name(n, id) });
  const nextUp = new Set(s.nextUp ?? []);

  const courts: CourtView[] = n.club.courts.map((c) => {
    const g = s.games.find((x) => x.court === c.id && isActiveGame(x));
    const p = ready.find((x) => x.court === c.id);
    return {
      id: c.id,
      name: c.name,
      where: c.where,
      closed: s.closedCourts.includes(c.id),
      game: g
        ? {
            id: g.id,
            status: g.status as "called" | "playing",
            teams: [
              g.slots
                .slice(0, 2)
                .filter((x): x is string => !!x)
                .map(seat),
              g.slots
                .slice(2, 4)
                .filter((x): x is string => !!x)
                .map(seat),
            ],
            why: g.why,
            source: g.source,
            minutes: Math.max(
              0,
              Math.round((n.now - (g.startedAt ?? g.calledAt)) / MINUTE),
            ),
          }
        : null,
      next: p ? { players: filled(p.slots).map(seat), why: p.why } : null,
    };
  });

  const stateOf = (f: Fictional): PlayerState => {
    const r = rosterOf(n, f.id);
    if (n.removed.includes(f.id)) return "removed";
    const g = gameOf(n, f.id);
    if (g) return g.status === "playing" ? "playing" : "called";
    if (s.status === "ended")
      return s.present[f.id] ? "done" : r ? "no-show" : "not signed up";
    if (!r) return "not signed up";
    if (r.status === "waitlist") return "waitlist";
    if (r.status !== "confirmed") return "removed";
    const p = s.present[f.id];
    if (!p)
      return s.status === "live"
        ? n.arrivesAt[f.id] === null
          ? "no-show"
          : "on the way"
        : "registered";
    if (p.leftAt !== undefined) return "headed home";
    if (queued(n, f.id)) return "in line";
    if (n.unavailable.includes(f.id)) return "unavailable";
    const back = n.returnsAt[f.id];
    if (back !== undefined && back - n.now >= 4 * MINUTE) return "on a break";
    return "catching breath";
  };

  const rows: PlayerRow[] = n.cast.map((f) => {
    const me = t.get(f.id);
    const q = s.queue.find((x) => x.playerId === f.id);
    const waitingNow = q
      ? Math.max(0, Math.round((n.now - q.since) / MINUTE))
      : null;
    const partners = new Set<string>();
    for (const g of s.games)
      if (g.status === "finished") {
        const p = partnerIn(g, f.id);
        if (p) partners.add(p);
      }
    return {
      id: f.id,
      name: f.name,
      level: LEVELS.find((l) => l.id === f.level)?.label ?? null,
      mood: MOODS.find((m) => m.id === f.mood)?.label ?? null,
      nights: f.nights,
      state: stateOf(f),
      court: gameOf(n, f.id)?.court ?? null,
      games: me?.games ?? 0,
      minutes: me?.minutes ?? 0,
      waited: (me?.waited ?? 0) + (waitingNow ?? 0),
      waitingNow,
      linePosition: pos.has(f.id) ? pos.get(f.id)! + 1 : null,
      playNext: nextUp.has(f.id),
      met: me?.met.size ?? 0,
      partners: partners.size,
    };
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const present = rows.filter(
    (r) => s.present[r.id] && !["no-show", "removed"].includes(r.state),
  );
  const spread = present.length
    ? {
        fewest: Math.min(...present.map((r) => r.games)),
        most: Math.max(...present.map((r) => r.games)),
      }
    : null;
  const at = nextAt(n);
  return {
    now: localClock(n.now),
    date: n.date,
    moment: moment(n),
    countdown: registrationCountdown(n.date, n.now),
    capacity: n.club.rules.capacity,
    confirmed: s.roster.filter((r) => r.status === "confirmed").length,
    waitlisted: s.roster.filter((r) => r.status === "waitlist").length,
    courts,
    line: line.map((w) => byId.get(w.playerId)!).filter(Boolean),
    players: rows,
    gamesPlayed: s.games.filter((g) => g.status === "finished").length,
    spread,
    log: n.log.slice(-40).reverse(),
    next: at === null ? null : localClock(at),
    broken: unsound(n.club, s),
  };
}

/** Everyone on a court right now, for checks: never anyone twice. */
export function onCourt(n: GameNight): string[] {
  return n.session.games.filter(isActiveGame).flatMap((g) => filled(g.slots));
}
