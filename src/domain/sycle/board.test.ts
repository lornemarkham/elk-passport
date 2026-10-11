import { describe, expect, it } from "vitest";
import {
  boardFor,
  flightKey,
  interestFor,
  ownRecord,
  readDisplayName,
  type Participant,
} from "./board";
import { flight } from "./flight.test";

const NOW = new Date("2026-10-20T13:00:00Z");

const person = (id: string, over: Partial<Participant> = {}): Participant => ({
  id,
  boardId: `b-${id}`,
  displayName: id,
  visibility: "named",
  flight: { flightNumber: "AC855", date: "2026-10-20" },
  adventures: [],
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
  ...over,
});

const flights = new Map([
  [flightKey("AC855", "2026-10-20"), flight({ status: "departed" })],
]);

describe("what one colleague can see about another", () => {
  it("never includes someone who chose 'just me' — not as a row, not in a count", () => {
    const board = boardFor(
      [person("ana", { visibility: "off" }), person("ben")],
      flights,
      "ben",
      NOW,
    );
    expect(board.arrivals.map((a) => a.name)).toEqual(["ben"]);
    expect(board.counts.onTheWay).toBe(1);
  });

  it("shows you your own row even when it is private, without counting it", () => {
    const board = boardFor(
      [person("ana", { visibility: "off" })],
      flights,
      "ana",
      NOW,
    );
    expect(board.arrivals).toHaveLength(1);
    expect(board.arrivals[0]!.isYou).toBe(true);
    expect(board.counts.onTheWay).toBe(0);
  });

  it("hides the name of anonymous people, not their city", () => {
    const [row] = boardFor(
      [person("ana", { visibility: "anonymous" })],
      flights,
      "ben",
      NOW,
    ).arrivals;
    expect(row!.name).toBeNull();
    expect(row!.from.city).toBe("London");
  });

  it("never sends anyone else's flight number", () => {
    const board = boardFor([person("ana"), person("ben")], flights, "ben", NOW);
    const json = JSON.stringify(board.arrivals.filter((a) => !a.isYou));
    expect(json).not.toContain("AC855");
    expect(board.arrivals.find((a) => a.isYou)!.flightNumber).toBe("AC855");
  });

  it("never sends the secret participant id", () => {
    const json = JSON.stringify(
      boardFor(
        [person("secret-id-ana", { boardId: "pub-1", displayName: "Ana" })],
        flights,
        null,
        NOW,
      ),
    );
    expect(json).not.toContain("secret-id-ana");
    expect(JSON.stringify(ownRecord(person("secret-id-ana")))).not.toContain(
      '"id"',
    );
  });

  it("does not draw a reported position that is stale or not airborne", () => {
    const stale = new Map([
      [
        flightKey("AC855", "2026-10-20"),
        flight({
          status: "departed",
          position: {
            latitude: 60,
            longitude: -40,
            altitudeFt: 37000,
            reportedAt: "2026-10-20T12:00:00Z",
          },
        }),
      ],
    ]);
    expect(
      boardFor([person("ana")], stale, null, NOW).arrivals[0]!.reported,
    ).toBeNull();
  });
});

describe("shared adventures", () => {
  it("names only the named, counts everyone", () => {
    const interest = interestFor(
      [
        person("ana", { adventures: ["x"] }),
        person("ben", { adventures: ["x"], visibility: "anonymous" }),
        person("cy", { adventures: ["x"], visibility: "off" }),
      ],
      "cy",
    ).get("x")!;
    expect(interest.count).toBe(3);
    expect(interest.names).toEqual(["ana", "you"]);
    expect(interest.youreIn).toBe(true);
  });
});

describe("display names", () => {
  it("is short, single-line and free of markup", () => {
    expect(readDisplayName("  <b>Priya</b>\n ")).toBe("bPriya/b");
    expect(readDisplayName("x".repeat(80))).toHaveLength(40);
    expect(readDisplayName("   ")).toBeNull();
  });
});
