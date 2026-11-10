import { applySession, unsound, type SessionCommand } from "./engine";
import { LEVELS, type Level } from "./journey";
import {
  MOODS,
  emptyClub,
  emptySession,
  isActiveGame,
  type Club,
  type Mood,
  type Session,
} from "./model";
import { registrationOpensAt } from "./schedule";

/**
 * **The Thursday demonstration.** Three nights with made-up players, run
 * through the real engine — the same code that runs a club night — so what is
 * shown is what CourtQueue would do, not a picture of it. Nobody here is a
 * real member and nothing is stored.
 *
 * The page shows each player's level and mood so the story can be told. In
 * the app itself nobody sees anyone else's.
 */

export interface DemoPlayer {
  readonly name: string;
  readonly level: string | null;
  readonly mood: string | null;
  readonly note: string;
}

export interface DemoCourt {
  readonly court: number;
  readonly status: "called" | "playing";
  readonly source: "fair" | "challenge" | "organizer";
  readonly teams: [string[], string[]];
  readonly why: readonly string[];
}

export interface DemoFrame {
  readonly caption: string;
  readonly courts: DemoCourt[];
  readonly line: string[];
}

export interface DemoScenario {
  readonly id: string;
  readonly title: string;
  readonly story: string;
  readonly players: DemoPlayer[];
  readonly frames: DemoFrame[];
}

interface Spec {
  readonly name: string;
  readonly level?: Level;
  readonly mood?: Mood;
  readonly help?: boolean;
  readonly volunteer?: boolean;
  readonly newcomer?: boolean;
  readonly note: string;
}

const DATE = "2026-11-12";
const OPENS = registrationOpensAt(DATE);
const NIGHT_AT = Date.UTC(2026, 10, 13, 1, 30); // Thu 6:30 pm in BC
const MIN = 60_000;

const ORG = { id: "org", organizer: true };

function build(specs: readonly Spec[]) {
  const club: Club = emptyClub();
  specs.forEach((p, i) => {
    const id = `d${i + 1}`;
    club.players[id] = {
      id,
      name: p.name,
      createdAt: p.newcomer
        ? Date.parse(DATE) - 3 * 24 * 60 * MIN
        : Date.parse(DATE) - 200 * 24 * 60 * MIN,
      pinHash: "",
      tokenHashes: [],
      mentor: !!p.volunteer,
      organizer: false,
      photo: false,
      journey: {
        asked: true,
        goals: [],
        practising: [],
        done: [],
        ...(p.level ? { level: p.level } : {}),
        ...(p.help ? { wantsHelp: true } : {}),
      },
    };
  });
  club.players.org = {
    id: "org",
    name: "Organizer",
    createdAt: 0,
    pinHash: "",
    tokenHashes: [],
    mentor: false,
    organizer: true,
    photo: false,
  };
  return club;
}

const label = (l: string | undefined) =>
  LEVELS.find((x) => x.id === l)?.label ?? null;
const moodLabel = (m: string | undefined) =>
  MOODS.find((x) => x.id === m)?.label ?? null;

/** Drives one night and takes a snapshot after each chosen step. */
class Night {
  readonly club: Club;
  s: Session = emptySession({ id: DATE, date: DATE, label: "Thursday" });
  readonly frames: DemoFrame[] = [];
  private t = NIGHT_AT;

  constructor(readonly specs: readonly Spec[]) {
    this.club = build(specs);
  }

  id(name: string): string {
    const i = this.specs.findIndex((p) => p.name === name);
    if (i < 0) throw new Error(`no demo player ${name}`);
    return `d${i + 1}`;
  }

  do(who: string | "org", cmd: SessionCommand, atMin = 0) {
    this.t = NIGHT_AT + atMin * MIN;
    const actor = who === "org" ? ORG : { id: this.id(who), organizer: false };
    const out = applySession(this.club, this.s, actor, cmd, this.t);
    if (!out.ok) throw new Error(`${cmd.type} by ${who}: ${out.error}`);
    this.s = out.value;
    const broken = unsound(this.club, this.s);
    if (broken) throw new Error(`demo night unsound: ${broken}`);
  }

