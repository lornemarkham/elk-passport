import { describe, expect, it } from "vitest";
import { ActionSchema } from "./actions";
import { editionOf, seriesOf } from "./edition";
import {
  SYCLE_HOCKEY_NIGHT,
  composeNight,
  templateRules,
  type MemberRow,
  type NightRows,
  type ResponseRow,
} from "./night";
import { cupResult, lastTime, sycleCup, type SeriesNight } from "./series";

const LORNE = "11111111-1111-4111-8111-111111111111";
const MAYA = "22222222-2222-4222-8222-222222222222";
const SAM = "33333333-3333-4333-8333-333333333333";

const member = (
  user_id: string,
  role: "host" | "guest",
  name: string,
): MemberRow => ({
  user_id,
  role,
  display_name: name,
  emoji: "🧭",
  hue: 100,
  vibe: null,
  edge: null,
  joined_at: "2026-10-12T00:00:00Z",
});

const answer = (
  prompt_id: string,
  user_id: string,
  value: ResponseRow["value"],
): ResponseRow => ({
  prompt_id,
  user_id,
  value,
  answered_at: "2026-10-20T00:00:00Z",
});

function night(
  id: string,
  startsAt: string,
  opts: {
    edition?: number;
    series?: string;
    members?: MemberRow[];
    responses?: ResponseRow[];
    results?: Record<string, ResponseRow["value"]>;
  } = {},
): SeriesNight {
  const rows: NightRows = {
    occasion: {
      id,
      template: SYCLE_HOCKEY_NIGHT.template,
      title: SYCLE_HOCKEY_NIGHT.title,
      starts_at: startsAt,
      host_id: LORNE,
      details: {
        ...SYCLE_HOCKEY_NIGHT.details,
        series: opts.series,
        edition: opts.edition,
      },
      brief: null,
    },
    members: opts.members ?? [
      member(LORNE, "host", "Lorne"),
      member(MAYA, "guest", "Maya"),
    ],
    prompts: templateRules().map((r) => ({
      prompt_id: r.id,
      reveal: r.reveal,
      lock_offset_minutes: r.lockOffsetMinutes,
      audience_only: null,
      open_to_suggestions: r.openToSuggestions,
      asked_by: null,
      content: null,
      resolution: opts.results?.[r.id] ?? null,
    })),
    options: [],
    responses: opts.responses ?? [],
    moments: [],
    reactions: [],
    cues: [],
    consents: [],
  };
  return {
    id,
    edition: editionOf(rows.occasion),
    startsAt,
    ...composeNight(rows, LORNE),
  };
}

const ONE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TWO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const THREE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const LATER = new Date("2026-12-01T00:00:00Z");

/** Maya calls the score; Lorne does not. Maya wins night one. */
const mayaWins = night(ONE, "2026-10-26T02:00:00.000Z", {
  responses: [
    answer("final-score", MAYA, [4, 2]),
    answer("final-score", LORNE, [1, 5]),
  ],
  results: { "final-score": [4, 2] },
});

describe("a run of nights", () => {
  it("the first night is its own series, edition 1", () => {
    const first = { id: ONE, details: {} };
    expect(seriesOf(first)).toBe(ONE);
    expect(editionOf(first)).toBe(1);
    expect(seriesOf({ id: TWO, details: { series: ONE, edition: 2 } })).toBe(
      ONE,
    );
    // Junk in the jsonb is not an edition.
    expect(editionOf({ details: { edition: -3 } })).toBe(1);
  });

  it("a later night says so on its poster and its Cup, and starts at zero", () => {
    const two = night(TWO, "2026-11-09T03:00:00.000Z", {
      series: ONE,
      edition: 2,
    });
    expect(two.definition.kicker).toBe("Rogers Arena · No. 2");
    const cup = two.definition.blocks.find((b) => b.kind === "leaderboard");
    expect(cup?.subtitle).toMatch(/No\. 2\. Points start at zero/);
    expect(two.definition.lineage).toBeUndefined();
  });

  it("offers Run it back from the morning after, not a fortnight later", () => {
    const block = mayaWins.definition.blocks.find(
      (b) => b.kind === "runItBack",
    );
    expect(block?.phaseIds).toEqual(["morning", "again"]);
  });
});

