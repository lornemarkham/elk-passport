import { describe, expect, it } from "vitest";
import { readRoute, readSnapshot, type AdsbSnapshot } from "./adsb";
import { boardFor, type ArrivalRecord } from "./board";
import { candidatesFor, readFlight } from "./flight";
import { decide, type Airport, type FlightClaim } from "./matching";
import {
  afterFollow,
  afterSearch,
  NOT_STARTED,
  plan,
  type Tracking,
} from "./tracking";

const fixture = (name: string): unknown =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require(`./__fixtures__/${name}.json`);

const YVR: Airport = {
  iata: "YVR",
  icao: "CYVR",
  lat: 49.1939,
  lon: -123.184,
  city: "Vancouver",
  name: "Vancouver International Airport",
};
const ORD: Airport = {
  iata: "ORD",
  icao: "KORD",
  lat: 41.9786,
  lon: -87.9048,
  city: "Chicago",
  name: "O'Hare",
};

const UA1580: FlightClaim = {
  ident: readFlight("UA1580")!,
  date: "2026-10-11",
  departure: ORD,
  arrival: YVR,
};

/** UAL1580, identified from the real 05:27 UTC recording. */
function identified(): Tracking {
  const at = new Date("2026-10-12T05:27:40Z");
  const searches = candidatesFor(UA1580.ident).map((candidate) => ({
    candidate,
    snapshot: readSnapshot(fixture(`callsign-${candidate.callsign}`)),
    route: readRoute(fixture(`route-${candidate.callsign}`)),
  }));
  return afterSearch(NOT_STARTED, decide(UA1580, searches, at), at);
}

/** Just after the recording, while the identified position is current. */
const AT = new Date("2026-10-12T05:28:00Z");

const hex = (name: string): AdsbSnapshot => readSnapshot(fixture(name));

describe("following an identified aircraft", () => {
  it("starts airborne at the position it was identified at, and nowhere else", () => {
    const t = identified();
    expect(t.phase).toBe("airborne");
    expect(t.match?.hex).toBe("a3ef1b");
    expect(t.last).toMatchObject({ lat: 49.284482, lon: -123.08034 });
    expect(t.trail).toHaveLength(1);
  });

  it("adds each new real position to the trail (recorded: 275 ft over the runway)", () => {
    const t = afterFollow(
      identified(),
      hex("hex-a3ef1b-short-final"),
      YVR,
      new Date("2026-10-12T05:36:30Z"),
    );
    expect(t.phase).toBe("airborne");
    expect(t.last?.altitudeFt).toBe(275);
    expect(t.trail).toHaveLength(2);
  });

  it("calls it landed — inferred, and typed so — when the signal ends on short final", () => {
    const final = afterFollow(
      identified(),
      hex("hex-a3ef1b-short-final"),
      YVR,
      new Date("2026-10-12T05:36:30Z"),
    );
    const gone = afterFollow(
      final,
      hex("hex-a3ef1b-after-landing"),
      YVR,
      new Date("2026-10-12T05:36:55Z"),
    );
    expect(gone).toMatchObject({ phase: "landed", landedBasis: "inferred" });
    // The last position is still the last one heard, not a runway we drew.
    expect(gone.last).toEqual(final.last);
  });

  it("keeps the last known position, labelled lost, when the signal ends anywhere else", () => {
    // Recorded: WJA133 vanished after a last report at 2,700 ft, 18 km out.
    const t = identified();
    const lost = afterFollow(
      { ...t, last: { ...t.last!, altitudeFt: 7400 } },
      hex("hex-c088fb-after-landing"),
      YVR,
      new Date("2026-10-12T05:37:00Z"),
    );
    expect(lost.phase).toBe("lost");
    expect(lost.lostBecause).toMatch(/Out of range/);
    expect(lost.last?.lat).toBe(49.284482);
  });

  it("changes nothing when the request itself failed", () => {
    const t = identified();
    expect(afterFollow(t, null, YVR, new Date("2026-10-12T05:30:00Z"))).toBe(t);
  });

  it("lets go when the airframe starts broadcasting a different flight", () => {
    const t = identified();
    const next = hex("hex-a3ef1b-short-final");
    const renamed = {
      ...next,
      aircraft: next.aircraft.map((a) => ({
        ...a,
        callsign: "UAL2210",
        altitudeFt: 9000,
      })),
    };
    const out = afterFollow(t, renamed, YVR, new Date("2026-10-12T05:40:00Z"));
    expect(out.phase).toBe("lost");
    expect(out.lostBecause).toMatch(/UAL2210/);
  });

  it("calls it landed on a ground report at the airport", () => {
    const next = hex("hex-a3ef1b-short-final");
    const ground = {
      ...next,
      aircraft: next.aircraft.map((a) => ({
        ...a,
        onGround: true,
        positionAt: next.at,
      })),
    };
    expect(
      afterFollow(identified(), ground, YVR, new Date("2026-10-12T05:37:00Z")),
    ).toMatchObject({ phase: "landed", landedBasis: "ground" });
  });
});

