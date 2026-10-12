import { describe, expect, it } from "vitest";
import { liveExperience } from "@/experience-lab/core/engine";
import { answerProblem, ActionSchema } from "./actions";
import { defaultLook } from "./identity";
import {
  SYCLE_HOCKEY_NIGHT,
  composeNight,
  templateRules,
  type MemberRow,
  type NightRows,
} from "./night";

const HOST = "11111111-1111-4111-8111-111111111111";
const GUEST = "22222222-2222-4222-8222-222222222222";
const GONE = "33333333-3333-4333-8333-333333333333";

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

function rows(overrides: Partial<NightRows> = {}): NightRows {
  return {
    occasion: {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      template: SYCLE_HOCKEY_NIGHT.template,
      title: SYCLE_HOCKEY_NIGHT.title,
      starts_at: SYCLE_HOCKEY_NIGHT.startsAt,
      host_id: HOST,
      details: SYCLE_HOCKEY_NIGHT.details,
      brief: null,
    },
    members: [member(HOST, "host", "Lorne"), member(GUEST, "guest", "Maya")],
    prompts: templateRules().map((r) => ({
      prompt_id: r.id,
      reveal: r.reveal,
      lock_offset_minutes: r.lockOffsetMinutes,
      audience_only: null,
      open_to_suggestions: r.openToSuggestions,
      asked_by: null,
      content: null,
      resolution: null,
    })),
    options: [],
    responses: [],
    moments: [],
    reactions: [],
    cues: [],
    consents: [],
    ...overrides,
  };
}

const BEFORE = new Date("2026-10-15T20:00:00Z");

describe("the real night carries no invented facts", () => {
  const { definition } = composeNight(rows(), HOST);
  const text = JSON.stringify(definition);

  it("is the M216 game: Canucks vs Wild, Sunday 25 October at 7pm Pacific", () => {
    expect(definition.subtitle).toBe("Canucks vs Wild");
    expect(definition.anchorAt).toBe("2026-10-26T02:00:00.000Z");
    expect(definition.phases[0].headline).toMatch(/^Make Sunday worse/);
    expect(text).not.toContain("Flames");
    expect(text).not.toContain("Section 302");
  });

  it("has no fixture people, seeded answers, past standings or authored results", () => {
    expect(definition.participants.map((p) => p.name)).toEqual([
      "Lorne",
      "Maya",
    ]);
    expect(definition.seedResponses).toEqual([]);
    expect(definition.seedMoments).toEqual([]);
    expect(definition.lineage).toBeUndefined();
    expect(
      definition.prompts.filter((p) => p.resolution !== undefined),
    ).toEqual([]);
    expect(definition.prompts.filter((p) => p.askedBy)).toEqual([]);
    for (const name of ["Nathan", "Dave", "Sarah", "Mike", "Priya"]) {
      expect(text).not.toContain(name);
    }
  });

  it("asks about the real host, and the refs question is about the real people", () => {
    const beer = definition.prompts.find((p) => p.id === "host-beer");
    expect(beer?.question).toBe(
      "Will Lorne buy a $19 arena beer before puck drop?",
    );
    const refs = definition.prompts.find((p) => p.id === "refs");
    expect(refs?.options?.map((o) => o.id)).toEqual([HOST, GUEST]);
  });

  it("does not invent restaurants or walking times", () => {
    const spot = definition.prompts.find((p) => p.id === "pregame-spot");
    expect(spot?.options?.map((o) => o.id)).toEqual(["concourse"]);
  });

  it("keeps the prototype's shape: every block's questions exist", () => {
    const ids = new Set(definition.prompts.map((p) => p.id));
    for (const block of definition.blocks) {
      for (const id of block.promptIds ?? []) expect(ids.has(id)).toBe(true);
    }
  });

  it("does not offer the toy whose privacy the server cannot yet keep", () => {
    expect(definition.starters?.people).toBeUndefined();
    expect(definition.starters?.prediction?.length).toBeGreaterThan(0);
  });
});

describe("rules written to the database match the questions", () => {
  it("locks every pick at puck drop and the pregame spot at warm-up", () => {
    const rules = new Map(templateRules().map((r) => [r.id, r]));
    expect(rules.get("final-score")).toMatchObject({
      reveal: "onLock",
      lockOffsetMinutes: 0,
    });
    expect(rules.get("pregame-spot")).toMatchObject({
      reveal: "immediate",
      lockOffsetMinutes: -90,
      openToSuggestions: true,
    });
    expect(rules.get("vault")).toMatchObject({
      reveal: "onCue",
      lockOffsetMinutes: 100,
    });
    expect(rules.has("story")).toBe(false);
  });
});

