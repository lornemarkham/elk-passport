import { describe, expect, it } from "vitest";
import {
  feedbackFingerprint,
  isParticipantId,
  screenFeedback,
  screenName,
} from "./sanitize";
import {
  applyAction,
  initialState,
  memoryFairview3,
  normalizeState,
  parsePresenterAction,
} from "./store";
import { leaderOf } from "./show";

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

  it("finale and track fields patch independently", async () => {
    const s = memoryFairview3("key");
    await s.presenter("key", {
      type: "track",
      track: "country",
      audioUrl: "https://x.y/a.mp3",
    });
    await s.presenter("key", { type: "finale", track: "country", volume: 0.5 });
    await s.presenter("key", { type: "finale", started: true });
    const { finale } = (await s.snapshot()).state;
    expect(finale.started).toBe(true);
    expect(finale.track).toBe("country");
    expect(finale.volume).toBe(0.5);
    expect(finale.tracks.country).toEqual({
      audioUrl: "https://x.y/a.mp3",
      lyrics: null,
    });
    expect(finale.tracks.metal.audioUrl).toBeNull();
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
        type: "track",
        track: "country",
        audioUrl: "",
        lyrics: "la",
      }),
    ).toEqual({
      type: "track",
      track: "country",
      audioUrl: null,
      lyrics: "la",
    });
    expect(
      parsePresenterAction({ type: "finale", started: true, track: "metal" }),
    ).toEqual({ type: "finale", started: true, track: "metal" });
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
      parsePresenterAction({
        type: "track",
        track: "metal",
        audioUrl: "javascript:alert(1)",
      }),
    ).toBeNull();
    expect(
      parsePresenterAction({
        type: "track",
        track: "metal",
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
    const base = { ...initialState(), rev: 3 };
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

const open = (s: ReturnType<typeof memoryFairview3>, question: "q4") =>
  s.presenter("key", { type: "question", question, status: "open" });

describe("memory store: Hot Seat", () => {
  it("shows a question to the room, never hidden ones, and keeps participants out", async () => {
    const s = memoryFairview3("key");
    expect(await s.ask(P1, "Pat", "How will we measure referrals?")).toBe("ok");
    expect(await s.ask(P2, "Sam", "What is the Pro migration date?")).toBe(
      "ok",
    );
    let snap = await s.snapshot();
    expect(snap.qa).toHaveLength(2);
    expect(JSON.stringify(snap)).not.toContain(P1);
    const id = snap.qa[0]!.id;
    await s.presenter("key", { type: "qa-moderate", id, status: "hidden" });
    snap = await s.snapshot();
    expect(snap.qa.map((q) => q.id)).not.toContain(id);
    expect((await s.inbox("key"))!.qa).toHaveLength(2);
  });

  it("orders by upvotes, one per phone, and takes them back", async () => {
    const s = memoryFairview3("key");
    await s.ask(P1, "Pat", "First question here");
    await s.ask(P1, "Pat", "Second question here");
    const [a, b] = (await s.snapshot()).qa;
    expect(await s.upvote(P1, b!.id, true)).toBe("ok");
    expect(await s.upvote(P1, b!.id, true)).toBe("ok");
    expect(await s.upvote(P2, b!.id, true)).toBe("ok");
    let snap = await s.snapshot();
    expect(snap.qa[0]).toMatchObject({ id: b!.id, votes: 2 });
    await s.upvote(P1, b!.id, false);
    await s.upvote(P2, b!.id, false);
    await s.upvote(P2, a!.id, true);
    snap = await s.snapshot();
    expect(snap.qa[0]).toMatchObject({ id: a!.id, votes: 1 });
    expect(await s.upvote(P1, "no-such-question", true)).toBe("missing");
  });

  it("refuses duplicates and more than five per phone", async () => {
    const s = memoryFairview3("key");
    expect(await s.ask(P1, "Pat", "Same question?")).toBe("ok");
    expect(await s.ask(P1, "Pat", "same   question")).toBe("duplicate");
    for (let i = 0; i < 4; i++) await s.ask(P1, "Pat", `Question number ${i}`);
    expect(await s.ask(P1, "Pat", "One too many")).toBe("too-many");
  });

  it("only the presenter selects; answering or hiding clears the stage", async () => {
    const s = memoryFairview3("key");
    await s.ask(P1, "Pat", "Why now?");
    const id = (await s.snapshot()).qa[0]!.id;
    expect(await s.presenter("nope", { type: "qa-select", id })).toBe(false);
    expect((await s.snapshot()).state.qa.selected).toBeNull();
    await s.presenter("key", { type: "qa-select", id });
    expect((await s.snapshot()).state.qa.selected).toBe(id);
    await s.presenter("key", { type: "qa-moderate", id, status: "answered" });
    const snap = await s.snapshot();
    expect(snap.state.qa.selected).toBeNull();
    expect(snap.qa[0]!.status).toBe("answered");
    // A hidden question cannot be put on the stage.
    await s.presenter("key", { type: "qa-moderate", id, status: "hidden" });
    await s.presenter("key", { type: "qa-select", id });
    expect((await s.snapshot()).state.qa.selected).toBeNull();
  });

  it("reset qa leaves votes alone", async () => {
    const s = memoryFairview3("key");
    await open(s, "q4");
    await s.vote(P1, "q4", 2);
    await s.ask(P1, "Pat", "A question");
    await s.presenter("key", { type: "reset", what: "qa" });
    const snap = await s.snapshot();
    expect(snap.qa).toHaveLength(0);
    expect(snap.tallies.q4).toEqual([0, 0, 1]);
  });
});

describe("memory store: musical showdown", () => {
  it("counts one vote per phone over three tracks and finds the leader", async () => {
    const s = memoryFairview3("key");
    expect(await s.vote(P1, "q4", 0)).toBe("closed");
    await open(s, "q4");
    await s.vote(P1, "q4", 1);
    await s.vote(P1, "q4", 2);
    await s.vote(P2, "q4", 2);
    expect(await s.vote(P2, "q4", 3)).toBe("bad-option");
    const { tallies } = await s.snapshot();
    expect(tallies.q4).toEqual([0, 0, 2]);
    expect(leaderOf(tallies.q4)).toBe("electroswing");
    expect(leaderOf([1, 1, 0])).toBeNull();
    expect(leaderOf([0, 0, 0])).toBeNull();
  });

  it("announces a fixed winner and resets with the votes", async () => {
    const s = memoryFairview3("key");
    await s.presenter("key", {
      type: "showdown",
      announced: true,
      winner: "country",
    });
    expect((await s.snapshot()).state.showdown).toEqual({
      announced: true,
      winner: "country",
    });
    await s.presenter("key", { type: "reset", what: "votes" });
    expect((await s.snapshot()).state.showdown.announced).toBe(false);
  });
});

describe("Hot Seat and showdown wire format", () => {
  it("parses the new actions and refuses bad ones", () => {
    expect(parsePresenterAction({ type: "qa-select", id: null })).toEqual({
      type: "qa-select",
      id: null,
    });
    expect(
      parsePresenterAction({ type: "qa-moderate", id: "x", status: "bad" }),
    ).toBeNull();
    expect(parsePresenterAction({ type: "track", track: "polka" })).toBeNull();
    expect(
      parsePresenterAction({
        type: "track",
        track: "metal",
        audioUrl: "http://x/a.mp3",
      }),
    ).toBeNull();
    expect(
      parsePresenterAction({
        type: "track",
        track: "metal",
        audioUrl: "/fairview3/audio/a.mp3",
      }),
    ).not.toBeNull();
    expect(parsePresenterAction({ type: "finale", volume: 2 })).toBeNull();
    expect(
      parsePresenterAction({ type: "showdown", winner: "polka" }),
    ).toBeNull();
    expect(parsePresenterAction({ type: "reset", what: "qa" })).not.toBeNull();
  });

  it("fills a legacy state to shape", () => {
    const old = {
      section: "finale",
      questions: { q1: "open" },
      finale: { started: true, audioUrl: "https://x/a.mp3", lyrics: "words" },
      rev: 9,
    };
    const s = normalizeState(old);
    expect(s.questions).toEqual({
      q1: "open",
      q2: "closed",
      q3: "closed",
      q4: "closed",
    });
    expect(s.finale.tracks.metal).toEqual({ audioUrl: null, lyrics: null });
    expect(s.qa.selected).toBeNull();
    expect(s.rev).toBe(9);
  });

  it("screens display names", () => {
    expect(screenName("  Pat  Lee ")).toEqual({ ok: true, body: "Pat Lee" });
    expect(screenName("")).toEqual({ ok: true, body: "Anonymous" });
    expect(screenName("pat@example.com").ok).toBe(false);
    expect(screenName("x".repeat(40)).ok).toBe(false);
  });
});
