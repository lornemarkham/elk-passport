import { describe, expect, it } from "vitest";
import { candidatesFor, readFlight, readFlightDate } from "./flight";

describe("reading a typed flight", () => {
  it.each([
    ["AC123", "AC123", "ACA"],
    ["ac 0123", "AC123", "ACA"],
    ["AC-123", "AC123", "ACA"],
    ["ACA123", "ACA123", "ACA"],
    ["Air Canada 123", "AC123", "ACA"],
    ["westjet 133", "WS133", "WJA"],
    ["F8 813", "F8813", "FLE"],
    ["Aeromexico 690", "AM690", "AMX"],
  ])("%s → %s (%s)", (typed, display, icao) => {
    const f = readFlight(typed);
    expect(f?.display).toBe(display);
    expect(f?.icao).toBe(icao);
  });

  it("keeps an airline it doesn't know, but can't make it a callsign", () => {
    const f = readFlight("ZZ 77");
    expect(f).toMatchObject({ display: "ZZ77", iata: "ZZ", icao: null });
    expect(candidatesFor(f!)).toEqual([]);
  });

  it("takes an unknown three-letter code as ICAO, which is the callsign", () => {
    expect(candidatesFor(readFlight("XYZ12")!)[0]?.callsign).toBe("XYZ12");
  });

  it.each(["", "123", "AC", "AC0", "12345", "Air Nowhere 12", "AC 12345"])(
    "rejects %j",
    (typed) => expect(readFlight(typed)).toBeNull(),
  );
});

describe("callsigns worth searching", () => {
  it("only the airline's own for a mainline number", () => {
    expect(candidatesFor(readFlight("AC855")!)).toEqual([
      { callsign: "ACA855", kind: "direct", operator: "Air Canada" },
      { callsign: "ROU855", kind: "operator", operator: "Air Canada Rouge" },
    ]);
    expect(candidatesFor(readFlight("WS133")!).map((c) => c.callsign)).toEqual([
      "WJA133",
    ]);
  });

  it("adds the regional operators in their usual number ranges", () => {
    expect(candidatesFor(readFlight("AC8123")!).map((c) => c.callsign)).toEqual(
      ["ACA8123", "JZA8123"],
    );
    expect(candidatesFor(readFlight("AS2192")!).map((c) => c.callsign)).toEqual(
      ["ASA2192", "QXE2192"],
    );
  });

  it("never searches more than four, because each is a call", () => {
    expect(candidatesFor(readFlight("UA5000")!).length).toBeLessThanOrEqual(4);
  });
});

describe("dates", () => {
  it("accepts real calendar dates only", () => {
    expect(readFlightDate("2026-10-22")).toBe("2026-10-22");
    expect(readFlightDate("2026-02-30")).toBeNull();
    expect(readFlightDate("22/10/2026")).toBeNull();
  });
});