  arrive(names: readonly string[], atMin = 0) {
    for (const n of names) {
      this.t = OPENS + MIN;
      const out = applySession(
        this.club,
        this.s,
        { id: this.id(n), organizer: false },
        { type: "register" },
        this.t,
      );
      if (!out.ok) throw new Error(`register ${n}: ${out.error}`);
      this.s = out.value;
    }
    if (!this.s.status || this.s.status === "upcoming")
      this.do("org", { type: "go-live" }, atMin);
    for (const n of names) {
      this.do(n, { type: "check-in" }, atMin);
    }
  }

  queue(names: readonly string[], atMin = 0) {
    for (const n of names) this.do(n, { type: "play" }, atMin);
  }

  mood(name: string) {
    const m = this.specs.find((p) => p.name === name)?.mood;
    if (m) this.do(name, { type: "mood", mood: m });
  }

  snap(caption: string) {
    const name = (id: string | null) =>
      id ? (this.club.players[id]?.name ?? "Someone") : "open spot";
    this.frames.push({
      caption,
      courts: this.s.games
        .filter(isActiveGame)
        .sort((a, b) => a.court - b.court)
        .map((g) => ({
          court: g.court,
          status: g.status as "called" | "playing",
          source: g.source,
          teams: [
            g.slots.slice(0, 2).map(name),
            g.slots.slice(2, 4).map(name),
          ] as [string[], string[]],
          why: g.why,
        })),
      line: this.s.queue.map((q) => name(q.playerId)),
    });
  }

  players(): DemoPlayer[] {
    return this.specs.map((p) => ({
      name: p.name,
      level: label(p.level),
      mood: moodLabel(p.mood),
      note: p.note,
    }));
  }
}

// -----------------------------------------------------------------------------

function newPlayer(): DemoScenario {
  const specs: Spec[] = [
    {
      name: "Maya",
      level: "beginner",
      help: true,
      newcomer: true,
      note: "First night. Said she's a Beginner and would love a friendly partner.",
    },
    {
      name: "Sam",
      level: "advanced",
      mood: "help",
      note: "Chose Happy to Help for tonight.",
    },
    {
      name: "Priya",
      level: "intermediate",
      mood: "fun",
      note: "Just here to play.",
    },
    {
      name: "Tom",
      level: "intermediate",
      note: "Hasn't said a level — and that's fine.",
    },
    {
      name: "Lena",
      level: "beginner",
      mood: "rallies",
      note: "Looking for steady rallies.",
    },
    {
      name: "Ravi",
      level: "intermediate",
      mood: "fun",
      note: "Just here to play.",
    },
    {
      name: "Jo",
      level: "advanced",
      mood: "challenge",
      note: "Wants a stretch tonight.",
    },
    {
      name: "Ben",
      level: "intermediate",
      mood: "fun",
      note: "Just here to play.",
    },
  ];
  const n = new Night(specs);
  const names = specs.map((p) => p.name);
  n.arrive(names);
  for (const x of names) n.mood(x);
  n.queue(["Maya", "Priya", "Sam", "Tom", "Lena", "Ravi", "Jo", "Ben"], 1);
  n.snap(
    "Maya taps PLAY first, so she's first in line. Sam said Happy to Help.",
  );
  return {
    id: "new-player",
    title: "A new player joins comfortably",
    story:
      "Maya is brand new. She answers one friendly question, taps PLAY, and the first court she's called to has a player who chose Happy to Help — no one assigned them, and no one was made to coach. Nobody sees Maya's answer, not even Sam.",
    players: n.players(),
    frames: n.frames,
  };
}