describe("how often ADS-B is asked", () => {
  it("asks nothing before the flight's date", () => {
    const later = { ...UA1580, date: "2026-10-22" };
    expect(plan(NOT_STARTED, later, new Date("2026-10-12T06:00:00Z"))).toEqual({
      tracking: NOT_STARTED,
      action: "none",
    });
  });

  it("searches once a minute, and follows an identified aircraft every 10 s", () => {
    const now = new Date("2026-10-12T05:27:40Z");
    expect(plan(NOT_STARTED, UA1580, now).action).toBe("search");
    const searched = {
      ...NOT_STARTED,
      phase: "searching" as const,
      checkedAt: now.toISOString(),
    };
    expect(
      plan(searched, UA1580, new Date(now.getTime() + 30_000)).action,
    ).toBe("none");
    expect(
      plan(searched, UA1580, new Date(now.getTime() + 61_000)).action,
    ).toBe("search");
    const t = identified();
    expect(plan(t, UA1580, new Date(now.getTime() + 5_000)).action).toBe(
      "none",
    );
    expect(plan(t, UA1580, new Date(now.getTime() + 11_000)).action).toBe(
      "follow",
    );
  });

  it("follows every 30 s instead of 10 once the aircraft is beyond the shared area query", () => {
    const t = identified();
    const far = { ...t, last: { ...t.last!, lat: 43.6, lon: -79.6 } };
    const at = Date.parse(t.checkedAt!);
    expect(plan(far, UA1580, new Date(at + 11_000)).action).toBe("none");
    expect(plan(far, UA1580, new Date(at + 31_000)).action).toBe("follow");
  });

  it("stops after landing, and gives up when the window closes unmatched", () => {
    const landed = { ...identified(), phase: "landed" as const };
    expect(plan(landed, UA1580, new Date("2026-10-12T05:40:00Z")).action).toBe(
      "none",
    );
    const missed = plan(
      { ...NOT_STARTED, phase: "searching" },
      UA1580,
      new Date("2026-10-14T00:00:00Z"),
    );
    expect(missed.tracking.phase).toBe("missed");
    expect(missed.action).toBe("none");
  });
});

describe("what one member sees of another's flight", () => {
  const record = (memberId: string, shared: boolean): ArrivalRecord => ({
    conferenceId: "c1",
    memberId,
    flight: { ident: UA1580.ident, date: UA1580.date, departure: ORD },
    shared,
    createdAt: "2026-10-12T00:00:00Z",
    updatedAt: "2026-10-12T00:00:00Z",
    tracking: identified(),
  });
  const ana = { memberId: "ana", displayName: "Ana", seen: true };
  const named = new Map([["ben", "Ben"]]);

  it("shows a shared flight from a member who chose to be seen, by name", () => {
    const b = boardFor([record("ben", true)], YVR, ana, named, AT);
    expect(b.rows[0]).toMatchObject({
      name: "Ben",
      flight: "UA1580",
      phase: "airborne",
      isYou: false,
      shared: null,
    });
    expect(b.counts).toMatchObject({ airborne: 1, total: 1 });
  });

  it("shows nothing at all of a flight that wasn't shared — not a plane, not a count", () => {
    const b = boardFor([record("ben", false)], YVR, ana, named, AT);
    expect(b.rows).toEqual([]);
    expect(b.counts.total).toBe(0);
  });

  it("shows nothing of a shared flight whose owner is hidden in the conference", () => {
    const b = boardFor([record("cat", true)], YVR, ana, named, AT);
    expect(b.rows).toEqual([]);
    expect(JSON.stringify(b)).not.toContain("cat");
  });

  it("always shows you your own, and counts it only if you shared it", () => {
    const mine = boardFor([record("ana", false)], YVR, ana, named, AT);
    expect(mine.rows[0]).toMatchObject({ isYou: true, shared: false });
    expect(mine.counts.total).toBe(0);
    const hidden = boardFor(
      [record("ana", true)],
      YVR,
      { ...ana, seen: false },
      named,
      AT,
    );
    expect(hidden.counts.total).toBe(0);
  });

  it("never calls a position live once it's more than two minutes old", () => {
    const t = identified();
    const at = Date.parse(t.last!.at);
    const fresh = boardFor(
      [record("ben", true)],
      YVR,
      ana,
      named,
      new Date(at + 60_000),
    );
    expect(fresh.rows[0]?.phase).toBe("airborne");
    const old = boardFor(
      [record("ben", true)],
      YVR,
      ana,
      named,
      new Date(at + 150_000),
    );
    expect(old.rows[0]).toMatchObject({
      phase: "lost",
      lostBecause: /No fresh/,
    });
    expect(old.rows[0]?.position).toEqual(t.last);
  });

  it("draws no position for a flight that was never identified", () => {
    const waiting = { ...record("ben", true), tracking: NOT_STARTED };
    const b = boardFor([waiting], YVR, ana, named, AT);
    expect(b.rows[0]?.position).toBeNull();
    expect(b.rows[0]?.trail).toEqual([]);
  });
});
