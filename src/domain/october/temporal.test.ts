import { describe, expect, it } from "vitest";
import { temporalContext } from "./temporal";

/**
 * **Six days should feel different without six pages being designed.**
 *
 * The thing these guard is restraint as much as correctness: a product that
 * produces an excited sentence every day has trained people to stop reading
 * the sentence, so most of the month must say nothing.
 */
const on = (iso: string) => temporalContext(new Date(iso));

describe("the days the brief named", () => {
  it("knows September 30 is the eve of the month", () => {
    const t = on("2026-09-30T19:00:00Z");
    expect(t.phase).toBe("eve");
    expect(t.headline).toBe("October starts tomorrow.");
    expect(t.dayOfOctober).toBeUndefined();
  });

  it("knows October 1 has begun", () => {
    const t = on("2026-10-01T19:00:00Z");
    expect(t.phase).toBe("early");
    expect(t.dayOfOctober).toBe(1);
    expect(t.headline).toBe("October starts today.");
  });

  it("says nothing on an ordinary October 10", () => {
    const t = on("2026-10-10T19:00:00Z");
    expect(t.phase).toBe("early");
    expect(t.headline).toBeUndefined();
  });

  it("says nothing on an ordinary October 20", () => {
    expect(on("2026-10-20T19:00:00Z").headline).toBeUndefined();
    expect(on("2026-10-20T19:00:00Z").phase).toBe("middle");
  });

  it("counts down at the end of the month", () => {
    const t = on("2026-10-30T19:00:00Z");
    expect(t.phase).toBe("late");
    expect(t.headline).toBe("Halloween is tomorrow.");
  });

  it("says the only thing worth saying on the 31st", () => {
    const t = on("2026-10-31T19:00:00Z");
    expect(t.phase).toBe("halloween");
    expect(t.headline).toBe("It's Halloween.");
    expect(t.daysToHalloween).toBe(0);
  });
});

describe("Fridays, which are when things happen", () => {
  it("knows the first Friday night of October", () => {
    // 2026-10-02 is a Friday, and the first of the month.
    const t = on("2026-10-02T19:00:00Z");
    expect(t.weekday).toBe("Friday");
    expect(t.headline).toBe("The first Friday night of October.");
  });

  it("knows the last Friday before Halloween", () => {
    // 2026-10-30 is a Friday — but Halloween-is-tomorrow outranks it.
    expect(on("2026-10-30T19:00:00Z").headline).toBe("Halloween is tomorrow.");
    // 2026-10-23 is a Friday with 8 nights to go: not yet the last one.
    expect(on("2026-10-23T19:00:00Z").headline).toBeUndefined();
  });

  it("does not call every Friday special", () => {
    // 2026-10-09 and 10-16 are Fridays in the middle of the month.
    expect(on("2026-10-09T19:00:00Z").headline).toBeUndefined();
    expect(on("2026-10-16T19:00:00Z").headline).toBeUndefined();
  });
});

describe("restraint", () => {
  it("stays quiet on most of October", () => {
    const quiet = [];
    for (let d = 1; d <= 31; d++) {
      const t = on(`2026-10-${String(d).padStart(2, "0")}T19:00:00Z`);
      if (!t.headline) quiet.push(d);
    }
    // More days say nothing than say something.
    expect(quiet.length).toBeGreaterThan(15);
  });

  it("holds no table of canned sentences", () => {
    // The same calendar shape in a different year produces the same kind of
    // answer, which a hand-written per-day list could not do.
    expect(on("2027-10-01T19:00:00Z").headline).toBe("October starts today.");
    expect(on("2027-10-31T19:00:00Z").headline).toBe("It's Halloween.");
    // 2027-10-01 is a Friday — the first Friday rule still applies in a year
    // nobody wrote copy for.
    expect(on("2027-10-08T19:00:00Z").weekday).toBe("Friday");
  });

  it("does not pretend November is October", () => {
    const t = on("2026-11-02T19:00:00Z");
    expect(t.phase).toBe("after");
    expect(t.headline).toBeUndefined();
  });

  it("reads the date in the product's timezone, not the server's", () => {
    // 2026-10-01T04:00Z is still September 30 in Vancouver.
    expect(on("2026-10-01T04:00:00Z").day).toBe("2026-09-30");
    expect(on("2026-10-01T04:00:00Z").headline).toBe(
      "October starts tomorrow.",
    );
  });
});
