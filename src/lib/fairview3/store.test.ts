import { describe, expect, it } from "vitest";
import {
  feedbackFingerprint,
  isParticipantId,
  screenFeedback,
} from "./sanitize";
import { applyAction, memoryFairview3, parsePresenterAction } from "./store";

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";

describe("memory store: voting", () => {
  it("refuses a vote while the question is closed", async () => {
    const s = memoryFairview3("key");
    expect(await s.vote(P1, "q1", 0)).toBe("closed");
    expect((await s.snapshot()).tallies.q1).toEqual([0, 0, 0, 0, 0]);
  });

  it("counts one vote per participant and lets them change their mind", async () => {
    const s = memoryFairview3("key");
    await s.presenter("key", {
      type: "question",
      question: "q1",
      status: "open",
    });
    expect(await s.vote(P1, "q1", 1)).toBe("ok");
    expect(await s.vote(P1, "q1", 1)).toBe("ok");
    expect(await s.vote(P2, "q1", 4)).toBe("ok");
    expect((await s.snapshot()).tallies.q1).toEqual([0, 1, 0, 0, 1]);
    expect(await s.vote(P1, "q1", 4)).toBe("ok");
    expect((await s.snapshot()).tallies.q1).toEqual([0, 0, 0, 0, 2]);
    expect((await s.snapshot()).participants).toBe(2);
  });

  it("refuses an option the question does not have", async () => {
    const s = memoryFairview3("key");
    await s.presenter("key", {
      type: "question",
      question: "q3",
      status: "open",
    });
    expect(await s.vote(P1, "q3", 3)).toBe("bad-option");
    expect(await s.vote(P1, "q3", -1)).toBe("bad-option");
    expect(await s.vote(P1, "q3", 1.5)).toBe("bad-option");
  });

  it("stops counting once revealed", async () => {
    const s = memoryFairview3("key");
    await s.presenter("key", {
      type: "question",
      question: "q2",
      status: "revealed",
    });
    expect(await s.vote(P1, "q2", 0)).toBe("closed");
  });
});

describe("memory store: feedback", () => {
  it("lands pending and only reaches the snapshot once approved", async () => {
    const s = memoryFairview3("key");
    expect(await s.feedback(P1, "missed", "Talk about on-call")).toBe("ok");
    expect((await s.snapshot()).feedback).toEqual([]);
    const inbox = await s.inbox("key");
    expect(inbox?.counts).toEqual({ pending: 1, approved: 0, hidden: 0 });
    const id = inbox!.feedback[0]!.id;
    await s.presenter("key", { type: "moderate", id, status: "approved" });
    expect((await s.snapshot()).feedback).toEqual([
      { id, prompt: "missed", body: "Talk about on-call" },
    ]);
    await s.presenter("key", { type: "moderate", id, status: "hidden" });
    expect((await s.snapshot()).feedback).toEqual([]);
  });

  it("refuses the same thing twice from one phone, and too many from one phone", async () => {
    const s = memoryFairview3("key");
    expect(await s.feedback(P1, "better", "Ship the baseline!")).toBe("ok");
    expect(await s.feedback(P1, "better", "ship the BASELINE")).toBe(
      "duplicate",
    );
    for (let i = 1; i < 6; i++)
      expect(await s.feedback(P1, "deliver", `idea ${i}`)).toBe("ok");
    expect(await s.feedback(P1, "deliver", "one more")).toBe("too-many");
    expect(await s.feedback(P2, "deliver", "one more")).toBe("ok");
  });

  it("the inbox is only for the presenter", async () => {
    const s = memoryFairview3("key");
    expect(await s.inbox("nope")).toBeNull();
    expect(await s.inbox("")).toBeNull();
  });
});

describe("memory store: presenter", () => {
  it("refuses the wrong key and the empty key", async () => {
    const s = memoryFairview3("key");
    expect(await s.presenterOk("wrong")).toBe(false);
    expect(await s.presenterOk("")).toBe(false);
    expect(
      await s.presenter("wrong", { type: "section", section: "know" }),
    ).toBe(false);
    expect((await s.snapshot()).state.section).toBe("curtain");
  });

  it("moves sections, bumps rev, and resets", async () => {
    const s = memoryFairview3("key");
    await s.presenter("key", { type: "section", section: "know" });
    let snap = await s.snapshot();
    expect(snap.state.section).toBe("know");
    expect(snap.state.rev).toBe(1);
    await s.presenter("key", {
      type: "question",
      question: "q1",
      status: "open",
    });
    await s.vote(P1, "q1", 2);
    await s.feedback(P1, "missed", "x y z");
    await s.presenter("key", { type: "reset", what: "votes" });
    snap = await s.snapshot();
    expect(snap.tallies.q1).toEqual([0, 0, 0, 0, 0]);
    expect((await s.inbox("key"))!.counts.pending).toBe(1);
    await s.presenter("key", { type: "reset", what: "all" });
    snap = await s.snapshot();
    expect(snap.state.section).toBe("curtain");
    expect(snap.participants).toBe(0);
    expect((await s.inbox("key"))!.counts.pending).toBe(0);
  });

  it("finale fields patch independently", async () => {
    const s = memoryFairview3("key");
    await s.presenter("key", { type: "finale", audioUrl: "https://x.y/a.mp3" });
    await s.presenter("key", { type: "finale", started: true });
    const { finale } = (await s.snapshot()).state;
    expect(finale).toEqual({
      started: true,
      audioUrl: "https://x.y/a.mp3",
      lyrics: null,
    });
  });
});