describe("the Sycle Cup", () => {
  it("has no winner before the night is over", () => {
    const early = cupResult(mayaWins, new Date("2026-10-26T03:00:00Z"));
    expect(early.status).toBe("upcoming");
    expect(early.champions).toEqual([]);
  });

  it("goes to whoever topped the night, flagged when results were left uncalled", () => {
    const result = cupResult(mayaWins, LATER);
    expect(result.status).toBe("won");
    expect(result.champions.map((c) => c.name)).toEqual(["Maya"]);
    // Overtime, total goals and the rest were never called.
    expect(result.unofficial).toBe(true);
  });

  it("is nobody's when nobody scored", () => {
    const quiet = night(TWO, "2026-11-09T03:00:00.000Z", {
      series: ONE,
      edition: 2,
    });
    expect(cupResult(quiet, LATER).status).toBe("no-result");
  });

  it("counts titles across nights and does not carry points", () => {
    const lorneWins = night(TWO, "2026-11-09T03:00:00.000Z", {
      series: ONE,
      edition: 2,
      responses: [answer("overtime", LORNE, true)],
      results: { overtime: true },
    });
    const mayaAgain = night(THREE, "2026-11-23T03:00:00.000Z", {
      series: ONE,
      edition: 3,
      responses: [answer("overtime", MAYA, false)],
      results: { overtime: false },
    });
    const cup = sycleCup(ONE, [mayaAgain, mayaWins, lorneWins], LATER);
    expect(cup.nights.map((n) => n.edition)).toEqual([1, 2, 3]);
    expect(cup.holders.map((h) => [h.participant.name, h.titles])).toEqual([
      ["Maya", 2],
      ["Lorne", 1],
    ]);
    expect(cup.holding.map((p) => p.name)).toEqual(["Maya"]);
    // Night three's own table started from nothing.
    expect(cupResult(mayaAgain, LATER).champions).toHaveLength(1);
  });

  it("names people as they call themselves now", () => {
    const renamed = night(TWO, "2026-11-09T03:00:00.000Z", {
      series: ONE,
      edition: 2,
      members: [
        member(LORNE, "host", "Lorne"),
        member(MAYA, "guest", "Maya the Prophet"),
      ],
    });
    const cup = sycleCup(ONE, [mayaWins, renamed], LATER);
    expect(cup.holding[0].name).toBe("Maya the Prophet");
  });
});

describe("last time", () => {
  it("carries the defending champion and the receipts, never the points", () => {
    const two = night(TWO, "2026-11-09T03:00:00.000Z", {
      series: ONE,
      edition: 2,
    });
    const lineage = lastTime(
      { edition: 2, participants: two.definition.participants },
      [mayaWins, two],
      LATER,
    );
    expect(lineage?.defendingChampionId).toBe(MAYA);
    expect(lineage?.previousLabel).toBe("No. 1 · Canucks vs Wild");
    expect(lineage?.callback).toMatch(/Maya won it/);
  });

  it("does not name a champion who is not on this night", () => {
    const withoutMaya = night(TWO, "2026-11-09T03:00:00.000Z", {
      series: ONE,
      edition: 2,
      members: [member(LORNE, "host", "Lorne"), member(SAM, "guest", "Sam")],
    });
    const lineage = lastTime(
      { edition: 2, participants: withoutMaya.definition.participants },
      [mayaWins, withoutMaya],
      LATER,
    );
    expect(lineage?.defendingChampionId).toBeUndefined();
    expect(lineage?.standing.map((s) => s.participantId)).not.toContain(MAYA);
  });

  it("is nothing on a first night, or when last time is still to come", () => {
    expect(
      lastTime(
        { edition: 1, participants: mayaWins.definition.participants },
        [mayaWins],
        LATER,
      ),
    ).toBeNull();
    expect(
      lastTime(
        { edition: 2, participants: mayaWins.definition.participants },
        [mayaWins],
        new Date("2026-10-20T00:00:00Z"),
      ),
    ).toBeNull();
  });
});

describe("actions", () => {
  it("still has no way to name who is acting", () => {
    const parsed = ActionSchema.safeParse({
      type: "say",
      text: "hi",
      actorId: MAYA,
    });
    expect(parsed.success && "actorId" in parsed.data).toBe(false);
  });
});
