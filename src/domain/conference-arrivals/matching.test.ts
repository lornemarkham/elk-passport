import { describe, expect, it } from "vitest";
import { readRoute, readSnapshot, type AdsbSnapshot } from "./adsb";
import { candidatesFor, readFlight, type FlightIdent } from "./flight";
import {
  decide,
  type Airport,
  type FlightClaim,
  type Search,
} from "./matching";

/*
 * Every `callsign-*` and `route-*` fixture is a real ADSB.lol / VRS answer,
 * recorded 2026-10-12 at 05:27 UTC (22:27 in Vancouver, Oct 11) while these
 * aircraft were inbound to YVR. Where a test needs a case the sky didn't
 * offer (an ambiguity, a privacy-listed aircraft), it edits a real payload
 * and says so.
 */
const fixture = (name: string): unknown =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require(`./__fixtures__/${name}.json`);

const RECORDED = new Date("2026-10-12T05:27:40Z");

const airport = (
  iata: string,
  icao: string,
  lat: number,
  lon: number,
  city: string,
): Airport => ({ iata, icao, lat, lon, city, name: `${city} airport` });

const YVR = airport("YVR", "CYVR", 49.1939, -123.184, "Vancouver");
const YYC = airport("YYC", "CYYC", 51.1225, -114.0133, "Calgary");
const YYZ = airport("YYZ", "CYYZ", 43.6772, -79.6306, "Toronto");
const JFK = airport("JFK", "KJFK", 40.6398, -73.7789, "New York");
const ORD = airport("ORD", "KORD", 41.9786, -87.9048, "Chicago");
const IAD = airport("IAD", "KIAD", 38.9445, -77.4558, "Washington");
const SLC = airport("SLC", "KSLC", 40.7884, -111.9778, "Salt Lake City");

function claim(
  typed: string,
  departure: Airport | null,
  date = "2026-10-11",
): FlightClaim {
  return { ident: readFlight(typed)!, date, departure, arrival: YVR };
}

/** Look up every candidate in the recordings, as the tracker would live. */
function searchesFor(
  ident: FlightIdent,
  edit: (cs: string, s: AdsbSnapshot) => AdsbSnapshot = (_, s) => s,
  routes: "recorded" | "none" = "recorded",
): Search[] {
  return candidatesFor(ident).map((candidate) => {
    let body: unknown = { ac: [], now: RECORDED.getTime() };
    let route: unknown = null;
    try {
      body = fixture(`callsign-${candidate.callsign}`);
      route = fixture(`route-${candidate.callsign}`);
    } catch {
      // Not recorded: nothing was broadcasting it.
    }
    return {
      candidate,
      snapshot: edit(candidate.callsign, readSnapshot(body)),
      route: routes === "recorded" ? readRoute(route) : null,
    };
  });
}

describe("identifies a real aircraft only on strong evidence", () => {
  it("WS 133 from Calgary is WestJet's WJA133, on final into YVR", () => {
    const c = claim("WS 133", YYC);
    const d = decide(c, searchesFor(c.ident), RECORDED);
    expect(d.kind).toBe("identified");
    if (d.kind !== "identified") return;
    expect(d.aircraft.hex).toBe("c088fb");
    expect(d.aircraft.registration).toBe("C-GZWS");
    expect(d.evidence.every((e) => e.result === "pass")).toBe(true);
  });

  it("B6 603 from JFK is JetBlue's JBU603, descending over the Fraser Valley", () => {
    const c = claim("b6603", JFK);
    const d = decide(c, searchesFor(c.ident), RECORDED);
    expect(d.kind === "identified" && d.aircraft.hex).toBe("adcd6d");
  });

  it("F8 813 from Calgary is Flair's FLE813, still at cruise over the Rockies", () => {
    const c = claim("F8 813", YYC);
    const d = decide(c, searchesFor(c.ident), RECORDED);
    expect(d.kind === "identified" && d.aircraft.callsign).toBe("FLE813");
    expect(
      d.kind === "identified" &&
        d.evidence.find((e) => e.check === "heading")?.says,
    ).toMatch(/Heading for YVR/);
  });

  it("follows a through flight onto its last leg: UA 1580 Washington → Chicago → Vancouver", () => {
    const fromIad = claim("UA1580", IAD);
    const d = decide(fromIad, searchesFor(fromIad.ident), RECORDED);
    expect(d.kind).toBe("identified");
    if (d.kind !== "identified") return;
    expect(d.leg.from.icao).toBe("KORD");
    expect(d.leg.fromBasis).toBe("route-record");

    const fromOrd = claim("UA1580", ORD);
    const e = decide(fromOrd, searchesFor(fromOrd.ident), RECORDED);
    expect(e.kind === "identified" && e.leg.fromBasis).toBe("stated");
  });

  it("takes the departure from the route record when the person didn't give one", () => {
    const c = claim("WS133", null);
    const d = decide(c, searchesFor(c.ident), RECORDED);
    expect(d.kind === "identified" && d.leg.from.icao).toBe("CYYC");
  });
});