describe("parsePresenterAction", () => {
  it("accepts well-formed actions", () => {
    expect(
      parsePresenterAction({ type: "section", section: "finale" }),
    ).toEqual({ type: "section", section: "finale" });
    expect(
      parsePresenterAction({
        type: "question",
        question: "q2",
        status: "open",
      }),
    ).toEqual({ type: "question", question: "q2", status: "open" });
    expect(
      parsePresenterAction({
        type: "finale",
        started: true,
        audioUrl: "",
        lyrics: "la",
      }),
    ).toEqual({ type: "finale", started: true, audioUrl: null, lyrics: "la" });
    expect(
      parsePresenterAction({ type: "moderate", id: "abc", status: "hidden" }),
    ).toEqual({ type: "moderate", id: "abc", status: "hidden" });
    expect(parsePresenterAction({ type: "reset", what: "all" })).toEqual({
      type: "reset",
      what: "all",
    });
  });

  it("refuses everything else", () => {
    expect(parsePresenterAction(null)).toBeNull();
    expect(
      parsePresenterAction({ type: "section", section: "nope" }),
    ).toBeNull();
    expect(
      parsePresenterAction({
        type: "question",
        question: "q9",
        status: "open",
      }),
    ).toBeNull();
    expect(
      parsePresenterAction({
        type: "question",
        question: "q1",
        status: "later",
      }),
    ).toBeNull();
    expect(
      parsePresenterAction({ type: "finale", audioUrl: "javascript:alert(1)" }),
    ).toBeNull();
    expect(
      parsePresenterAction({
        type: "finale",
        audioUrl: "http://insecure/a.mp3",
      }),
    ).toBeNull();
    expect(parsePresenterAction({ type: "finale", started: "yes" })).toBeNull();
    expect(
      parsePresenterAction({ type: "moderate", id: "x", status: "deleted" }),
    ).toBeNull();
    expect(
      parsePresenterAction({ type: "reset", what: "everything" }),
    ).toBeNull();
    expect(parsePresenterAction({ type: "drop-tables" })).toBeNull();
  });

  it("applyAction ignores moderation (it is not state) and bumps rev otherwise", () => {
    const base = {
      section: "curtain" as const,
      questions: {
        q1: "closed" as const,
        q2: "closed" as const,
        q3: "closed" as const,
      },
      finale: { started: false, audioUrl: null, lyrics: null },
      rev: 3,
    };
    expect(
      applyAction(base, { type: "moderate", id: "x", status: "approved" }),
    ).toBe(base);
    expect(applyAction(base, { type: "section", section: "know" }).rev).toBe(4);
  });
});

describe("screenFeedback", () => {
  it("passes ordinary feedback, trimmed", () => {
    expect(
      screenFeedback("  Pair every squad   with Care Management "),
    ).toEqual({ ok: true, body: "Pair every squad with Care Management" });
  });

  it("refuses what must never reach the stage", () => {
    const refused = (s: string) => expect(screenFeedback(s).ok, s).toBe(false);
    refused("email me at jane@example.com");
    refused("see https://example.com/doc");
    refused("call 604-555-1234");
    refused("MRN 12345 looked wrong");
    refused("patient dob 01/02/1980 was");
    refused("ab");
    refused("x".repeat(281));
    refused(42 as unknown as string);
  });

  it("fingerprints case and punctuation blind", () => {
    expect(feedbackFingerprint("Ship it!!")).toBe(
      feedbackFingerprint("ship IT"),
    );
  });

  it("knows a participant id", () => {
    expect(isParticipantId(P1)).toBe(true);
    expect(isParticipantId("not-a-uuid")).toBe(false);
    expect(isParticipantId("11111111-1111-1111-1111-111111111111")).toBe(false);
  });
});
