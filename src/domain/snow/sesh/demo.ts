/**
 * **Demo Mode's world** — fictional, deterministic, and never mixed with
 * real riders.
 *
 * Thirty made-up riders in four made-up crews, made-up features on three
 * real mountains (each marked `demo`, named so nobody mistakes one for a
 * real jump), and a week and a half of clips, challenges, votes, chirps and
 * reactions laid out relative to the moment the demo was opened. The clips
 * are drawn illustrations (ClipMedia "illustration"), never footage.
 *
 * The demo runs entirely on the visitor's phone (`components/snow/sesh/
 * demoStore.ts`), with the same rules as the real thing (`./actions.ts`).
 * Nothing a visitor does in it is sent anywhere.
 */
import type {
  Category,
  Challenge,
  Chirp,
  Clip,
  Division,
  Feature,
  Reaction,
  Rider,
  Sport,
  Vote,
  World,
} from "./model";
import { CATEGORIES, REACTIONS } from "./model";
import { VOTING_MS, challengeState } from "./rules";

export const DEMO_YOU = "demo-you";

export const DEMO_CREWS = [
  "Snowhawk Squadron",
  "Bomber Box Brigade",
  "Glacier Gremlins",
  "Night Owl Wing",
] as const;

const F = (
  id: string,
  mountainId: string,
  name: string,
  kind: Feature["kind"],
  sizes: Feature["sizes"],
  description: string,
): Feature => ({
  id,
  mountainId,
  name,
  kind,
  sizes,
  where: "Demo park (fictional)",
  description,
  status: "approved",
  demo: true,
});

export const DEMO_FEATURES: readonly Feature[] = [
  F(
    "d-ss-comet",
    "silverstar",
    "Comet Kicker",
    "jump",
    ["small"],
    "A friendly little tabletop with a long, forgiving landing. Fictional.",
  ),
  F(
    "d-ss-starlight",
    "silverstar",
    "Starlight Rail",
    "rail",
    ["small", "medium"],
    "A flat-down rail for 50-50s and boardslides. Fictional.",
  ),
  F(
    "d-ss-aurora",
    "silverstar",
    "Aurora Box",
    "box",
    ["small"],
    "A wide, low box where most riders get their first slide. Fictional.",
  ),
  F(
    "d-ss-rollers",
    "silverstar",
    "Powder Puff Rollers",
    "roller",
    ["small"],
    "A line of rollers to pump, press and butter. Fictional.",
  ),
  F(
    "d-bw-bomber",
    "big-white",
    "Bomber Box",
    "box",
    ["medium"],
    "A long box with a kink at the end. Fictional.",
  ),
  F(
    "d-bw-cloud",
    "big-white",
    "Cloud Nine Tabletop",
    "jump",
    ["medium"],
    "A medium tabletop with room for grabs. Fictional.",
  ),
  F(
    "d-bw-twin",
    "big-white",
    "Twin Prop Rails",
    "rail",
    ["medium"],
    "Two rails side by side — made for head-to-heads. Fictional.",
  ),
  F(
    "d-wb-glacier",
    "whistler-blackcomb",
    "Glacier Jib Zone",
    "jib",
    ["small", "medium"],
    "Logs, tubes and a wall ride. Fictional.",
  ),
  F(
    "d-wb-hip",
    "whistler-blackcomb",
    "Spitfire Hip",
    "jump",
    ["medium"],
    "A smooth hip for style over size. Fictional.",
  ),
  F(
    "d-wb-ribbons",
    "whistler-blackcomb",
    "Ribbon Rollers",
    "roller",
    ["small"],
    "Rollers and a mini spine. Fictional.",
  ),
];

const NAMES = [
  "Mako",
  "Juniper",
  "Tank",
  "Pixie",
  "Boomer",
  "Lefty",
  "Noodle",
  "Ziggy",
  "Moose",
  "Kit",
  "Rook",
  "Sparrow",
  "Biscuit",
  "Wren",
  "Otter",
  "Flapjack",
  "Comet",
  "Hazel",
  "Jett",
  "Pip",
  "Maverick",
  "Clover",
  "Gizmo",
  "Sunny",
  "Bandit",
  "Marmot",
  "Echo",
  "Taco",
  "Willow",
  "Rascal",
];