describe("refuses, and says why", () => {
  it("won't put a name on WJA133 when the person said they're flying from Toronto", () => {
    // Right number, right day, right destination — but WS 133 is a Calgary
    // flight. That's a typo somewhere, and the plane is somebody else's.
    const c = claim("WS133", YYZ);
    const d = decide(c, searchesFor(c.ident), RECORDED);
    expect(d).toMatchObject({ kind: "waiting", reason: "weak-evidence" });
    expect(d.kind === "waiting" && d.says).toMatch(/route record/);
  });

  it("needs a departure when there's no route record to supply one", () => {
    const c = claim("WS133", null);
    const d = decide(c, searchesFor(c.ident, undefined, "none"), RECORDED);
    expect(d).toMatchObject({ kind: "waiting", reason: "need-departure" });
  });

  it("matches without a route record when the stated route and the live position agree", () => {
    const c = claim("WS133", YYC);
    const d = decide(c, searchesFor(c.ident, undefined, "none"), RECORDED);
    expect(d.kind).toBe("identified");
  });

  it("says when nothing is broadcasting the callsign (AC 855 was not in range)", () => {
    const c = claim("AC855", null);
    const d = decide(c, searchesFor(c.ident), RECORDED);
    expect(d).toMatchObject({ kind: "waiting", reason: "not-heard" });
    expect(d.kind === "waiting" && d.says).toMatch(/ACA855/);
  });

  it("rules out another day's flight with the same number", () => {
    const later = claim("WS133", YYC, "2026-10-14");
    expect(decide(later, searchesFor(later.ident), RECORDED)).toMatchObject({
      kind: "waiting",
      reason: "too-early",
    });
    const earlier = claim("WS133", YYC, "2026-10-08");
    expect(decide(earlier, searchesFor(earlier.ident), RECORDED)).toMatchObject(
      { kind: "waiting", reason: "too-late" },
    );
  });

  it("won't guess between two aircraft that both fit (edited: WJA133 duplicated)", () => {
    const c = claim("WS133", YYC);
    const twins = searchesFor(c.ident, (_, s) => ({
      ...s,
      aircraft: [...s.aircraft, { ...s.aircraft[0]!, hex: "c0ffee" }],
    }));
    expect(decide(c, twins, RECORDED)).toMatchObject({
      kind: "waiting",
      reason: "ambiguous",
    });
  });

  it("won't use a stale position (edited: WJA133's position made 3 min old)", () => {
    const c = claim("WS133", YYC);
    const old = searchesFor(c.ident, (_, s) => ({
      ...s,
      aircraft: s.aircraft.map((a) => ({
        ...a,
        positionAt: new Date(Date.parse(s.at) - 180_000).toISOString(),
      })),
    }));
    expect(decide(c, old, RECORDED)).toMatchObject({
      kind: "waiting",
      reason: "weak-evidence",
    });
  });

  it("never names an aircraft in a privacy programme (edited: WJA133 flagged LADD)", () => {
    const c = claim("WS133", YYC);
    const ladd = searchesFor(c.ident, (_, s) => ({
      ...s,
      aircraft: s.aircraft.map((a) => ({ ...a, privacyListed: true })),
    }));
    const d = decide(c, ladd, RECORDED);
    expect(d).toMatchObject({ kind: "waiting", reason: "weak-evidence" });
    expect(d.kind === "waiting" && d.says).toMatch(/privacy/);
  });

  it("won't match an aircraft pointed away from the airport (edited: JBU603 track reversed)", () => {
    const c = claim("B6603", JFK);
    const away = searchesFor(c.ident, (_, s) => ({
      ...s,
      aircraft: s.aircraft.map((a) => ({ ...a, trackDeg: 84 })),
    }));
    expect(decide(c, away, RECORDED)).toMatchObject({ kind: "waiting" });
  });

  it("won't take a departure climbing out of YVR for an arrival (edited: WJA133 climbing east)", () => {
    // Recorded live the same night: WJA322 4 km from YVR at 3,550 ft,
    // heading 100°, bound for Edmonton. Without a route record to object,
    // closeness alone must not make it somebody's arrival.
    const c = claim("WS133", YYC);
    const departing = searchesFor(
      c.ident,
      (_, s) => ({
        ...s,
        aircraft: s.aircraft.map((a) => ({
          ...a,
          position: { lat: 49.18, lon: -123.08 },
          trackDeg: 100,
          verticalRateFpm: 2400,
        })),
      }),
      "none",
    );
    const d = decide(c, departing, RECORDED);
    expect(d).toMatchObject({ kind: "waiting", reason: "weak-evidence" });
    expect(d.evidence.find((e) => e.check === "heading")?.says).toMatch(
      /climbing away/,
    );
  });

  it("knows it can't make a callsign for an airline it doesn't know", () => {
    const c = claim("ZZ123", null);
    expect(decide(c, [], RECORDED)).toMatchObject({
      kind: "waiting",
      reason: "no-callsign",
    });
  });

  it("says the feed is down rather than that nothing is flying", () => {
    const c = claim("WS133", YYC);
    const down = candidatesFor(c.ident).map((candidate) => ({
      candidate,
      snapshot: null,
      route: null,
    }));
    expect(decide(c, down, RECORDED)).toMatchObject({
      kind: "waiting",
      reason: "feed-unavailable",
    });
  });
});

