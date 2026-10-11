import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { anAdventure } from "../adventure/fixtures";
import {
  printQuery,
  printRequestFor,
  readPrintQuery,
} from "../adventure/print";
import {
  CORE_DAY_QUERY_KEYS,
  DAY_QUERY,
  DAY_QUERY_KEYS,
  dayQueryLosses,
  keepDayQuery,
  readDayQuery,
  writeDayQuery,
} from "./dayQuery";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("the day query, as main writes and reads it", () => {
  // Integration (M178): one codec. These are tripwires against a surface
  // growing its own list of keys again.
  it("is written by /go through the codec, not by hand", () => {
    const writer = source("src/components/go/GoHaveADay.tsx");
    expect(writer).toContain("writeDayQuery(dayQueryFor(");
    // (The age buttons build a `/go` reload link, which is not a day query.)
    expect(writer).not.toMatch(/params\.set\("(stops|mins|rain|by|b)"/);
  });

  it("is read by /go/print and Go Offline through one resolver", () => {
    expect(source("src/app/go/print/page.tsx")).toContain("resolvePrintDay(");
    expect(source("src/lib/detox/resolve.ts")).toContain("resolvePrintDay(");
    expect(source("src/lib/go/printDay.ts")).toContain("readDayQuery(");
  });

  it("is what this lane's Adventure codec writes and reads back", () => {
    const query = new URLSearchParams(
      printQuery(printRequestFor(anAdventure())),
    );
    for (const key of query.keys()) expect(CORE_DAY_QUERY_KEYS).toContain(key);
    expect(readPrintQuery(query).stopIds).toEqual(["polson-park", "kal-beach"]);
  });
});

describe("what a six-key reader loses from an extended day", () => {
  // As lane/daybuilder (dcdabbf) + lane/maps (d62ba73) together would write it.
  const extended = new URLSearchParams(
    "stops=a,b&say=four+hours&b=%7B%22homeBy%22%3A1260%7D&hours=4&at=vernon&mins=a:90&rain=b~c&by=walking",
  );

  it("drops the carried brief, set minutes, rain plans and the mode", () => {
    // What lane/detox's and lane/boards' six-key lists did before integration.
    expect(
      dayQueryLosses(extended, CORE_DAY_QUERY_KEYS).map((k) => k.key),
    ).toEqual(["b", "mins", "rain", "by"]);
  });

  it("drops nothing for a reader that keeps the whole registry", () => {
    expect(
      dayQueryLosses(
        extended,
        DAY_QUERY.map((k) => k.key),
      ),
    ).toEqual([]);
  });

  it("is also what this lane's readPrintQuery drops today (INT-6)", () => {
    const back = new URLSearchParams(printQuery(readPrintQuery(extended)));
    expect(
      dayQueryLosses(extended, [...back.keys()]).map((k) => k.key),
    ).toEqual(["b", "mins", "rain", "by"]);
  });
});

describe("the codec", () => {
  const extended =
    "stops=a%2Cb&say=four+hours&hours=4&age=6&at=vernon&on=2026-10-12&b=%7B%22homeBy%22%3A1260%7D&mins=a%3A90&rain=b%7Ec&by=walking";

  it("reads and writes every registered key, losing nothing", () => {
    const read = readDayQuery(extended);
    expect(read).toEqual({
      stops: ["a", "b"],
      say: "four hours",
      hours: 4,
      age: 6,
      at: "vernon",
      on: "2026-10-12",
      b: '{"homeBy":1260}',
      mins: { a: 90 },
      rain: { b: "c" },
      by: "walking",
    });
    expect(writeDayQuery(read)).toBe(extended);
    expect(
      dayQueryLosses(new URLSearchParams(extended), [
        ...new URLSearchParams(writeDayQuery(read)).keys(),
      ]),
    ).toEqual([]);
  });

  it("keeps the stops in the order given", () => {
    expect(readDayQuery("stops=c,a,b").stops).toEqual(["c", "a", "b"]);
  });

  it("drops malformed parts rather than guessing", () => {
    const read = readDayQuery(
      "stops=a&hours=-1&age=40&on=tomorrow&mins=a:0,z:30&rain=z~c",
    );
    expect(read).toEqual({ stops: ["a"], say: "", mins: {}, rain: {} });
  });

  it("keeps every registered key on a hand-off, and nothing else", () => {
    expect(keepDayQuery(`${extended}&utm=x`)).toBe(extended);
    expect(DAY_QUERY_KEYS).toEqual(DAY_QUERY.map((k) => k.key));
  });

  it("writes driving as no key, as /go always has", () => {
    expect(writeDayQuery({ ...readDayQuery("stops=a"), by: "driving" })).toBe(
      "stops=a&say=",
    );
  });
});
