import { describe, expect, it } from "vitest";
import { liveExperience } from "@/experience-lab/core/engine";
import {
  SYCLE_HOCKEY_NIGHT,
  composeNight,
  templateRules,
  type NightRows,
} from "./night";
import { promptLocked, sealedFor } from "./sealed";

const HOST = "11111111-1111-4111-8111-111111111111";
const GUEST = "22222222-2222-4222-8222-222222222222";

const member = (user_id: string, role: "host" | "guest", name: string) => ({
  user_id,
  role,
  display_name: name,
  emoji: "🧭",
  hue: 100,
  vibe: null,
  edge: null,
  joined_at: "2026-10-12T00:00:00Z",
});

const rules = templateRules();
const sealedRule = rules.find(
  (r) => r.reveal === "onLock" && r.lockOffsetMinutes !== null,
)!;
const openRule = rules.find((r) => r.reveal === "immediate")!;

function rows(): NightRows {
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
    prompts: rules.map((r) => ({
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
    // Both have sealed the same pick; both voted on an open question.
    responses: [HOST, GUEST].flatMap((user_id) => [
      {
        prompt_id: sealedRule.id,
        user_id,
        value: "a",
        answered_at: "2026-10-20T00:00:00Z",
      },
      {
        prompt_id: openRule.id,
        user_id,
        value: "b",
        answered_at: "2026-10-20T00:00:00Z",
      },
    ]),
    moments: [],
    reactions: [],
    cues: [],
    consents: [],
  };
}

const lockAt =
  new Date(SYCLE_HOCKEY_NIGHT.startsAt).getTime() +
  (sealedRule.lockOffsetMinutes as number) * 60_000;
const BEFORE = new Date(lockAt - 60_000);
const AFTER = new Date(lockAt + 60_000);

describe("sealed picks stay sealed until puck drop, for everybody", () => {
  it("sealing your own pick does not reveal anybody else's", () => {
    const mine = sealedFor(rows(), HOST, BEFORE).responses;
    expect(mine.filter((r) => r.prompt_id === sealedRule.id)).toEqual([
      expect.objectContaining({ user_id: HOST }),
    ]);
    // What the page is built from carries no trace of Maya's pick either.
    const { definition, state } = composeNight(
      sealedFor(rows(), HOST, BEFORE),
      HOST,
    );
    const live = liveExperience(definition, state, BEFORE);
    const prompt = live.prompts.find((p) => p.prompt.id === sealedRule.id);
    expect(prompt?.responses.map((r) => r.participantId)).toEqual([HOST]);
  });

  it("leaves open questions and your own answers alone", () => {
    const seen = sealedFor(rows(), GUEST, BEFORE).responses;
    expect(seen.filter((r) => r.prompt_id === openRule.id)).toHaveLength(2);
    expect(
      seen.some((r) => r.prompt_id === sealedRule.id && r.user_id === GUEST),
    ).toBe(true);
  });

  it("opens every pick once the prompt locks", () => {
    expect(promptLocked(rows(), sealedRule.id, BEFORE)).toBe(false);
    expect(promptLocked(rows(), `${sealedRule.id}::derived`, AFTER)).toBe(true);
    expect(sealedFor(rows(), HOST, AFTER).responses).toHaveLength(4);
  });
});