describe("only members exist", () => {
  it("drops everything a removed person wrote, so removal is never half-done", () => {
    const { state } = composeNight(
      rows({
        responses: [
          {
            prompt_id: "pregame-spot",
            user_id: GUEST,
            value: "concourse",
            answered_at: "2026-10-13T00:00:00Z",
          },
          {
            prompt_id: "pregame-spot",
            user_id: GONE,
            value: "concourse",
            answered_at: "2026-10-13T00:00:00Z",
          },
        ],
        moments: [
          {
            id: "m1",
            actor_id: GONE,
            kind: "note",
            text: "boo",
            emoji: null,
            at: "2026-10-13T00:00:00Z",
          },
          {
            id: "m2",
            actor_id: GUEST,
            kind: "note",
            text: "yay",
            emoji: null,
            at: "2026-10-13T00:00:00Z",
          },
        ],
        reactions: [
          { moment_id: "m2", emoji: "😂", user_id: GONE },
          { moment_id: "m2", emoji: "😂", user_id: HOST },
        ],
      }),
      GUEST,
    );
    expect(state.responses.map((r) => r.participantId)).toEqual([GUEST]);
    expect(state.moments.map((m) => m.id)).toEqual(["m2"]);
    expect(state.reactions.m2["😂"]).toEqual([HOST]);
  });

  it("a non-member is nobody", () => {
    expect(composeNight(rows(), GONE).state.meId).toBeNull();
  });
});

describe("the engine runs unchanged on what comes out", () => {
  it("shows a vote everyone can see, and a pick sealed until you make yours", () => {
    const night = composeNight(
      rows({
        responses: [
          {
            prompt_id: "pregame-spot",
            user_id: HOST,
            value: "concourse",
            answered_at: "2026-10-13T00:00:00Z",
          },
        ],
      }),
      GUEST,
    );
    const live = liveExperience(night.definition, night.state, BEFORE);
    const spot = live.prompts.find((p) => p.prompt.id === "pregame-spot");
    expect(
      spot?.tally
        .find((t) => t.optionId === "concourse")
        ?.voters.map((v) => v.name),
    ).toEqual(["Lorne"]);
    expect(live.phase.id).toBe("before");
    expect(live.me?.name).toBe("Maya");
  });

  it("the cue on the vault becomes Passport saying so, not a person", () => {
    const { state } = composeNight(
      rows({
        cues: [
          {
            prompt_id: "vault",
            cued_by: GUEST,
            cued_at: "2026-10-26T03:45:00Z",
          },
        ],
      }),
      HOST,
    );
    expect(state.cues).toEqual(["vault"]);
    const opened = state.moments.find((m) => m.kind === "voice");
    expect(opened?.text).toBe("🔓 Opened.");
    expect(opened?.by).toBeUndefined();
  });

  it("a called result reaches the definition", () => {
    const r = rows();
    const called = {
      ...r,
      prompts: r.prompts.map((p) =>
        p.prompt_id === "final-score"
          ? { ...p, resolution: [4, 2] as [number, number] }
          : p,
      ),
    };
    const { definition } = composeNight(called, HOST);
    expect(
      definition.prompts.find((p) => p.id === "final-score")?.resolution,
    ).toEqual([4, 2]);
  });
});

describe("answers", () => {
  const night = composeNight(rows(), GUEST);
  const live = liveExperience(night.definition, night.state, BEFORE);
  const prompt = (id: string) => live.prompts.find((p) => p.prompt.id === id);

  it("accepts real answers and refuses nonsense", () => {
    expect(
      answerProblem(prompt("final-score"), [3, 2], live.participants),
    ).toBeNull();
    expect(
      answerProblem(prompt("final-score"), [3, 99], live.participants),
    ).not.toBeNull();
    expect(
      answerProblem(prompt("pregame-spot"), "concourse", live.participants),
    ).toBeNull();
    expect(
      answerProblem(
        prompt("pregame-spot"),
        "a-made-up-option",
        live.participants,
      ),
    ).not.toBeNull();
    expect(answerProblem(prompt("refs"), HOST, live.participants)).toBeNull();
    expect(
      answerProblem(prompt("refs"), GONE, live.participants),
    ).not.toBeNull();
    expect(
      answerProblem(prompt("overtime"), "maybe", live.participants),
    ).not.toBeNull();
    expect(answerProblem(undefined, 1, live.participants)).not.toBeNull();
  });

  it("will not take a pick after puck drop", () => {
    const during = liveExperience(
      night.definition,
      night.state,
      new Date("2026-10-26T02:30:00Z"),
    );
    const locked = during.prompts.find((p) => p.prompt.id === "final-score");
    expect(answerProblem(locked, [1, 0], during.participants)).toMatch(
      /locked/,
    );
  });

  it("will not bind anybody to a forfeit they have not opted into", () => {
    expect(
      answerProblem(prompt("sides"), "canucks", live.participants),
    ).toMatch(/Opt in/);
  });
});

describe("actions never carry who is acting", () => {
  it("strips nothing because there is nothing to strip — an actor field is simply not part of any action", () => {
    const parsed = ActionSchema.safeParse({
      type: "say",
      text: "hi",
      actorId: HOST,
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && "actorId" in parsed.data).toBe(false);
  });

  it("refuses an action that is not one", () => {
    expect(ActionSchema.safeParse({ type: "makeMeHost" }).success).toBe(false);
  });
});

describe("identity", () => {
  it("is stable per account, so the same person looks the same on every device", () => {
    expect(defaultLook(GUEST)).toEqual(defaultLook(GUEST));
    expect(defaultLook(GUEST).hue).toBeGreaterThanOrEqual(0);
    expect(defaultLook(GUEST).hue).toBeLessThan(360);
  });
});