const MOUNTAINS = ["silverstar", "big-white", "whistler-blackcomb"] as const;
const DIVS: readonly Division[] = ["beginner", "intermediate", "advanced"];

/** A tiny deterministic PRNG (mulberry32). */
export function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CAPTIONS: Partial<Record<Category, string[]>> = {
  "king-queen": [
    "Owned it all lap",
    "Whole line, no hands down",
    "Run of the day",
  ],
  "best-trick": [
    "Frontside 180, finally!",
    "Tail grab, held it",
    "First 270 on",
    "Backside boardslide",
  ],
  "best-style": [
    "Slow and steezy",
    "Tweaked it a little",
    "Smooth like butter",
  ],
  "cleanest-landing": [
    "Stuck it",
    "Landed in the sweet spot",
    "Clean as a whistle",
  ],
  "most-creative": [
    "Hand drag on the way by",
    "Who says you can't butter a box",
    "Nose press the whole way",
  ],
  "best-progression": [
    "Last week I couldn't even ollie this",
    "First time on the medium!",
    "Getting there",
  ],
  "harmless-bail": [
    "Rode away laughing",
    "Washed out, popped right up",
    "Soft snow, softer ego",
  ],
};

const CHIRPS = [
  "Clean! 🧼",
  "Teach me that one",
  "Okay that's my new goal",
  "Style for days",
  "That grab though",
  "Respect. Your move ⚔️",
  "Nice try, see you at the top 😂",
  "Grabbed it AND stuck it?",
  "Snowhawks represent!",
  "This is the one to beat",
  "Rematch tomorrow?",
  "Lowkey the best one today",
];

const H = 3_600_000;
const D = 24 * H;

/**
 * Build the demo world, laid out around `t0` (the moment it was first
 * opened). The same `t0` always builds the same world.
 */
