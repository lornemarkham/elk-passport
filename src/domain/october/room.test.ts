import { describe, expect, it } from "vitest";
import {
  checkCode,
  CLEAR_WITHIN,
  CODE,
  obviousGuess,
  receive,
  STATIONS,
  verdictFor,
  type Wheels,
} from "./room";

describe("the code", () => {
  it("opens the door, and only the code does", () => {
    expect(checkCode([...CODE] as unknown as Wheels).open).toBe(true);
    expect(checkCode([4, 7, 3]).open).toBe(false);
    expect(checkCode([7, 7, 7]).open).toBe(false);
    expect(checkCode([4, 7, 3]).right).toEqual([true, true, false]);
  });

  it("is the answer to each true station, and never the lying one", () => {
    const truthful = STATIONS.filter((s) => s.wheel !== null);
    expect(truthful.map((s) => s.wheel)).toEqual([0, 1, 2]);
    const liar = STATIONS.find((s) => s.id === "october")!;
    expect(liar.wheel).toBeNull();
    expect(liar.text).toMatch(/seven/i);
  });
});

describe("the radio", () => {
  it("is noise between stations and a clear voice on one", () => {
    expect(receive(92.5).station).toBeNull();
    expect(receive(92.5).static).toBe(1);
    for (const s of STATIONS) {
      const r = receive(s.at);
      expect(r.station).toBe(s);
      expect(r.clarity).toBe(1);
      expect(r.static).toBeLessThan(0.1);
    }
  });

  it("gets clearer as you approach, monotonically", () => {
    const s = STATIONS[1]!;
    let last = -1;
    for (let d = 1.4; d >= 0; d -= 0.1) {
      const c = receive(s.at - d).clarity;
      expect(c).toBeGreaterThanOrEqual(last);
      last = c;
    }
    expect(receive(s.at + CLEAR_WITHIN + 0.2).clarity).toBeLessThan(1);
  });

  it("keeps the stations further apart than the clear window", () => {
    const at = STATIONS.map((s) => s.at).sort((a, b) => a - b);
    for (let i = 1; i < at.length; i += 1) {
      expect(at[i]! - at[i - 1]!).toBeGreaterThan(CLEAR_WITHIN * 4);
    }
  });
});

describe("October's opinion of a wrong code", () => {
  it("is dry about the obvious guesses", () => {
    expect(obviousGuess([7, 7, 7])).toBe("liar");
    expect(obviousGuess([3, 1, 0])).toBe("date");
    expect(verdictFor([7, 7, 7], 0).line).toMatch(/believes/);
  });

  it("starts to help, and eventually shows which wheels are right", () => {
    expect(verdictFor([1, 2, 3], 0).reveal).toBe(false);
    expect(verdictFor([4, 2, 3], 2).line).toMatch(/One of them/);
    expect(verdictFor([1, 2, 3], 4).reveal).toBe(true);
  });
});
