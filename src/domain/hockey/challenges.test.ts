import { describe, expect, it } from "vitest";
import { liveExperience } from "@/experience-lab/core/engine";
import type { Participant, Prompt } from "@/experience-lab/core/types";
import {
  CHALLENGE_CAP,
  POINTS,
  chaosFor,
  cupLines,
  gameOf,
  issueProblem,
  naturalSide,
  outcomeOf,
  rivalryFor,
  settle,
  type ChallengeRow,
  type PlayRows,
  type VoteRow,
} from "./challenges";
import { cupStatus, dramaOf, spectacularlyWrong } from "./cup";
import {
  SYCLE_HOCKEY_NIGHT,
  composeNight,
  honestScoring,
  settledPlay,
  templateRules,
  type MemberRow,
  type NightRows,
  type PromptRow,
} from "./night";

const LORNE = "11111111-1111-4111-8111-111111111111";
const ALEX = "22222222-2222-4222-8222-222222222222";
const SAM = "33333333-3333-4333-8333-333333333333";
const START = SYCLE_HOCKEY_NIGHT.startsAt; // 2026-10-26T02:00Z
const at = (minutes: number) => new Date(Date.parse(START) + minutes * 60_000);
const BEFORE = at(-48 * 60);

const people: Participant[] = [
  { id: LORNE, name: "Lorne", emoji: "🧭", hue: 1, present: true },
  { id: ALEX, name: "Alex", emoji: "🧭", hue: 2, present: true },
  { id: SAM, name: "Sam", emoji: "🧭", hue: 3, present: true },
];
const game = gameOf("Canucks", "Wild");
const fans = { [LORNE]: "CGY", [ALEX]: "VAN", [SAM]: "MIN" };

