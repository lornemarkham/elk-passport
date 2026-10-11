import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { anAdventure } from "../adventure/fixtures";
import {
  printQuery,
  printRequestFor,
  readPrintQuery,
} from "../adventure/print";
import { CORE_DAY_QUERY_KEYS, DAY_QUERY, dayQueryLosses } from "./dayQuery";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("the day query, as main writes and reads it", () => {
  it("has the core keys GoHaveADay writes", () => {
    const writer = source("src/components/go/GoHaveADay.tsx");
    const written = [...writer.matchAll(/params\.set\("(\w+)"/g)].map(
      (m) => m[1],
    );
    for (const key of CORE_DAY_QUERY_KEYS) expect(written, key).toContain(key);
  });

  it("has the core keys /go/print reads, and no others", () => {
    const reader = source("src/app/go/print/page.tsx");
    const read = new Set(
      [...reader.matchAll(/query\.(\w+)/g)].map((m) => m[1]),
    );
    // Fires when a lane's keys reach main: move that key's `from` to "main".
    expect(
      [...read].sort(),
      "/go/print reads a key DAY_QUERY does not list as main's",
    ).toEqual([...CORE_DAY_QUERY_KEYS].sort());
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
    // lane/detox DAY_QUERY_KEYS and lane/boards DAY_KEYS are both main's six.
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