function challenging(): DemoScenario {
  const specs: Spec[] = [
    {
      name: "Alex",
      level: "advanced",
      mood: "challenge",
      note: "Challenge Me.",
    },
    {
      name: "Dana",
      level: "advanced",
      mood: "challenge",
      note: "Challenge Me.",
    },
    {
      name: "Kai",
      level: "beginner",
      mood: "fun",
      newcomer: false,
      note: "Just here to play.",
    },
    {
      name: "Noor",
      level: "intermediate",
      mood: "rallies",
      note: "Find My Rhythm.",
    },
    {
      name: "Eli",
      level: "advanced",
      mood: "challenge",
      note: "Challenge Me.",
    },
    {
      name: "Fern",
      level: "beginner",
      mood: "fun",
      note: "Just here to play.",
    },
    {
      name: "Omar",
      level: "advanced",
      mood: "challenge",
      note: "Challenge Me.",
    },
    {
      name: "Wen",
      level: "intermediate",
      mood: "fun",
      note: "Just here to play.",
    },
    {
      name: "Ines",
      level: "beginner",
      mood: "rallies",
      note: "Find My Rhythm.",
    },
    {
      name: "Gus",
      level: "intermediate",
      mood: "fun",
      note: "Just here to play.",
    },
    {
      name: "Rose",
      level: "beginner",
      mood: "fun",
      note: "Just here to play.",
    },
    {
      name: "Hugo",
      level: "intermediate",
      mood: "fun",
      note: "Just here to play.",
    },
  ];
  const n = new Night(specs);
  const names = specs.map((p) => p.name);
  n.arrive(names);
  for (const x of names) n.mood(x);
  // Four who all chose Challenge Me arrived together and tapped PLAY
  // together; the rest drifted in. Line order always comes first.
  n.queue(
    [
      "Alex",
      "Dana",
      "Eli",
      "Omar",
      "Kai",
      "Noor",
      "Fern",
      "Wen",
      "Ines",
      "Gus",
      "Rose",
      "Hugo",
    ],
    1,
  );
  n.snap("Twelve players, three courts. Everyone gets a game straight away.");
  return {
    id: "challenging-match",
    title: "Experienced players enjoy a challenging match",
    story:
      "Four players picked Challenge Me, so the first court is a good, lively game for them — while everyone else is called to the other two courts at the same moment. Nobody waits for a stronger game and nobody is held back from one.",
    players: n.players(),
    frames: n.frames,
  };
}

function invite(): DemoScenario {
  const specs: Spec[] = [
    {
      name: "Jordan",
      level: "beginner",
      mood: "challenge",
      note: "Newer, and curious. Chose Challenge Me.",
    },
    { name: "Mina", level: "beginner", mood: "fun", note: "Jordan's friend." },
    {
      name: "Alex",
      level: "advanced",
      mood: "fun",
      note: "A strong player who enjoys it.",
    },
    { name: "Dana", level: "advanced", mood: "help", note: "Happy to Help." },
    {
      name: "Tom",
      level: "intermediate",
      mood: "fun",
      note: "Just here to play.",
    },
    {
      name: "Lena",
      level: "intermediate",
      mood: "rallies",
      note: "Find My Rhythm.",
    },
    {
      name: "Ravi",
      level: "intermediate",
      mood: "fun",
      note: "Just here to play.",
    },
    {
      name: "Ben",
      level: "intermediate",
      mood: "fun",
      note: "Just here to play.",
    },
    {
      name: "Priya",
      level: "intermediate",
      mood: "fun",
      note: "Just here to play.",
    },
    { name: "Sam", level: "advanced", mood: "fun", note: "Just here to play." },
    {
      name: "Fern",
      level: "beginner",
      mood: "fun",
      note: "Just here to play.",
    },
    {
      name: "Wen",
      level: "intermediate",
      mood: "fun",
      note: "Just here to play.",
    },
  ];
  const n = new Night(specs);
  const names = specs.map((p) => p.name);
  n.arrive(names);
  n.queue(["Tom", "Lena", "Ravi", "Ben", "Priya", "Sam", "Fern", "Wen"], 1);
  n.snap("Eight players are in line and two courts are busy.");
  n.do(
    "Jordan",
    {
      type: "challenge",
      slots: [n.id("Jordan"), n.id("Mina"), n.id("Alex"), n.id("Dana")],
      note: "Fancy a friendly game, Alex?",
    },
    2,
  );
  for (const who of ["Mina", "Alex", "Dana"]) {
    const ch = n.s.challenges.at(-1)!;
    n.do(who, { type: "challenge-accept", challengeId: ch.id }, 3);
  }
  n.queue(["Jordan", "Mina", "Alex", "Dana"], 4);
  n.snap(
    "Jordan asks Alex and Dana for a game. All four say yes and tap PLAY. Court 3 is free and nobody is waiting for a first game, so it goes straight on.",
  );
  return {
    id: "newer-challenges-stronger",
    title: "A newer player chooses to challenge a stronger player",
    story:
      "Jordan is newer and picked Challenge Me, so he asks a stronger player for a game. Alex says yes. It's Jordan's choice and Alex's choice — CourtQueue never decides who may play whom. The invite goes on a court as soon as that's fair to everyone still waiting for a first game.",
    players: n.players(),
    frames: n.frames,
  };
}

export function demoScenarios(): DemoScenario[] {
  return [newPlayer(), challenging(), invite()];
}
