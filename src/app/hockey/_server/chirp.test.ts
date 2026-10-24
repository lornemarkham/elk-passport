import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NightRows, MomentRow } from "@/domain/hockey/night";

const askModel =
  vi.fn<(request: string, who: string) => Promise<string | null>>();
let configured = false;
vi.mock("./chirp-ai", () => ({
  askModel: (request: string, who: string) => askModel(request, who),
  modelConfigured: () => configured,
  tell: () => {},
}));

const {
  chirpOnLook,
  chirpOnSay,
  chirpOnTeam,
  chirpRoomOf,
  chirpsAbout,
  signLine,
  verifier,
} = await import("./chirp");
const { chirpsRequest, lineRequest, readChirps, readLine } =
  await import("@/domain/hockey/chirp-voice");

const NIGHT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const LORNE = "11111111-1111-1111-1111-111111111111";
const SAM = "22222222-2222-2222-2222-222222222222";
const GONE = "33333333-3333-3333-3333-333333333333";

function night(
  over: {
    moments?: MomentRow[];
    details?: Record<string, unknown>;
    startsAt?: string;
  } = {},
): NightRows {
  return {
    occasion: {
      id: NIGHT,
      template: "sycle-hockey-night",
      title: "Sycle Hockey Night",
      starts_at: over.startsAt ?? "2026-10-26T02:00:00.000Z",
      host_id: LORNE,
      details: { opponent: "Wild", ...(over.details ?? {}) },
      brief: null,
    },
    members: [
      {
        user_id: LORNE,
        role: "host",
        display_name: "Lorne",
        emoji: "🦊",
        hue: 10,
        vibe: null,
        edge: null,
        joined_at: "2026-10-20T00:00:00Z",
        nhl_team: "CGY",
      },
      {
        user_id: SAM,
        role: "guest",
        display_name: "Sam",
        emoji: "🐻",
        hue: 200,
        vibe: null,
        edge: null,
        joined_at: "2026-10-21T00:00:00Z",
        nhl_team: "VAN",
      },
    ],
    prompts: [],
    options: [],
    responses: [],
    moments: over.moments ?? [],
    reactions: [],
    cues: [],
    consents: [],
  } as unknown as NightRows;
}

let id = 0;
const moment = (over: Partial<MomentRow>): MomentRow => ({
  id: `00000000-0000-0000-0000-${String(++id).padStart(12, "0")}`,
  actor_id: LORNE,
  kind: "chirp",
  text: null,
  emoji: null,
  at: "2026-10-23T18:00:00Z",
  bot_key: null,
  bot_line: null,
  bot_sig: null,
  ...over,
});

/** Just enough of the Supabase client to record inserts. */
function fakeDb(error: { code?: string; message: string } | null = null) {
  const inserted: Record<string, unknown>[] = [];
  return {
    inserted,
    db: {
      from: (table: string) => ({
        insert: async (row: Record<string, unknown>) => {
          expect(table).toBe("passport_occasion_moments");
          inserted.push(row);
          return { error };
        },
      }),
    } as never,
  };
}

