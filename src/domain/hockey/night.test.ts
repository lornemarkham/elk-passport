import { describe, expect, it } from "vitest";
import { liveExperience } from "@/experience-lab/core/engine";
import { answerProblem, ActionSchema } from "./actions";
import { defaultLook } from "./identity";
import { MODULE_IDS, modulesOf, storedModules } from "./modules";
import {
  SYCLE_HOCKEY_NIGHT,
  composeNight,
  meetingPrompt,
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

  it("offers real meeting points by the arena, from the curated list, with honest distances", () => {
    const meet = definition.prompts.find((p) => p.id === "meet-spot");
    expect(meet).toMatchObject({
      reveal: "immediate",
      openToSuggestions: true,
    });
    const labels = meet?.options?.map((o) => o.label) ?? [];
    expect(labels).toContain("Stadium–Chinatown Station");
    expect(labels.at(-1)).toBe("Just meet at our seats");
    for (const o of meet?.options?.slice(0, -1) ?? [])
      expect(o.detail).toMatch(
        /straight line .* min walk \(estimate\) to Rogers Arena\.$/,
      );
    // Still defined, so an earlier night's answers are read, but no longer
    // asked: the pregame winner is where the group meets.
    const pregame = definition.blocks.find((b) => b.id === "pregame");
    expect(pregame?.promptIds).not.toContain("meet-spot");
  });

  it("asks who is coming to the pregame instead, answers visible and changeable until puck drop", () => {
    const plans = definition.prompts.find((p) => p.id === "pregame-plans");
    expect(plans).toMatchObject({
      reveal: "immediate",
      locksAtPhaseId: "live",
    });
    expect(plans?.options?.map((o) => o.label)).toEqual([
      "Joining pregame",
      "Meeting at the arena",
      "Not sure yet",
    ]);
    const pregame = definition.blocks.find((b) => b.id === "pregame");
    expect(pregame?.promptIds?.slice(0, 2)).toEqual([
      "pregame-spot",
      "pregame-plans",
    ]);
    // …and the after-party is planned with the rest of the night.
    expect(pregame?.promptIds).toContain("postgame");
  });

  it("asks no meeting question at a venue the curated list knows nothing near", () => {
    expect(
      meetingPrompt({ ...SYCLE_HOCKEY_NIGHT.details, venueAt: [45.5, -73.55] }),
    ).toEqual([]);
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
    expect(rules.get("meet-spot")).toMatchObject({
      reveal: "immediate",
      lockOffsetMinutes: -90,
      openToSuggestions: true,
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

describe("the plan", () => {
  const spot = (user_id: string, value: string) => ({
    prompt_id: "pregame-spot",
    user_id,
    value,
    answered_at: "2026-10-13T00:00:00Z",
  });
  const planOf = (r: NightRows) =>
    composeNight(r, HOST).definition.blocks.find((b) => b.id === "plan");

  it("is absent until somebody has voted", () => {
    expect(planOf(rows())).toBeUndefined();
  });

  it("names the leader, and says so honestly when tied", () => {
    const one = planOf(rows({ responses: [spot(HOST, "concourse")] }));
    expect(one?.lines?.[0]).toMatchObject({
      label: "Eating",
      emphasis: true,
    });
    expect(one?.lines?.[0].value).toContain("1 vote");

    const tied = planOf(
      rows({
        options: [
          {
            id: "opt-1",
            prompt_id: "pregame-spot",
            label: "Rogue Kitchen",
            detail: null,
            added_by: GUEST,
          },
        ],
        responses: [spot(HOST, "concourse"), spot(GUEST, "opt-1")],
      }),
    );
    expect(tied?.lines?.[0].value).toMatch(/^Tied at 1 vote:/);
  });

  it("ignores votes from people who have left", () => {
    expect(
      planOf(rows({ responses: [spot(GONE, "concourse")] })),
    ).toBeUndefined();
  });
});

describe("what's in tonight", () => {
  const withModules = (modules: readonly string[]) =>
    rows({
      occasion: {
        ...rows().occasion,
        details: { ...SYCLE_HOCKEY_NIGHT.details, modules },
      },
    });
  const ids = (r: NightRows) =>
    liveExperience(
      composeNight(r, GUEST).definition,
      composeNight(r, GUEST).state,
      BEFORE,
    ).prompts.map((p) => p.prompt.id);

  it("has everything on a night that never said, and says so", () => {
    const night = composeNight(rows(), HOST);
    expect(night.modules).toEqual([...MODULE_IDS]);
    expect(ids(rows())).toEqual(
      expect.arrayContaining(["pregame-spot", "hard-out", "final-score"]),
    );
  });

  it("leaves out exactly the questions of a module the host turned off", () => {
    const night = withModules(["dinner", "meet", "leaving", "games"]);
    const on = ids(night);
    expect(on).toContain("pregame-spot");
    expect(on).toContain("hard-out");
    for (const pick of ["final-score", "first-team", "overtime", "host-beer"]) {
      expect(on).not.toContain(pick);
    }
    expect(
      composeNight(night, HOST).definition.blocks.find((b) => b.id === "picks")
        ?.title,
    ).toBe("Ask the group");
    expect(composeNight(night, HOST).modules).toEqual([
      "dinner",
      "meet",
      "leaving",
      "games",
    ]);
  });

  it("refuses an answer to a question that is switched off, as it would one that never existed", () => {
    const night = withModules(["picks"]);
    const { definition, state } = composeNight(night, GUEST);
    const live = liveExperience(definition, state, BEFORE);
    const dinner = live.prompts.find((p) => p.prompt.id === "pregame-spot");
    expect(dinner).toBeUndefined();
    expect(answerProblem(dinner, "concourse", live.participants)).not.toBe(
      null,
    );
  });

  it("without games there is no toy box, and what was asked through it is hidden, not deleted", () => {
    const asked = {
      prompt_id: "toy-ask-x1",
      reveal: "immediate" as const,
      lock_offset_minutes: null,
      audience_only: null,
      open_to_suggestions: false,
      asked_by: GUEST,
      content: {
        id: "toy-ask-x1",
        question: "Who cries first?",
        kind: "person" as const,
        phaseId: "before",
        reveal: "immediate" as const,
      },
      resolution: null,
    };
    const base = withModules(["dinner", "picks"]);
    const night = { ...base, prompts: [...base.prompts, asked] };
    const { definition, state } = composeNight(night, HOST);
    expect(definition.blocks.some((b) => b.inviteOwnPrompt)).toBe(false);
    expect(state.addedPrompts).toHaveLength(0);

    const back = {
      ...night,
      occasion: {
        ...night.occasion,
        details: { ...night.occasion.details, modules: [...MODULE_IDS] },
      },
    };
    expect(composeNight(back, HOST).state.addedPrompts).toHaveLength(1);
  });

  it("stores only modules it knows, in one order, and reads junk as everything", () => {
    expect(storedModules(["picks", "nonsense", "dinner", "picks"])).toEqual([
      "dinner",
      "picks",
    ]);
    expect([...modulesOf({ modules: "all" })]).toEqual([...MODULE_IDS]);
    expect([...modulesOf({ modules: [] })]).toEqual([]);
  });

  it("only takes module lists made of modules", () => {
    expect(
      ActionSchema.safeParse({ type: "setModules", modules: ["picks"] })
        .success,
    ).toBe(true);
    expect(
      ActionSchema.safeParse({ type: "setModules", modules: ["betting"] })
        .success,
    ).toBe(false);
  });
});
