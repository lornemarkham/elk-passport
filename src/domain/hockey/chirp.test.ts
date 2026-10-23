import { describe, expect, it } from "vitest";
import {
  CHIRPS,
  LIBRARY,
  LINE_STORYLINE,
  PROMPTS,
  STORYLINES,
  STORYLINE_BY_ID,
  WELCOMES,
} from "./chirp-library";
import {
  Limiter,
  MAX_TEAM_LINES,
  ORGANIC_COOLDOWN_MS,
  ORGANIC_PER_DAY,
  acceptableChirp,
  arrivalPlan,
  chooseLine,
  kindOfKey,
  lastCallPlan,
  libraryChirps,
  organicAllowed,
  organicPlan,
  promptPlan,
  promptSlot,
  readChatter,
  renderBotRow,
  welcomePlan,
  type BotRow,
  type Fan,
} from "./chirp";
import { NHL_TEAMS } from "./fans";

const LORNE = "11111111-1111-1111-1111-111111111111";
const SAM = "22222222-2222-2222-2222-222222222222";
const TODAY = "2026-10-23";
const fans = new Map<string, Fan>([
  [LORNE, { id: LORNE, name: "Lorne", team: "CGY" }],
  [SAM, { id: SAM, name: "Sam", team: "VAN" }],
]);
const never = () => false;

let n = 0;
const row = (over: Partial<BotRow>): BotRow => ({
  id: `00000000-0000-0000-0000-${String(++n).padStart(12, "0")}`,
  actor_id: LORNE,
  text: null,
  at: "2026-10-23T18:00:00Z",
  bot_key: null,
  bot_line: null,
  bot_sig: null,
  ...over,
});