let n = 0;
const challenge = (over: Partial<ChallengeRow>): ChallengeRow => ({
  id: `c0000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
  kind: "bet",
  challenger_id: LORNE,
  target_id: ALEX,
  market: "winner",
  side: "away",
  taunt: null,
  status: "accepted",
  entry: null,
  entry_at: null,
  answered_at: at(-47 * 60).toISOString(),
  created_at: at(-47.5 * 60).toISOString(),
  ...over,
});
const vote = (
  c: ChallengeRow,
  voter: string,
  verdict: boolean,
  m = -40 * 60,
): VoteRow => ({
  challenge_id: c.id,
  voter_id: voter,
  verdict,
  at: at(m).toISOString(),
});

const member = (
  user_id: string,
  role: "host" | "guest",
  name: string,
  team: string,
): MemberRow => ({
  user_id,
  role,
  display_name: name,
  emoji: "🧭",
  hue: 100,
  vibe: null,
  edge: null,
  joined_at: "2026-10-12T00:00:00Z",
  nhl_team: team,
  watching: "arena",
});

function rows(
  over: Partial<NightRows> = {},
  resolutions: Record<string, unknown> = {},
): NightRows {
  return {
    occasion: {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      template: SYCLE_HOCKEY_NIGHT.template,
      title: SYCLE_HOCKEY_NIGHT.title,
      starts_at: START,
      host_id: LORNE,
      details: SYCLE_HOCKEY_NIGHT.details,
      brief: null,
    },
    members: [
      member(LORNE, "host", "Lorne", "CGY"),
      member(ALEX, "guest", "Alex", "VAN"),
      member(SAM, "guest", "Sam", "MIN"),
    ],
    prompts: templateRules().map((r): PromptRow => ({
      prompt_id: r.id,
      reveal: r.reveal,
      lock_offset_minutes: r.lockOffsetMinutes,
      audience_only: null,
      open_to_suggestions: r.openToSuggestions,
      asked_by: null,
      content: null,
      resolution: (resolutions[r.id] ?? null) as PromptRow["resolution"],
    })),
    options: [],
    responses: [],
    moments: [],
    reactions: [],
    cues: [],
    consents: [],
    ...over,
  };
}
const play = (over: Partial<PlayRows> = {}): PlayRows => ({
  challenges: [],
  votes: [],
  teamReactions: [],
  ledger: [],
  ...over,
});

describe("allegiance: which side of tonight a fan is on", () => {
  it("home, away, a rival of the home team, and nobody's", () => {
    expect(naturalSide("VAN", game)).toBe("home");
    expect(naturalSide("MIN", game)).toBe("away");
    // Flames–Canucks is a rivalry in fans.ts: a Flames fan roots against Vancouver.
    expect(naturalSide("CGY", game)).toBe("away");
    expect(naturalSide("FLA", game)).toBeNull();
    expect(naturalSide(null, game)).toBeNull();
  });
});

describe("the rivalry banner is built from real allegiances, not names", () => {
  const ctx = { venue: "Rogers Arena", untilStart: "2 days" };
  it("a Flames fan at a Canucks game is enemy territory — for everybody else", () => {
    const r = rivalryFor(ALEX, people, fans, game, ctx);
    expect(r.kind).toBe("enemy");
    expect(r.title).toBe("A Flames fan has entered Rogers Arena.");
    expect(r.lines.join(" ")).toContain(
      "Lorne has willingly agreed to attend a Canucks game",
    );
    expect(r.lines.join(" ")).toContain(
      "The group has 2 days to make them question that decision.",
    );
    expect(r.feud).toMatch(/Game 7s/);
  });
  it("and from the Flames fan's own side", () => {
    const r = rivalryFor(LORNE, people, fans, game, ctx);
    expect(r.title).toBe("You're a Flames fan at a Canucks game.");
    expect(r.lines[0]).toBe("2 people have 2 days to make you regret it.");
  });
  it("whoever it is: a Leafs fan gets the same treatment", () => {
    const r = rivalryFor(
      ALEX,
      people,
      { [SAM]: "TOR", [ALEX]: "VAN" },
      game,
      ctx,
    );
    expect(r.title).toBe("A Maple Leafs fan has entered Rogers Arena.");
    expect(r.about).toBe(SAM);
  });
  it("a split room is a house divided; an agreeing one is told so", () => {
    expect(
      rivalryFor(ALEX, people, { [ALEX]: "VAN", [SAM]: "MIN" }, game, ctx).kind,
    ).toBe("divided");
    const united = rivalryFor(
      ALEX,
      people,
      { [ALEX]: "VAN", [SAM]: "VAN", [LORNE]: "VAN" },
      game,
      ctx,
    );
    expect(united.kind).toBe("united");
    expect(united.title).toBe("Everybody here is a Canucks fan.");
    expect(rivalryFor(ALEX, people, {}, game, ctx).kind).toBe("undeclared");
  });
});

describe("tonight's chaos: three things to start, for this person", () => {
  const ctx = { beforeStart: true, beforeHorn: true, day: "2026-10-23" };
  it("Alex is offered Lorne's defence, a bet and a prophecy", () => {
    const cards = chaosFor(ALEX, people, fans, game, [], ctx);
    expect(cards).toHaveLength(3);
    expect(cards[0]).toMatchObject({ kind: "defend", targetId: LORNE });
    expect(cards[0].pitch).toContain("Lorne is a Flames fan at a Canucks game");
    const bet = cards.find((c) => c.kind === "bet")!;
    expect(bet.side).toBe("home"); // Alex is a Canucks fan
    expect([LORNE, SAM]).toContain(bet.targetId); // both are on the other side
  });
  it("Lorne is offered to defend himself first", () => {
    const cards = chaosFor(LORNE, people, fans, game, [], ctx);
    expect(cards.some((c) => c.key === "defend:self")).toBe(true);
  });
  it("never offers one already thrown, and nothing after the horn", () => {
    const sent = challenge({
      kind: "defend",
      market: null,
      side: null,
      challenger_id: ALEX,
      target_id: LORNE,
    });
    const cards = chaosFor(ALEX, people, fans, game, [sent], ctx);
    expect(cards.some((c) => c.kind === "defend" && c.targetId === LORNE)).toBe(
      false,
    );
    expect(
      chaosFor(ALEX, people, fans, game, [], { ...ctx, beforeHorn: false }),
    ).toEqual([]);
  });
  it("bets and prophecies stop at puck drop; the mic doesn't", () => {
    const cards = chaosFor(ALEX, people, fans, game, [], {
      ...ctx,
      beforeStart: false,
    });
    expect(cards.every((c) => c.kind !== "bet" && c.kind !== "prophecy")).toBe(
      true,
    );
    expect(cards.some((c) => c.kind === "commentary")).toBe(true);
  });
});

describe("issuing a challenge: the rules, in words", () => {
  const ctx = {
    memberIds: [LORNE, ALEX, SAM],
    existing: [] as ChallengeRow[],
    startsAt: START,
    now: BEFORE,
    promptIds: ["final-score", "first-team", "overtime", "total-goals"],
  };
  it("a bet needs another member, a real side, and closes at puck drop", () => {
    expect(
      issueProblem(
        { kind: "bet", targetId: ALEX, market: "winner", side: "away" },
        LORNE,
        ctx,
      ),
    ).toBeNull();
    expect(
      issueProblem(
        { kind: "bet", targetId: LORNE, market: "winner", side: "away" },
        LORNE,
        ctx,
      ),
    ).toMatch(/cry for help/);
    expect(
      issueProblem(
        { kind: "bet", targetId: ALEX, market: "winner", side: "over" },
        LORNE,
        ctx,
      ),
    ).toMatch(/side/);
    expect(
      issueProblem(
        { kind: "bet", targetId: ALEX, market: "winner", side: "away" },
        LORNE,
        { ...ctx, now: at(1) },
      ),
    ).toMatch(/puck drop/);
    expect(
      issueProblem(
        { kind: "bet", targetId: "nobody", market: "winner", side: "away" },
        LORNE,
        ctx,
      ),
    ).toMatch(/actually on this night/);
  });
  it("once per pair per kind, and eight a night", () => {
    const existing = [challenge({})];
    expect(
      issueProblem(
        { kind: "bet", targetId: ALEX, market: "winner", side: "home" },
        LORNE,
        { ...ctx, existing },
      ),
    ).toMatch(/already/);
    expect(
      issueProblem(
        { kind: "bet", targetId: ALEX, market: "overtime", side: "yes" },
        LORNE,
        { ...ctx, existing },
      ),
    ).toBeNull();
    const eight = Array.from({ length: 8 }, () => challenge({}));
    expect(
      issueProblem({ kind: "hottake", targetId: SAM }, LORNE, {
        ...ctx,
        existing: eight,
      }),
    ).toMatch(/8 challenges/);
  });
  it("a prophecy is your own, in words, before puck drop; volunteering means going first", () => {
    expect(
      issueProblem(
        { kind: "prophecy", targetId: ALEX, entry: "x" },
        LORNE,
        ctx,
      ),
    ).toMatch(/your own/);
    expect(
      issueProblem({ kind: "prophecy", targetId: LORNE }, LORNE, ctx),
    ).toMatch(/Say what/);
    expect(
      issueProblem({ kind: "defend", targetId: LORNE }, LORNE, ctx),
    ).toMatch(/going first/);
    expect(
      issueProblem(
        { kind: "defend", targetId: LORNE, entry: "1989." },
        LORNE,
        ctx,
      ),
    ).toBeNull();
  });
});

describe("settling: the same answer for everybody, from the rows and the clock", () => {
  const ids = [LORNE, ALEX, SAM];
  const market = (resolution: unknown) => () => ({
    resolution: resolution as never,
    knownAt: at(165).toISOString(),
  });

  it("bets ride the host's call", () => {
    expect(outcomeOf("winner", [2, 4])).toBe("away");
    expect(outcomeOf("winner", [3, 3])).toBeNull();
    expect(outcomeOf("first-goal", "canucks")).toBe("home");
    expect(outcomeOf("goals", 6)).toBe("over");
    expect(outcomeOf("goals", 5)).toBe("under");
    const c = challenge({});
    const open = settle(c, {
      memberIds: ids,
      votes: [],
      startsAt: START,
      now: at(100),
      market: market(undefined),
    });
    expect(open.state).toBe("on");
    const won = settle(c, {
      memberIds: ids,
      votes: [],
      startsAt: START,
      now: at(170),
      market: market([2, 4]),
    });
    expect(won).toMatchObject({
      state: "won",
      winner: LORNE,
      points: POINTS.bet,
    });
    const lost = settle(c, {
      memberIds: ids,
      votes: [],
      startsAt: START,
      now: at(170),
      market: market([5, 1]),
    });
    expect(lost.winner).toBe(ALEX);
  });

  it("a jury of everybody but the performer; the performer's own vote never counts", () => {
    const c = challenge({
      kind: "defend",
      market: null,
      side: null,
      entry: "1989 and 2004.",
      entry_at: at(-46 * 60).toISOString(),
    });
    const self = settle(c, {
      memberIds: ids,
      votes: [vote(c, ALEX, true)],
      startsAt: START,
      now: BEFORE,
    });
    expect(self.jurors).toEqual([LORNE, SAM]);
    expect(self.votes).toHaveLength(0);
    expect(self.state).toBe("jury");
    const split = settle(c, {
      memberIds: ids,
      votes: [vote(c, LORNE, true), vote(c, SAM, false)],
      startsAt: START,
      now: BEFORE,
    });
    expect(split.state).toBe("lost"); // everyone voted, no majority
    const yes = settle(c, {
      memberIds: ids,
      votes: [vote(c, LORNE, true), vote(c, SAM, true)],
      startsAt: START,
      now: BEFORE,
    });
    expect(yes).toMatchObject({
      state: "won",
      winner: ALEX,
      points: POINTS.performance,
    });
  });

  it("a jury that doesn't finish closes at the final horn on the votes it has", () => {
    const c = challenge({
      kind: "hottake",
      market: null,
      side: null,
      entry: "Goalies are a scam.",
      entry_at: at(-46 * 60).toISOString(),
    });
    const one = [vote(c, SAM, true)];
    expect(
      settle(c, { memberIds: ids, votes: one, startsAt: START, now: at(100) })
        .state,
    ).toBe("jury");
    expect(
      settle(c, { memberIds: ids, votes: one, startsAt: START, now: at(166) })
        .winner,
    ).toBe(ALEX);
    expect(
      settle(c, { memberIds: ids, votes: [], startsAt: START, now: at(166) })
        .state,
    ).toBe("void");
  });

  it("a prophecy is judged only once there's a game; a missed performance is void", () => {
    const p = challenge({
      kind: "prophecy",
      challenger_id: SAM,
      target_id: SAM,
      market: null,
      side: null,
      entry: "Someone scores off their own skate.",
      entry_at: BEFORE.toISOString(),
    });
    expect(
      settle(p, { memberIds: ids, votes: [], startsAt: START, now: BEFORE })
        .voting,
    ).toBe(false);
    expect(
      settle(p, { memberIds: ids, votes: [], startsAt: START, now: at(5) })
        .voting,
    ).toBe(true);
    const silent = challenge({ kind: "commentary", market: null, side: null });
    expect(
      settle(silent, {
        memberIds: ids,
        votes: [],
        startsAt: START,
        now: at(10),
      }).state,
    ).toBe("awaiting-entry");
    expect(
      settle(silent, {
        memberIds: ids,
        votes: [],
        startsAt: START,
        now: at(170),
      }).state,
    ).toBe("void");
  });

  it("an open, declined or withdrawn challenge is worth nothing", () => {
    for (const status of ["open", "declined", "withdrawn"] as const)
      expect(
        settle(challenge({ status }), {
          memberIds: ids,
          votes: [],
          startsAt: START,
          now: at(170),
          market: market([1, 4]),
        }).points,
      ).toBe(0);
  });
});

describe("the Cup: challenge points are capped, deterministic and identical for every viewer", () => {
  it("caps challenge winnings at CHALLENGE_CAP, in the order challenges were made", () => {
    const bets = (
      ["winner", "first-goal", "overtime", "goals"] as const
    ).flatMap((m, i) => [
      challenge({
        market: m,
        side: m === "overtime" ? "yes" : m === "goals" ? "over" : "away",
        created_at: at(-3000 + i).toISOString(),
      }),
      challenge({
        target_id: SAM,
        market: m,
        side: m === "overtime" ? "yes" : m === "goals" ? "over" : "away",
        created_at: at(-2000 + i).toISOString(),
      }),
    ]);
    const { prompts, responses } = cupLines(play({ challenges: bets }), {
      people,
      startsAt: START,
      now: at(170),
      game,
      market: (m) => ({
        resolution: (m === "winner"
          ? [1, 3]
          : m === "first-goal"
            ? "opponent"
            : m === "overtime"
              ? true
              : 7) as never,
      }),
    });
    const mine = responses.filter((r) => r.participantId === LORNE);
    const total = prompts
      .filter((p) => mine.some((r) => r.promptId === p.id))
      .reduce((s, p) => s + p.scoring!.points, 0);
    expect(total).toBe(CHALLENGE_CAP);
  });

  it("compose: everybody's standings are the same standings — missions included", () => {
    const bet = challenge({});
    const defence = challenge({
      kind: "defend",
      challenger_id: ALEX,
      target_id: LORNE,
      market: null,
      side: null,
      entry: "1989.",
      entry_at: at(-40 * 60).toISOString(),
    });
    const night = rows(
      {
        play: play({
          challenges: [bet, defence],
          votes: [vote(defence, ALEX, true), vote(defence, SAM, true)],
          // Sam's mission, from Alex: only Sam and Alex can read the mission itself.
          ledger: [
            {
              prompt_id: "toy-mission-x",
              earner: SAM,
              family: "mission",
              asked_by: ALEX,
              points: 20,
              done_at: at(-30 * 60).toISOString(),
            },
          ],
        }),
      },
      { "final-score": [1, 3] },
    );
    const now = at(170);
    const tables = [LORNE, ALEX, SAM].map((viewer) => {
      const { definition, state } = composeNight(night, viewer, now);
      return liveExperience(definition, state, now).standings.map((s) => [
        s.participant.name,
        s.points,
      ]);
    });
    expect(tables[0]).toEqual(tables[1]);
    expect(tables[1]).toEqual(tables[2]);
    // Lorne: bet (+3) and a defence the jury upheld (+3). Sam: a mission, capped at 8.
    expect(Object.fromEntries(tables[0])).toEqual({
      Lorne: 6,
      Sam: 8,
      Alex: 0,
    });
  });

  it("the verdict waits for every call and every jury", () => {
    const pending = challenge({
      kind: "hottake",
      challenger_id: ALEX,
      target_id: SAM,
      market: null,
      side: null,
      entry: "Overtime should be a shootout from the start.",
      entry_at: at(-40 * 60).toISOString(),
    });
    const night = rows(
      { play: play({ challenges: [pending, challenge({})] }) },
      { "final-score": [1, 3] },
    );
    const { definition, state } = composeNight(night, ALEX, at(170));
    const live = liveExperience(definition, state, at(170));
    const status = cupStatus(live, settledPlay(night, at(170)));
    expect(status.scoring).toBe(true);
    // At 170 minutes the hot take's jury has closed with no votes (void): nothing waits on it.
    expect(status.verified).toBe(true);
    const early = settledPlay(night, at(120));
    const liveEarly = liveExperience(
      composeNight(night, ALEX, at(120)).definition,
      composeNight(night, ALEX, at(120)).state,
      at(120),
    );
    expect(cupStatus(liveEarly, early).verified).toBe(false);
  });
});

describe("honest scoring: nobody sets what their own question is worth", () => {
  const asked = (id: string, over: Partial<Prompt>): Prompt => ({
    id,
    question: "Will somebody cry?",
    kind: "boolean",
    phaseId: "before",
    reveal: "immediate",
    askedBy: ALEX,
    family: "prediction",
    scoring: { points: 999, label: "Called it" },
    ...over,
  });
  const rule = (id: string, created: string): PromptRow => ({
    prompt_id: id,
    reveal: "immediate",
    lock_offset_minutes: null,
    audience_only: null,
    open_to_suggestions: false,
    asked_by: ALEX,
    content: null,
    resolution: null,
    created_at: created,
  });
  it("clamps to the family's points, drops side quests, and counts three per asker", () => {
    const ps = ["a", "b", "c", "d"].map((id) => asked(`toy-${id}`, {}));
    const out = honestScoring(
      [
        ...ps,
        asked("toy-sq", { family: "sidequest" }),
        asked("toy-x", { family: undefined }),
      ],
      ["a", "b", "c", "d"].map((id, i) =>
        rule(`toy-${id}`, `2026-10-23T0${i}:00:00Z`),
      ),
      true,
    );
    expect(out.slice(0, 3).map((p) => p.scoring?.points)).toEqual([5, 5, 5]);
    expect(out[3].scoring).toBeUndefined();
    expect(out[4].scoring).toBeUndefined();
    expect(out[5].scoring).toBeUndefined();
  });
  it("with the ledger, a mission scores only through it", () => {
    const [m] = honestScoring(
      [asked("toy-m", { family: "mission", audience: { only: SAM } })],
      [],
      true,
    );
    expect(m.scoring).toBeUndefined();
    const [old] = honestScoring(
      [asked("toy-m", { family: "mission", audience: { only: SAM } })],
      [],
      false,
    );
    expect(old.scoring?.points).toBe(8);
  });
  it("the asker's own answer to their own scored question never counts", () => {
    const content = {
      ...asked("toy-q", {}),
      id: undefined,
      askedBy: undefined,
    } as unknown as Prompt;
    const night = rows({
      prompts: [
        ...rows().prompts,
        { ...rule("toy-q", "2026-10-23T00:00:00Z"), content, resolution: true },
      ],
      responses: [
        {
          prompt_id: "toy-q",
          user_id: ALEX,
          value: true,
          answered_at: BEFORE.toISOString(),
        },
        {
          prompt_id: "toy-q",
          user_id: SAM,
          value: true,
          answered_at: BEFORE.toISOString(),
        },
      ],
    });
    const { definition, state } = composeNight(night, ALEX, BEFORE);
    const live = liveExperience(definition, state, BEFORE);
    const points = Object.fromEntries(
      live.standings.map((s) => [s.participant.name, s.points]),
    );
    expect(points).toEqual({ Sam: 5, Lorne: 0, Alex: 0 });
  });
});

describe("drama and the receipts", () => {
  it("tells what happened, never a decline", () => {
    const declined = challenge({ status: "declined", target_id: SAM });
    const taken = challenge({});
    const night = rows({
      play: play({
        challenges: [declined, taken],
        teamReactions: [
          { from_id: SAM, to_id: LORNE, emoji: "🤡", at: BEFORE.toISOString() },
        ],
      }),
    });
    const items = dramaOf({
      people,
      fans,
      game,
      settled: settledPlay(night, BEFORE),
      reactions: night.play!.teamReactions,
      ledger: [],
      viewerId: ALEX,
    });
    const text = items.map((i) => i.text).join("\n");
    expect(text).toContain("Lorne bet you that the Wild win.");
    expect(text).toContain("You accepted Lorne's challenge. It's on.");
    expect(text).toContain("Sam reacted to Lorne's Flames allegiance 🤡");
    expect(text).not.toContain("Sam that"); // the declined one
  });
  it("the spectacularly wrong pick is the furthest from the called score", () => {
    const night = rows(
      {
        responses: [
          {
            prompt_id: "final-score",
            user_id: LORNE,
            value: [1, 7],
            answered_at: BEFORE.toISOString(),
          },
          {
            prompt_id: "final-score",
            user_id: ALEX,
            value: [3, 2],
            answered_at: BEFORE.toISOString(),
          },
        ],
      },
      { "final-score": [3, 2] },
    );
    const { definition, state } = composeNight(night, ALEX, at(170));
    const worst = spectacularlyWrong(
      liveExperience(definition, state, at(170)),
    );
    expect(worst).toMatchObject({ pick: "1–7", actual: "3–2" });
    expect(worst?.participant.name).toBe("Lorne");
  });
});