export function demoWorld(t0: number): World {
  const rnd = prng(20261110);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
  const iso = (ms: number) => new Date(ms).toISOString();

  const riders: Rider[] = NAMES.map((name, i) => ({
    id: `d-r${String(i + 1).padStart(2, "0")}`,
    name,
    homeMountain: MOUNTAINS[i % 3],
    sport: (i % 5 === 2 || i % 5 === 4 ? "ski" : "snowboard") as Sport,
    division: DIVS[i % 3],
    // Six of the thirty are 13–17 — the demo shows how they're protected.
    ageGroup: i % 5 === 3 ? "youth" : "adult",
    since: iso(t0 - 40 * D),
    crew: i % 7 === 6 ? undefined : DEMO_CREWS[i % 4],
    demo: true,
  }));
  riders.push({
    id: DEMO_YOU,
    name: "You",
    homeMountain: "silverstar",
    sport: "snowboard",
    division: "intermediate",
    ageGroup: "adult",
    since: iso(t0),
    demo: true,
  });

  const clips: Clip[] = [];
  const challenges: Challenge[] = [];
  const votes: Vote[] = [];
  const chirps: Chirp[] = [];
  const reactions: Reaction[] = [];
  let n = 0;
  const id = (p: string) => `${p}${(++n).toString(36)}`;

  const fictional = riders.filter((r) => r.id !== DEMO_YOU);
  const peers = (r: Rider) =>
    fictional.filter(
      (x) =>
        x.id !== r.id && x.division === r.division && x.ageGroup === r.ageGroup,
    );

  const makeClip = (
    f: Feature,
    r: Rider,
    at: number,
    category: Category,
  ): Clip => {
    const c: Clip = {
      id: id("dc"),
      featureId: f.id,
      riderId: r.id,
      sport: r.sport,
      division: r.division ?? "intermediate",
      category,
      caption: pick(CAPTIONS[category] ?? ["Sesh!"]),
      at: iso(at),
      media: { kind: "illustration", seed: Math.floor(rnd() * 1e6) },
      status: "published",
    };
    clips.push(c);
    for (const who of fictional)
      if (
        who.id !== r.id &&
        rnd() < 0.18 &&
        !(r.ageGroup === "youth" && who.ageGroup === "adult" && rnd() < 0.5)
      )
        reactions.push({
          clipId: c.id,
          riderId: who.id,
          kind: pick(REACTIONS),
        });
    return c;
  };

  const chirpOn = (
    kind: Chirp["thread"]["kind"],
    tid: string,
    at: number,
    among: readonly Rider[],
  ) => {
    const k = 1 + Math.floor(rnd() * 3);
    for (let i = 0; i < k; i++) {
      const author = pick(among);
      chirps.push({
        id: id("dk"),
        thread: { kind, id: tid },
        authorId: author.id,
        body: pick(CHIRPS),
        at: iso(at + (i + 1) * 7 * 60_000),
        status: "published",
      });
    }
  };

  /** A challenge between two clips; `lean` is the challenger's vote share. */
  const duel = (
    f: Feature,
    a: Rider,
    b: Rider,
    start: number,
    lean: number,
    voters: number,
  ) => {
    const category = pick(
      CATEGORIES.filter((c) => c !== "harmless-bail" || rnd() < 0.3),
    );
    const def = makeClip(f, a, start - 3 * H, category);
    const ans = makeClip(f, b, start, category);
    const ch: Challenge = {
      id: id("dx"),
      featureId: f.id,
      category,
      division: def.division,
      defenderClipId: def.id,
      challengerClipId: ans.id,
      at: iso(start),
      closesAt: iso(start + VOTING_MS),
    };
    challenges.push(ch);
    const crowd = fictional.filter((x) => x.id !== a.id && x.id !== b.id);
    for (let i = 0; i < voters && i < crowd.length; i++) {
      const voter =
        crowd[(i * 7 + Math.floor(rnd() * crowd.length)) % crowd.length];
      if (votes.some((v) => v.challengeId === ch.id && v.voterId === voter.id))
        continue;
      const voteAt =
        start + rnd() * Math.min(VOTING_MS, Math.max(H, t0 - start - 60_000));
      if (voteAt >= t0) continue;
      votes.push({
        challengeId: ch.id,
        voterId: voter.id,
        side: rnd() < lean ? "challenger" : "defender",
        at: iso(voteAt),
      });
    }
    chirpOn(
      "challenge",
      ch.id,
      start,
      [a, b, ...crowd.slice(0, 6)].filter((r) => r.ageGroup === a.ageGroup),
    );
    return ch;
  };

  // Ten days of history, a few duels a day per feature, then today's open ones.
  for (const f of DEMO_FEATURES) {
    const locals = fictional.filter((r) => r.homeMountain === f.mountainId);
    for (let day = 10; day >= 1; day--) {
      if (rnd() < 0.35) continue;
      const a = pick(locals);
      const b = pick(
        peers(a).length ? peers(a) : locals.filter((x) => x.id !== a.id),
      );
      duel(
        f,
        a,
        b,
        t0 - day * D - Math.floor(rnd() * 6) * H - 2 * H,
        0.3 + rnd() * 0.4,
        6 + Math.floor(rnd() * 12),
      );
    }
    // Earlier today: closed already, so Today's Champion exists.
    {
      const a = pick(locals);
      const b = pick(
        peers(a).length ? peers(a) : locals.filter((x) => x.id !== a.id),
      );
      duel(f, a, b, t0 - VOTING_MS - 40 * 60_000, 0.65, 9);
    }
    // Open now.
    {
      const a = pick(locals);
      const b = pick(
        peers(a).length ? peers(a) : locals.filter((x) => x.id !== a.id),
      );
      duel(
        f,
        a,
        b,
        t0 - Math.floor(4 + rnd() * 14) * H,
        0.5,
        4 + Math.floor(rnd() * 6),
      );
    }
    // A couple of fresh, unchallenged clips to answer.
    for (let i = 0; i < 2; i++) {
      const r = pick(
        locals
          .filter(
            (x) => x.ageGroup === "adult" && x.division === "intermediate",
          )
          .concat(locals)
          .slice(0, 6),
      );
      const c = makeClip(
        f,
        r,
        t0 - Math.floor(rnd() * 5 * 60) * 60_000,
        pick(CATEGORIES.slice(0, 6)),
      );
      chirpOn(
        "clip",
        c.id,
        Date.parse(c.at),
        fictional.filter((x) => x.ageGroup === r.ageGroup).slice(0, 8),
      );
    }
    chirpOn(
      "feature",
      f.id,
      t0 - 2 * D,
      locals.filter((x) => x.ageGroup === "adult"),
    );
  }

  // The scripted moment: an intermediate snowboarder's rail clip at
  // SilverStar, waiting for someone (you) to answer it.
  const juniper = riders[1]; // intermediate adult snowboarder
  const bait: Clip = {
    id: "dc-bait",
    featureId: "d-ss-starlight",
    riderId: juniper.id,
    sport: "snowboard",
    division: "intermediate",
    category: "best-style",
    caption: "50-50 to fakie. Nobody's touching this today 😤",
    at: iso(t0 - 50 * 60_000),
    media: { kind: "illustration", seed: 4242 },
    status: "published",
  };
  clips.push(bait);
  chirps.push({
    id: "dk-bait",
    thread: { kind: "clip", id: bait.id },
    authorId: riders[5].id,
    body: "Big talk, Juniper. Somebody answer this 😂",
    at: iso(t0 - 30 * 60_000),
    status: "published",
  });

  // A tight one closing soon, where one vote decides it.
  const close = duel(
    DEMO_FEATURES[0],
    riders[7],
    riders[10],
    t0 - VOTING_MS + 90 * 60_000,
    0.5,
    0,
  );
  for (let i = 0; i < 14; i++)
    votes.push({
      challengeId: close.id,
      voterId: fictional[(i + 12) % fictional.length].id,
      side: i % 2 ? "challenger" : "defender",
      at: iso(t0 - (i + 2) * 5 * 60_000),
    });

  const legends = DEMO_FEATURES.slice(0, 6).map((f, i) => ({
    featureId: f.id,
    season: "2025/26",
    riderId: fictional[(i * 5 + 2) % fictional.length].id,
  }));

  return {
    features: DEMO_FEATURES,
    riders,
    clips,
    challenges,
    votes: votes.filter((v) => {
      const ch = challenges.find((c) => c.id === v.challengeId)!;
      const rs = [
        clips.find((c) => c.id === ch.defenderClipId)!.riderId,
        clips.find((c) => c.id === ch.challengerClipId)!.riderId,
      ];
      return !rs.includes(v.voterId);
    }),
    chirps,
    reactions: dedupeReactions(reactions),
    blocks: [],
    legends,
  };
}

