import { describe, expect, it } from "vitest";
import {
  printLosses,
  printQuery,
  printRequestFor,
  readPrintQuery,
} from "./print";
import { anAdventure, subjectMoment } from "./fixtures";

describe("print hand-off", () => {
  const adventure = anAdventure({
    said: "four hours with a five-year-old near Vernon",
    constraints: {
      time: { hours: 4, on: "2026-10-17" },
      party: { companions: [{ role: "child", age: 5 }], needs: [] },
      origin: { name: "Vernon, BC", townId: "vernon" },
    },
  });

  it("writes the query GoHaveADay's printQuery writes today", () => {
    // The literal `printQuery(brief, ids)` output for this day at 016854a.
    expect(printQuery(printRequestFor(adventure))).toBe(
      "stops=polson-park%2Ckal-beach&say=four+hours+with+a+five-year-old+near+Vernon&hours=4&age=5&at=vernon&on=2026-10-17",
    );
  });

  it("round-trips through the URL", () => {
    const request = printRequestFor(adventure);
    expect(readPrintQuery(new URLSearchParams(printQuery(request)))).toEqual(
      request,
    );
    // Next's searchParams shape reads the same.
    expect(
      readPrintQuery(
        Object.fromEntries(new URLSearchParams(printQuery(request))),
      ),
    ).toEqual(request);
  });

  it("drops what is malformed rather than coercing it", () => {
    expect(
      readPrintQuery({
        stops: "a,,b",
        say: "x",
        hours: "-3",
        age: "40",
        on: "Saturday",
        at: ["vernon", "kelowna"],
      }),
    ).toEqual({ stopIds: ["a", "b"], said: "x" });
    expect(readPrintQuery({})).toEqual({ stopIds: [], said: "" });
  });

  it("names what the URL cannot carry", () => {
    const losses = printLosses(
      anAdventure({
        constraints: {
          time: { startAt: "08:40", homeBy: "12:50" },
          budget: { maxDollars: 100 },
          party: {
            companions: [
              { role: "child", age: 5 },
              { role: "child", age: 9 },
            ],
            needs: [],
          },
          origin: { name: "The cabin" },
        },
        moments: [
          subjectMoment("polson-park"),
          { kind: "free", id: "lunch", label: "Lunch", minutes: 45, notes: [] },
        ],
      }),
    );
    expect(losses).toHaveLength(5);
    expect(losses[0]).toContain("Lunch");
    expect(printLosses(adventure)).toEqual([]);
  });

  it("prints only Atlas ids", () => {
    const request = printRequestFor(
      anAdventure({
        moments: [
          { kind: "free", id: "lunch", label: "Lunch", minutes: 45, notes: [] },
          subjectMoment("kal-beach"),
        ],
      }),
    );
    expect(request.stopIds).toEqual(["kal-beach"]);
  });
});