describe("operators flying someone else's number", () => {
  // SkyWest flies Delta, United, Alaska and American numbers under SKW, so
  // SKW3584 alone says nothing about whose flight it is. Edited from the
  // real SKW162Z payload: callsign and position moved onto SLC → YVR.
  const skw = (route: boolean): Search[] => {
    const c = claim("DL3584", SLC);
    return candidatesFor(c.ident).map((candidate) => {
      if (candidate.callsign !== "SKW3584")
        return {
          candidate,
          snapshot: { at: RECORDED.toISOString(), aircraft: [] },
          route: null,
        };
      const real = readSnapshot(fixture("callsign-SKW162Z"));
      return {
        candidate,
        snapshot: {
          ...real,
          aircraft: real.aircraft.map((a) => ({
            ...a,
            callsign: "SKW3584",
            position: { lat: 47.2, lon: -119.9 },
            trackDeg: 312,
          })),
        },
        route: route
          ? readRoute({
              callsign: "SKW3584",
              _airports: [
                { icao: "KSLC", iata: "SLC", lat: 40.7884, lon: -111.9778 },
                { icao: "CYVR", iata: "YVR", lat: 49.1939, lon: -123.184 },
              ],
            })
          : null,
      };
    });
  };

  it("looks for DL 3584 under Delta's own callsign and its regional operators", () => {
    expect(candidatesFor(readFlight("DL3584")!).map((c) => c.callsign)).toEqual(
      ["DAL3584", "SKW3584", "EDV3584", "RPA3584"],
    );
  });

  it("does not identify an operator callsign without a route record, however well it fits", () => {
    const c = claim("DL3584", SLC);
    expect(decide(c, skw(false), RECORDED)).toMatchObject({
      kind: "waiting",
      reason: "weak-evidence",
    });
  });

  it("identifies it when the route record agrees as well", () => {
    const c = claim("DL3584", SLC);
    const d = decide(c, skw(true), RECORDED);
    expect(d.kind === "identified" && d.candidate.kind).toBe("operator");
  });
});
