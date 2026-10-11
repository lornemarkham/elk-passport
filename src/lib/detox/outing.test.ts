import { describe, expect, it } from "vitest";
import { defaultPact } from "./pact";
import {
  awayFor,
  comeBack,
  leave,
  newOuting,
  parseOuting,
  postcard,
  withPact,
} from "./outing";

/**
 * **An outing is the pact, the moment the phones went, and what came back.**
 *
 * Pinned: leaving is idempotent, a return only keeps challenges that were
 * actually dealt, free text is capped rather than rejected, storage that is
 * malformed is ignored rather than trusted, and the postcard is warm about
 * every outcome — including the one where nobody did anything.
 */
const T0 = new Date("2026-10-11T16:00:00Z");
const after = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);
const pact = defaultPact(1);
const [a, b, c] = pact.challenges;

describe("leave", () => {
  it("records when the phones went away, once", () => {
    const out = leave(newOuting(pact), T0);
    expect(out.leftAt).toBe(T0.toISOString());
    expect(leave(out, after(30)).leftAt).toBe(T0.toISOString());
  });
});

describe("withPact", () => {
  it("replaces the pact and leaves the rest alone", () => {
    const out = leave(newOuting(pact), T0);
    const changed = withPact(out, { ...pact, stake: "song" });
    expect(changed.pact.stake).toBe("song");
    expect(changed.leftAt).toBe(out.leftAt);
  });
});

describe("comeBack", () => {
  it("keeps only challenges that were dealt, once each", () => {
    const back = comeBack(leave(newOuting(pact), T0), after(90), {
      pulledOff: [a!, a!, "not-in-the-pact"],
      cracked: "  Sam ",
      unplanned: " a dog called Biscuit ",
    }).back!;
    expect(back.pulledOff).toEqual([a]);
    expect(back.cracked).toBe("Sam");
    expect(back.unplanned).toBe("a dog called Biscuit");
  });

  it("caps a long story instead of refusing it", () => {
    const back = comeBack(newOuting(pact), T0, {
      pulledOff: [],
      cracked: "x".repeat(200),
      unplanned: "y".repeat(1000),
    }).back!;
    expect(back.cracked).toHaveLength(60);
    expect(back.unplanned).toHaveLength(280);
    expect(parseOuting(comeBack(newOuting(pact), T0, back))).toBeDefined();
  });
});

describe("parseOuting", () => {
  it("round-trips through JSON", () => {
    const out = comeBack(leave(newOuting(pact), T0), after(60), {
      pulledOff: [b!],
      cracked: "",
      unplanned: "pie",
    });
    expect(parseOuting(JSON.parse(JSON.stringify(out)))).toEqual(out);
  });

  it("ignores anything that is not an outing", () => {
    expect(parseOuting(undefined)).toBeUndefined();
    expect(parseOuting({ version: 2, pact })).toBeUndefined();
    expect(parseOuting({ version: 1, pact: { phone: "" } })).toBeUndefined();
    expect(parseOuting("hello")).toBeUndefined();
  });
});

describe("awayFor", () => {
  const out = leave(newOuting(pact), T0);

  it("says nothing before anybody left", () => {
    expect(awayFor(newOuting(pact), T0)).toBeUndefined();
  });

  it("says it the way a person would", () => {
    expect(awayFor(out, after(0))).toBe("less than a minute");
    expect(awayFor(out, after(1))).toBe("1 minute");
    expect(awayFor(out, after(60))).toBe("1 hour");
    expect(awayFor(out, after(252))).toBe("4 hours and 12 minutes");
  });

  it("measures to the return once there is one, not to now", () => {
    const back = comeBack(out, after(125), {
      pulledOff: [],
      cracked: "",
      unplanned: "",
    });
    expect(awayFor(back, after(9999))).toBe("2 hours and 5 minutes");
  });

  it("stops pretending to be precise past a day, and never goes negative", () => {
    expect(awayFor(out, after(60 * 71))).toBe("more than a day");
    expect(awayFor(out, after(-5))).toBeUndefined();
  });
});

describe("postcard", () => {
  const report = (pulledOff: string[], cracked = "", unplanned = "") =>
    comeBack(leave(newOuting(pact), T0), after(240), {
      pulledOff,
      cracked,
      unplanned,
    });

  it("celebrates a clean sweep", () => {
    const card = postcard(report([a!, b!, c!]), after(300));
    expect(card.headline).toBe("Three for three. Show-offs.");
    expect(card.lines[0]).toBe("Phones away for 4 hours.");
    expect(card.lines.filter((l) => l.startsWith("✓"))).toHaveLength(3);
  });

  it("is warm about zero", () => {
    expect(postcard(report([]), T0).headline).toBe(
      "No challenges, and a whole day anyway.",
    );
  });

  it("counts a partial hand", () => {
    expect(postcard(report([b!]), T0).headline).toBe(
      "One out of three. Respectable.",
    );
  });

  it("names who cracked, or teases that nobody did", () => {
    expect(postcard(report([], "Sam"), T0).lines).toContain(
      "Sam cracked first. A deal is a deal.",
    );
    expect(postcard(report([]), T0).lines).toContain(
      "Nobody cracked. Somebody check the phones still work.",
    );
  });

  it("keeps the thing nobody planned, in their words", () => {
    expect(postcard(report([], "", "the pie stand"), T0).lines).toContain(
      "Not on the paper: the pie stand",
    );
  });

  it("works for somebody who never made a pact", () => {
    const bare = comeBack(newOuting({ ...pact, challenges: [] }), T0, {
      pulledOff: [],
      cracked: "",
      unplanned: "",
    });
    expect(postcard(bare, T0).headline).toBe(
      "You went. That was the whole idea.",
    );
  });
});