beforeEach(() => {
  configured = false;
  askModel.mockReset();
  vi.stubEnv("CHIRP_BOT_SECRET", "test-secret");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllEnvs());

describe("signatures — a model's line is Chirp Bot's only if this server wrote it", () => {
  it("verifies its own signature and nothing else", () => {
    const sig = signLine(NIGHT, "bold:m1", "Bold.")!;
    const verify = verifier(NIGHT);
    const base = {
      id: "x",
      actor_id: LORNE,
      at: "",
      bot_key: "bold:m1",
      bot_line: "ai",
    };
    expect(verify({ ...base, text: "Bold.", bot_sig: sig })).toBe(true);
    expect(verify({ ...base, text: "Bold!", bot_sig: sig })).toBe(false);
    expect(
      verify({ ...base, bot_key: "bold:m2", text: "Bold.", bot_sig: sig }),
    ).toBe(false);
    expect(
      verifier("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")({
        ...base,
        text: "Bold.",
        bot_sig: sig,
      }),
    ).toBe(false);
    expect(
      verifier(
        NIGHT,
        "another-secret",
      )({ ...base, text: "Bold.", bot_sig: sig }),
    ).toBe(false);
  });

  it("falls back to the OpenAI key when no Chirp Bot secret is set, and signs nothing without either", () => {
    vi.stubEnv("CHIRP_BOT_SECRET", "");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    expect(signLine(NIGHT, "k", "t")).toBe(
      signLine(NIGHT, "k", "t", "sk-test"),
    );
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(signLine(NIGHT, "k", "t")).toBeNull();
  });
});

describe("the chat's Chirp Bot lines and everybody's team", () => {
  it("shows library lines and signed model lines; hides forgeries and lines from removed members", () => {
    const signed = signLine(NIGHT, "bold:m1", "That's a bold call, Sam.")!;
    const rows = night({
      moments: [
        moment({ bot_key: `team:${LORNE}:CGY`, bot_line: "w.CGY.1" }),
        moment({
          actor_id: SAM,
          bot_key: "bold:m1",
          bot_line: "ai",
          text: "That's a bold call, Sam.",
          bot_sig: signed,
        }),
        // Sam writing a "Chirp Bot" line straight into the table.
        moment({
          actor_id: SAM,
          bot_key: "bold:m2",
          bot_line: "ai",
          text: "Lorne is a loser",
          bot_sig: "forged",
        }),
        // A Chirp Bot welcome set off by somebody no longer on the night.
        moment({
          actor_id: GONE,
          bot_key: `team:${GONE}:TOR`,
          bot_line: "w.TOR.1",
        }),
        // An ordinary message is not Chirp Bot's.
        moment({ kind: "note", text: "hi" }),
      ],
    });
    const room = chirpRoomOf(rows, true);
    expect(room.fans).toEqual({ [LORNE]: "CGY", [SAM]: "VAN" });
    expect(room.lines.map((l) => l.text)).toEqual([
      "BREAKING: A Calgary Flames fan has entered the building. Security has been notified.",
      "That's a bold call, Sam.",
    ]);
  });

  it("shows no lines while the host has Chirp Bot out of the chat, but keeps teams", () => {
    const rows = night({
      details: { chirp: false },
      moments: [moment({ bot_key: `team:${LORNE}:CGY`, bot_line: "w.CGY.1" })],
    });
    const room = chirpRoomOf(rows, true);
    expect(room.on).toBe(false);
    expect(room.lines).toEqual([]);
    expect(room.fans[LORNE]).toBe("CGY");
  });

  it("is empty before the migration", () => {
    expect(chirpRoomOf(night(), false)).toMatchObject({
      available: false,
      lines: [],
      fans: {},
    });
  });
});

describe("posting — as the person who set it off, once", () => {
  it("welcomes a declaration from the library when no model is configured", async () => {
    const { db, inserted } = fakeDb();
    await chirpOnTeam(
      db,
      night(),
      SAM,
      "VAN",
      null,
      new Date("2026-10-23T18:00:00Z"),
    );
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      occasion_id: NIGHT,
      actor_id: SAM,
      kind: "chirp",
      text: null,
      bot_key: `team:${SAM}:VAN`,
      bot_sig: null,
    });
    expect(String(inserted[0].bot_line)).toMatch(/^(w\.VAN\.|g\.w\.)/);
    expect(askModel).not.toHaveBeenCalled();
  });

  it("uses the model's line when there is one, signed", async () => {
    configured = true;
    askModel.mockResolvedValue(
      JSON.stringify({
        line: "A Canucks fan. The optimism experiment continues.",
      }),
    );
    const { db, inserted } = fakeDb();
    await chirpOnTeam(db, night(), SAM, "VAN", null);
    expect(inserted[0]).toMatchObject({
      bot_line: "ai",
      text: "A Canucks fan. The optimism experiment continues.",
    });
    expect(inserted[0].bot_sig).toBe(
      signLine(
        NIGHT,
        `team:${SAM}:VAN`,
        "A Canucks fan. The optimism experiment continues.",
      ),
    );
  });

  it("falls back to the library when the model says something off limits", async () => {
    configured = true;
    askModel.mockResolvedValue(
      JSON.stringify({ line: "Sam's mom cheers for the Leafs" }),
    );
    const { db, inserted } = fakeDb();
    await chirpOnTeam(db, night(), SAM, "VAN", null);
    expect(inserted[0]).toMatchObject({ text: null });
    expect(inserted[0].bot_line).not.toBe("ai");
  });

  it("treats a duplicate key as someone else's phone getting there first", async () => {
    const { db } = fakeDb({ code: "23505", message: "duplicate key" });
    await expect(
      chirpOnTeam(db, night(), SAM, "VAN", null),
    ).resolves.toBeUndefined();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("heckles a rival fan, then holds its tongue for ten minutes", async () => {
    const now = new Date("2026-10-23T18:00:00Z");
    const { db, inserted } = fakeDb();
    await chirpOnSay(db, night(), LORNE, "the Canucks are a mess", "m1", now);
    expect(inserted[0]).toMatchObject({
      bot_key: "rivalry:CGY-VAN:2026-10-23",
      actor_id: LORNE,
    });

    const after = night({
      moments: [
        moment({
          bot_key: "rivalry:CGY-VAN:2026-10-23",
          bot_line: "o.rv.1",
          at: now.toISOString(),
        }),
      ],
    });
    const later = fakeDb();
    await chirpOnSay(
      later.db,
      after,
      SAM,
      "loser buys the beer",
      "m2",
      new Date(now.getTime() + 5 * 60_000),
    );
    expect(later.inserted).toHaveLength(0);
  });

  it("lets ordinary talk go, and stays out while switched off", async () => {
    const { db, inserted } = fakeDb();
    await chirpOnSay(db, night(), LORNE, "see you at 6", "m1");
    await chirpOnSay(
      db,
      night({ details: { chirp: false } }),
      LORNE,
      "loser buys",
      "m2",
    );
    expect(inserted).toHaveLength(0);
  });

  it("asks a pregame question when someone opens the chat, from the library only", async () => {
    configured = true;
    const { db, inserted } = fakeDb();
    await chirpOnLook(db, night(), SAM, new Date("2026-10-25T16:00:00Z"));
    expect(inserted).toHaveLength(1);
    expect(String(inserted[0].bot_key)).toMatch(/^prompt:2026-10-26T02:00:/);
    expect(String(inserted[0].bot_line)).toMatch(/^p\./);
    expect(askModel).not.toHaveBeenCalled();
  });
});

describe("chirp someone", () => {
  it("returns three library chirps without a model, and posts nothing", async () => {
    const result = await chirpsAbout(night(), LORNE, SAM);
    expect(result?.by).toBe("library");
    expect(result?.chirps).toHaveLength(3);
    expect(result?.chirps.join(" ")).toMatch(/Sam/);
  });

  it("keeps the model's acceptable chirps and fills the rest from the library", async () => {
    configured = true;
    askModel.mockResolvedValue(
      JSON.stringify({
        chirps: [
          "Sam, 32nd of 32 is a ranking, not a rebuild.",
          "Sam is fat",
          "Sam, 1970 called.",
        ],
      }),
    );
    const result = await chirpsAbout(night(), LORNE, SAM);
    expect(result?.by).toBe("model");
    expect(result?.chirps).toHaveLength(3);
    expect(result?.chirps).toContain(
      "Sam, 32nd of 32 is a ranking, not a rebuild.",
    );
    expect(result?.chirps.join(" ")).not.toMatch(/fat/);
  });

  it("uses the library when the model fails or is rate limited", async () => {
    configured = true;
    askModel.mockResolvedValue(null);
    expect((await chirpsAbout(night(), LORNE, SAM))?.by).toBe("library");
  });

  it("refuses yourself and strangers", async () => {
    expect(await chirpsAbout(night(), LORNE, LORNE)).toBeNull();
    expect(await chirpsAbout(night(), LORNE, GONE)).toBeNull();
    expect(await chirpsAbout(night(), GONE, SAM)).toBeNull();
  });
});

describe("what a model is told", () => {
  const lorne = { id: LORNE, name: "Lorne", team: "CGY" };
  const sam = { id: SAM, name: "Sam", team: "VAN" };

  it("separates favourite teams from tonight's game, and hands over only verified facts", () => {
    const req = chirpsRequest({
      sender: lorne,
      target: sam,
      game: { home: "Canucks", away: "Wild" },
      today: "2026-10-23",
    });
    expect(req).toMatch(/teams PLAYING, not anybody's favourite/);
    expect(req).toMatch(/Lorne, a Calgary Flames fan/);
    expect(req).toMatch(/Sam, a Vancouver Canucks fan/);
    expect(req).toMatch(/Quinn Hughes/);
    expect(req).toMatch(/1989 and 2004/);
    expect(req).not.toMatch(/@/);
  });

  it("stops handing over a fact once it is stale", () => {
    const req = chirpsRequest({
      sender: lorne,
      target: sam,
      game: { home: "Canucks", away: "Wild" },
      today: "2027-08-01",
    });
    expect(req).not.toMatch(/Quinn Hughes/);
  });

  it("asks for a line about the moment, not a verdict on a bet", () => {
    const req = lineRequest({
      occasion: { kind: "challenge", fan: sam, said: "loser buys" },
      game: { home: "Canucks", away: "Wild" },
      fans: [lorne, sam],
      today: "2026-10-23",
    });
    expect(req).toMatch(/Do not take a side/);
  });

  it("keeps only acceptable answers", () => {
    expect(
      readChirps('{"chirps":["Fine chirp here.","Fine chirp here.","x"]}'),
    ).toEqual(["Fine chirp here."]);
    expect(readChirps("not json")).toEqual([]);
    expect(readLine('{"line":"A good line, honestly."}')).toBe(
      "A good line, honestly.",
    );
    expect(readLine('{"line":"Go kill yourself"}')).toBeNull();
    expect(readLine('{"nope":1}')).toBeNull();
  });
});

describe("challenge lines from a model that make things up", () => {
  it("are refused: numbers and invented quotes", async () => {
    const { inventsFacts } = await import("./chirp");
    expect(inventsFacts("They barely beat the Jets 4-1 last week.")).toBe(true);
    expect(inventsFacts("Lorne: 'You think the Wild are gonna lose?'")).toBe(
      true,
    );
    expect(
      inventsFacts("Alex said “the Canucks are a lock” and meant it."),
    ).toBe(true);
    expect(
      inventsFacts(
        "Lorne, you're betting against the team that traded Quinn Hughes? Real confidence there.",
      ),
    ).toBe(false);
  });
});