function dedupeReactions(rs: Reaction[]): Reaction[] {
  const seen = new Set<string>();
  return rs.filter((r) => {
    const k = `${r.clipId}|${r.riderId}|${r.kind}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * The crowd votes while you skip ahead: every challenge still open gets a
 * few fictional votes before it closes. The visitor's own challenges lean
 * their way a little — it's a demo, and they should see a crown.
 */
export function crowdVotes(w: World, from: number, to: number): Vote[] {
  const out: Vote[] = [];
  const fictional = w.riders.filter((r) => r.id !== DEMO_YOU);
  for (const ch of w.challenges) {
    const closes = Date.parse(ch.closesAt);
    if (closes <= from) continue;
    const s = challengeState(w, ch, from);
    const def = w.clips.find((c) => c.id === ch.defenderClipId);
    const ans = w.clips.find((c) => c.id === ch.challengerClipId);
    if (!def || !ans) continue;
    const yours = ans.riderId === DEMO_YOU || def.riderId === DEMO_YOU;
    if (!yours && s.tally.defender + s.tally.challenger > 12) continue;
    const rnd = prng(hash(ch.id));
    const lean =
      ans.riderId === DEMO_YOU ? 0.75 : def.riderId === DEMO_YOU ? 0.25 : 0.5;
    const count = yours ? 16 : 3;
    const until = Math.min(closes - 60_000, to);
    for (const voter of fictional) {
      if (out.filter((v) => v.challengeId === ch.id).length >= count) break;
      if (voter.id === def.riderId || voter.id === ans.riderId) continue;
      if (
        w.votes.some((v) => v.challengeId === ch.id && v.voterId === voter.id)
      )
        continue;
      if (!yours && rnd() < 0.5) continue;
      out.push({
        challengeId: ch.id,
        voterId: voter.id,
        side: rnd() < lean ? "challenger" : "defender",
        at: new Date(from + rnd() * Math.max(1, until - from)).toISOString(),
      });
    }
  }
  return out;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++)
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