describe("Chirp Bot's library", () => {
  it("has team-specific welcomes and chirps for all 32 teams", () => {
    for (const team of NHL_TEAMS) {
      expect(WELCOMES[team.abbr]?.length, team.abbr).toBeGreaterThanOrEqual(2);
      expect(CHIRPS[team.abbr]?.length, team.abbr).toBeGreaterThanOrEqual(3);
    }
  });

  it("has unique ids, and every line passes its own safety net", () => {
    const ids = [...LIBRARY.keys()];
    expect(new Set(ids).size).toBe(ids.length);
    for (const line of LIBRARY.values()) {
      // Filled with harmless stand-ins, every line is something Chirp Bot may say.
      const text = line.text
        .replaceAll("{name}", "Lorne")
        .replaceAll("{target}", "Sam")
        .replaceAll("{team}", "Flames")
        .replaceAll("{full}", "Calgary Flames")
        .replaceAll("{rival}", "the Battle of Alberta")
        .replaceAll("{a}", "Flames")
        .replaceAll("{b}", "Oilers");
      expect(acceptableChirp(text), `${line.id}: ${text}`).toBe(true);
    }
  });

  it("states recent facts only through dated, sourced storylines", () => {
    for (const s of STORYLINES) {
      expect(s.url).toMatch(/^https:\/\//);
      expect(s.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(s.until > s.verifiedOn).toBe(true);
    }
    for (const p of PROMPTS)
      if (p.storyline)
        expect(STORYLINE_BY_ID.has(p.storyline), p.id).toBe(true);
    for (const [line, story] of Object.entries(LINE_STORYLINE)) {
      expect(LIBRARY.has(line), line).toBe(true);
      expect(STORYLINE_BY_ID.has(story), story).toBe(true);
    }
  });

  it("stops using a time-bound line once its storyline is stale", () => {
    const later = "2027-08-01";
    const fresh = chooseLine([CHIRPS.VAN], [], 1, TODAY);
    expect(fresh).not.toBeNull();
    for (let seed = 0; seed < 40; seed += 1)
      expect(chooseLine([CHIRPS.VAN], [], seed, later)?.id).not.toBe("c.VAN.1");
  });
});

describe("rendering a stored line", () => {
  it("renders a library welcome with the person's name, on every read", () => {
    const line = renderBotRow(
      row({ bot_key: `team:${LORNE}:CGY`, bot_line: "w.CGY.2" }),
      { fans, verify: never },
    );
    expect(line?.text).toBe(
      "Welcome, Lorne. Are we discussing the Flames' rebuild, or is that still a sensitive subject?",
    );
    expect(line).toMatchObject({
      kind: "welcome",
      tone: "satire",
      about: LORNE,
    });
  });

  it("shows a question's verified fact apart from the joke, with its source", () => {
    const line = renderBotRow(
      row({ bot_key: "prompt:2026-10-26T02:00:1", bot_line: "p.hughes" }),
      { fans, verify: never },
    );
    expect(line?.tone).toBe("opinion");
    expect(line?.fact?.text).toMatch(/12 December 2025/);
    expect(line?.fact?.url).toMatch(/^https:/);
  });

  it("refuses rows that are not provably Chirp Bot's", () => {
    const refuse = (over: Partial<BotRow>) =>
      renderBotRow(row(over), { fans, verify: never });
    // A key about somebody else than whoever wrote it.
    expect(
      refuse({ bot_key: `team:${SAM}:CGY`, bot_line: "w.CGY.1" }),
    ).toBeNull();
    // A line of the wrong kind for its key.
    expect(
      refuse({ bot_key: `team:${LORNE}:CGY`, bot_line: "p.beer" }),
    ).toBeNull();
    // No such line.
    expect(
      refuse({ bot_key: `team:${LORNE}:CGY`, bot_line: "w.CGY.99" }),
    ).toBeNull();
    // A model's line with a missing or wrong signature: a member writing
    // "Chirp Bot says…" straight into the table.
    expect(
      refuse({
        bot_key: "bold:x",
        bot_line: "ai",
        text: "Sam is the worst",
        bot_sig: "nope",
      }),
    ).toBeNull();
    // Not a bot row at all.
    expect(refuse({})).toBeNull();
  });

  it("shows a model's line only when its signature verifies", () => {
    const ok = renderBotRow(
      row({
        bot_key: "bold:x",
        bot_line: "ai",
        text: "Bold call.",
        bot_sig: "sig",
      }),
      { fans, verify: (r) => r.bot_sig === "sig" },
    );
    expect(ok?.text).toBe("Bold call.");
  });

  it("knows its kinds", () => {
    expect(kindOfKey(`team:${LORNE}:CGY`)).toBe("welcome");
    expect(kindOfKey("rivalry:CGY-VAN:2026-10-23")).toBe("rivalry");
    expect(kindOfKey("whatever")).toBeNull();
  });
});

describe("welcomes — once per person per team, no repeats", () => {
  it("welcomes a declaration with that team's own material first", () => {
    const plan = welcomePlan({
      userId: LORNE,
      team: "CGY",
      previous: null,
      rows: [],
      seed: 3,
      today: TODAY,
    });
    expect(plan?.key).toBe(`team:${LORNE}:CGY`);
    expect(plan?.line).toMatch(/^w\.CGY\./);
  });

  it("does not welcome the same declaration twice", () => {
    const rows = [row({ bot_key: `team:${LORNE}:CGY`, bot_line: "w.CGY.1" })];
    expect(
      welcomePlan({
        userId: LORNE,
        team: "CGY",
        previous: null,
        rows,
        seed: 1,
        today: TODAY,
      }),
    ).toBeNull();
  });

  it("heckles a switch, and stops after three changes of heart", () => {
    const plan = welcomePlan({
      userId: LORNE,
      team: "TOR",
      previous: "CGY",
      rows: [],
      seed: 1,
      today: TODAY,
    });
    expect(plan?.line).toMatch(/^s\./);
    const rows = ["CGY", "TOR", "EDM"].map((t) =>
      row({ bot_key: `team:${LORNE}:${t}`, bot_line: "g.w.1" }),
    );
    expect(rows).toHaveLength(MAX_TEAM_LINES);
    expect(
      welcomePlan({
        userId: LORNE,
        team: "MTL",
        previous: "EDM",
        rows,
        seed: 1,
        today: TODAY,
      }),
    ).toBeNull();
  });

  it("does not repeat a joke the night has heard while another is unused", () => {
    const rows = [
      row({ actor_id: SAM, bot_key: `team:${SAM}:CGY`, bot_line: "w.CGY.1" }),
      row({ actor_id: SAM, bot_key: `team:${SAM}:EDM`, bot_line: "w.CGY.2" }),
    ];
    for (let seed = 0; seed < 20; seed += 1) {
      const plan = welcomePlan({
        userId: LORNE,
        team: "CGY",
        previous: null,
        rows,
        seed,
        today: TODAY,
      });
      expect(plan?.line).toBe("w.CGY.3");
    }
  });

  it("asks a new arrival once", () => {
    expect(
      arrivalPlan({ userId: SAM, rows: [], seed: 1, today: TODAY })?.key,
    ).toBe(`arrive:${SAM}`);
    expect(
      arrivalPlan({
        userId: SAM,
        rows: [
          row({ actor_id: SAM, bot_key: `arrive:${SAM}`, bot_line: "a.1" }),
        ],
        seed: 1,
        today: TODAY,
      }),
    ).toBeNull();
  });
});

describe("organic heckles — selective and rate limited", () => {
  const lorne = fans.get(LORNE)!;
  const sam = fans.get(SAM)!;

  it("lets ordinary talk go", () => {
    expect(readChatter("see you at 6", lorne, [lorne, sam])).toBeNull();
    expect(readChatter("that was wild", lorne, [lorne, sam])).toBeNull();
  });

  it("hears a bet, a rival fan, and a bold call — in that order", () => {
    expect(readChatter("loser buys the beer", lorne, [lorne, sam])).toEqual({
      kind: "challenge",
    });
    expect(readChatter("the Canucks are a mess", lorne, [lorne, sam])).toEqual({
      kind: "rivalry",
      pair: "CGY-VAN",
    });
    expect(readChatter("calling it 5-1 tonight", lorne, [lorne, sam])).toEqual({
      kind: "bold",
    });
  });

  it("does not call two fans of unrelated teams a rivalry", () => {
    const ana: Fan = { id: SAM, name: "Sam", team: "CBJ" };
    expect(readChatter("Columbus stinks", lorne, [lorne, ana])).toBeNull();
  });

  it("waits ten minutes between heckles", () => {
    const now = new Date("2026-10-23T18:00:00Z");
    const recent = [
      row({
        bot_key: "bold:a",
        bot_line: "o.bd.1",
        at: new Date(now.getTime() - ORGANIC_COOLDOWN_MS + 1000).toISOString(),
      }),
    ];
    expect(organicAllowed(recent, false, now)).toBe(false);
    const older = [
      row({
        bot_key: "bold:a",
        bot_line: "o.bd.1",
        at: new Date(now.getTime() - ORGANIC_COOLDOWN_MS - 1000).toISOString(),
      }),
    ];
    expect(organicAllowed(older, false, now)).toBe(true);
  });

  it("stops at eight a day, and never follows itself", () => {
    const now = new Date("2026-10-23T18:00:00Z");
    const day = Array.from({ length: ORGANIC_PER_DAY }, (_, i) =>
      row({
        bot_key: `bold:${i}`,
        bot_line: "o.bd.1",
        at: new Date(now.getTime() - (i + 1) * 60 * 60_000).toISOString(),
      }),
    );
    expect(organicAllowed(day, false, now)).toBe(false);
    expect(organicAllowed(day.slice(1), false, now)).toBe(true);
    expect(organicAllowed([], true, now)).toBe(false);
  });

  it("welcomes and questions do not use up the heckle allowance", () => {
    const now = new Date("2026-10-23T18:00:00Z");
    const rows = [
      row({
        bot_key: `team:${LORNE}:CGY`,
        bot_line: "w.CGY.1",
        at: now.toISOString(),
      }),
      row({ bot_key: "prompt:x:1", bot_line: "p.beer", at: now.toISOString() }),
    ];
    expect(organicAllowed(rows, false, now)).toBe(true);
  });

  it("says one thing per bet, and one thing per rival pair per day", () => {
    const now = new Date("2026-10-23T18:00:00Z");
    const plan = organicPlan({
      chatter: { kind: "rivalry", pair: "CGY-VAN" },
      momentId: "m1",
      rows: [],
      now,
      seed: 1,
    });
    expect(plan?.key).toBe("rivalry:CGY-VAN:2026-10-23");
    expect(
      organicPlan({
        chatter: { kind: "rivalry", pair: "CGY-VAN" },
        momentId: "m2",
        rows: [row({ bot_key: plan!.key, bot_line: plan!.line })],
        now,
        seed: 1,
      }),
    ).toBeNull();
    expect(
      organicPlan({
        chatter: { kind: "challenge" },
        momentId: "m3",
        rows: [],
        now,
        seed: 1,
      })?.key,
    ).toBe("challenge:m3");
  });
});

describe("pregame questions", () => {
  const startsAt = "2026-10-26T02:00:00.000Z";
  const at = (hoursBefore: number) =>
    new Date(Date.parse(startsAt) - hoursBefore * 3_600_000);
  const base = {
    startsAt,
    members: 3,
    rows: [] as BotRow[],
    lastHumanNoteAt: null,
    teams: ["CGY", "VAN", "MIN"],
    seed: 7,
  };

  it("runs from three days out to puck drop, six hours a slot", () => {
    expect(promptSlot(at(80), startsAt)).toBeNull();
    expect(promptSlot(at(71), startsAt)).toBe(11);
    expect(promptSlot(at(5), startsAt)).toBe(0);
    expect(promptSlot(at(-1), startsAt)).toBeNull();
  });

  it("asks about teams people here cheer for first", () => {
    const plan = promptPlan({ ...base, now: at(10) });
    expect(plan?.key).toBe("prompt:2026-10-26T02:00:1");
    const prompt = PROMPTS.find((p) => p.id === plan?.line);
    expect(prompt?.teams?.some((t) => base.teams.includes(t))).toBe(true);
  });

  it("does not ask a room of one, or after puck drop", () => {
    expect(promptPlan({ ...base, members: 1, now: at(10) })).toBeNull();
    expect(promptPlan({ ...base, now: at(-0.5) })).toBeNull();
  });

  it("does not ask an empty room a second question, nor twice in a slot", () => {
    const asked = row({
      bot_key: "prompt:2026-10-26T02:00:2",
      bot_line: "p.beer",
      at: at(13).toISOString(),
    });
    expect(promptPlan({ ...base, rows: [asked], now: at(10) })).toBeNull();
    const replied = promptPlan({
      ...base,
      rows: [asked],
      lastHumanNoteAt: at(12).toISOString(),
      now: at(10),
    });
    expect(replied).not.toBeNull();
    expect(replied?.line).not.toBe("p.beer");
    const same = row({
      bot_key: "prompt:2026-10-26T02:00:1",
      bot_line: "p.fights",
      at: at(11).toISOString(),
    });
    expect(
      promptPlan({
        ...base,
        rows: [same],
        lastHumanNoteAt: at(10.5).toISOString(),
        now: at(10),
      }),
    ).toBeNull();
  });

  it("never asks a question whose fact has gone stale", () => {
    const plan = promptPlan({
      ...base,
      startsAt: "2027-09-01T02:00:00.000Z",
      now: new Date("2027-08-31T20:00:00Z"),
    });
    const prompt = PROMPTS.find((p) => p.id === plan?.line);
    expect(prompt?.storyline).toBeUndefined();
  });

  it("makes one last call for picks, ninety minutes out", () => {
    expect(
      lastCallPlan({
        now: at(1),
        startsAt,
        members: 3,
        picksOn: true,
        rows: [],
        seed: 1,
      })?.key,
    ).toBe("lastcall:2026-10-26T02:00");
    expect(
      lastCallPlan({
        now: at(3),
        startsAt,
        members: 3,
        picksOn: true,
        rows: [],
        seed: 1,
      }),
    ).toBeNull();
    expect(
      lastCallPlan({
        now: at(1),
        startsAt,
        members: 3,
        picksOn: false,
        rows: [],
        seed: 1,
      }),
    ).toBeNull();
  });
});

describe("chirp someone — from the library", () => {
  const lorne = fans.get(LORNE)!;
  const sam = fans.get(SAM)!;

  it("writes three different chirps about the target's team, by name", () => {
    const chirps = libraryChirps({
      sender: lorne,
      target: sam,
      seed: 4,
      today: TODAY,
    });
    expect(chirps).toHaveLength(3);
    expect(new Set(chirps).size).toBe(3);
    for (const c of chirps) {
      expect(c).not.toMatch(/\{/);
      expect(acceptableChirp(c)).toBe(true);
    }
    expect(chirps.join(" ")).toMatch(/Sam/);
  });

  it("leads with the rivalry when there is one", () => {
    const [first] = libraryChirps({
      sender: lorne,
      target: sam,
      seed: 4,
      today: TODAY,
    });
    expect(first).toMatch(/1989 and 2004/);
  });

  it("has something for a target with no team", () => {
    const chirps = libraryChirps({
      sender: lorne,
      target: { id: SAM, name: "Sam", team: null },
      seed: 1,
      today: TODAY,
    });
    expect(chirps).toHaveLength(3);
    expect(chirps.join(" ")).toMatch(/Sam/);
  });
});

describe("the safety net", () => {
  it("drops chirps about the person instead of the team", () => {
    expect(acceptableChirp("Sam, your team is as bald as your head")).toBe(
      false,
    );
    expect(acceptableChirp("Sam's wife cheers for the Leafs")).toBe(false);
    expect(acceptableChirp("Go kill yourself, Leafs fan")).toBe(false);
    expect(acceptableChirp("see https://example.com")).toBe(false);
    expect(acceptableChirp("two\nlines")).toBe(false);
    expect(acceptableChirp("ok")).toBe(false);
  });

  it("lets ordinary hockey trash talk through", () => {
    expect(
      acceptableChirp(
        "Ovechkin broke Gretzky's record and you broke my heart, Leafs.",
      ),
    ).toBe(true);
    expect(
      acceptableChirp(
        "An illegal hit is still the Flames' best play this year.",
      ),
    ).toBe(true);
  });
});

describe("the cost limiter", () => {
  it("allows up to the limit in the window, then refuses, then recovers", () => {
    const limit = new Limiter(60_000, 2);
    expect(limit.take("lorne", 0)).toBe(true);
    expect(limit.take("lorne", 10)).toBe(true);
    expect(limit.take("lorne", 20)).toBe(false);
    expect(limit.take("sam", 20)).toBe(true);
    expect(limit.take("lorne", 60_011)).toBe(true);
  });
});
