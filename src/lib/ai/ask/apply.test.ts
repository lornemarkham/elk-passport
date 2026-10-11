import { describe, expect, it } from "vitest";
import { readAsk } from "./read";
import { applyAsk, daySentence, windowSentence } from "./apply";
import { readSession, sessionQuery } from "@/domain/discovery/session";

const today = "2026-10-11";
const read = (said: string) => readAsk(said, { today, verbs: ["Hiking"] });

/**
 * **A question changes what it says and leaves everything else alone** —
 * the doctrine's own example (§2.5), at the size of one sentence.
 */
describe("applying a question to the page", () => {
  it("sets only what the sentence says", () => {
    const next = applyAsk(
      { at: "kelowna", age: 5, company: "child", on: "2026-10-12" },
      read("what can we do with three hours?"),
      { hasOrigin: false },
    );
    expect(next).toEqual({
      ask: "what can we do with three hours?",
      at: "kelowna",
      age: 5,
      company: "child",
      on: "2026-10-12",
      window: "half-day",
    });
  });

  it("replaces a typed search, a kind and an intent", () => {
    const next = applyAsk(
      { query: "farm", kind: "Place", intent: "local", everywhere: true },
      read("something unusual"),
      { hasOrigin: false },
    );
    expect(next.query).toBeUndefined();
    expect(next.kind).toBeUndefined();
    expect(next.intent).toBeUndefined();
    expect(next.everywhere).toBeUndefined();
  });

  it("turns 'nearby' into a radius only where there is somewhere to measure from", () => {
    const ask = read("something unusual nearby");
    expect(applyAsk({}, ask, { hasOrigin: false }).within).toBeUndefined();
    expect(applyAsk({ at: "vernon" }, ask, { hasOrigin: false }).within).toBe(
      15,
    );
    expect(applyAsk({}, ask, { hasOrigin: true }).within).toBe(15);
  });

  it("clears the radius for 'worth the drive'", () => {
    const next = applyAsk(
      { within: 15, at: "vernon" },
      read("what is worth driving an hour for?"),
      { hasOrigin: false },
    );
    expect(next.within).toBeUndefined();
    expect(next.at).toBe("vernon");
  });

  it("drops a child's age when the company is not a child", () => {
    const next = applyAsk(
      { company: "child", age: 6 },
      read("an evening with friends"),
      { hasOrigin: false },
    );
    expect(next.company).toBe("group");
    expect(next.age).toBeUndefined();
  });

  it("survives the URL round trip", () => {
    const next = applyAsk({}, read("Where can I take my kid this afternoon?"), {
      hasOrigin: false,
    });
    const back = readSession(new URLSearchParams(sessionQuery(next)));
    expect(back).toEqual(next);
    expect(sessionQuery(next)).toContain("ask=");
  });
});

describe("the sentence handed to Go have a day", () => {
  it("is the person's own, except where /go would misread it", () => {
    expect(daySentence(read("three hours with my kid"))).toBe(
      "three hours with my kid",
    );
    // "an hour" here is a distance, not the day.
    expect(daySentence(read("what is worth driving an hour for?"))).toBe(
      "A whole day out, worth the drive",
    );
  });

  it("comes from the row when nobody asked a question", () => {
    expect(windowSentence(undefined)).toBe("Half a day");
    expect(windowSentence("all-day")).toBe("A whole day");
  });
});
