import { describe, expect, it } from "vitest";
import { SYCLE_VANCOUVER_2026 } from "@/domain/conference/fixtures";
import type { IdentityKey } from "@/domain/conference/types";
import {
  readRoute,
  readSnapshot,
  type AdsbSnapshot,
} from "@/domain/conference-arrivals/adsb";
import * as conf from "@/lib/conference/service";
import { memoryStore } from "@/lib/conference/store";
import type { AdsbSource } from "./adsb-client";
import {
  arrivalAirportFor,
  arrivalsLifecycle,
  readArrivals,
  removeMine,
  saveMine,
  type ArrivalsDeps,
} from "./service";
import { memoryArrivals } from "./store";

const ORG: IdentityKey = "user:organiser";
const ANA: IdentityKey = "user:ana";
const BEN: IdentityKey = "guest:ben";
const STRANGER: IdentityKey = "user:stranger";

const fixture = (name: string): unknown => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(
      `../../domain/conference-arrivals/__fixtures__/${name}.json`,
    );
  } catch {
    return null;
  }
};

/** ADS-B as it was at 05:27 UTC on 2026-10-12, from the recordings. */
function recordedSky(): AdsbSource & { calls: string[] } {
  const calls: string[] = [];
  const empty: AdsbSnapshot = { at: "2026-10-12T05:27:40Z", aircraft: [] };
  return {
    calls,
    async around() {
      calls.push("around");
      return empty;
    },
    async byCallsign(cs) {
      calls.push(`callsign:${cs}`);
      const body = fixture(`callsign-${cs}`);
      return body ? readSnapshot(body) : empty;
    },
    async byHex(hex) {
      calls.push(`hex:${hex}`);
      return empty;
    },
    async route(cs) {
      return readRoute(fixture(`route-${cs}`));
    },
  };
}

async function world() {
  const now = new Date("2026-10-12T05:27:40Z");
  const store = memoryArrivals();
  const conference = {
    store: memoryStore(),
    lifecycle: [arrivalsLifecycle(() => store)],
    now,
  };
  const adsb = recordedSky();
  const d: ArrivalsDeps = {
    conference,
    store,
    adsb,
    enabled: true,
    budgetMs: 2_000,
  };

  const made = await conf.createConference(conference, ORG, {
    ...SYCLE_VANCOUVER_2026,
    modules: ["arrivals", "discover"],
  });
  if (!made.ok) throw new Error(made.error);
  const id = made.conference.id;
  const code = await conf.setAccessCode(conference, ORG, id, "new");
  if (!code.ok || !code.accessCode) throw new Error("no code");
  for (const who of [ANA, BEN])
    await conf.joinWithCode(conference, who, code.accessCode);
  return { d, id, adsb, conference };
}

const flight = {
  flight: "WS133",
  date: "2026-10-11",
  from: "YYC",
};

describe("the conference's airport", () => {
  it("is derived from where the conference is, not written down", async () => {
    const { d, id } = await world();
    const home = await conf.homeFor(d.conference, ANA, id);
    expect(arrivalAirportFor(home!.conference)?.icao).toBe("CYVR");
  });
});

describe("the vertical slice: enter, share, see the real aircraft", () => {
  it("Ana shares WS 133; Ben sees her name on the real WJA133 approaching YVR", async () => {
    const { d, id } = await world();
    expect(
      await saveMine(d, ANA, id, {
        ...flight,
        shared: true,
        displayName: "Ana",
      }),
    ).toEqual({ ok: true });

    const ben = await readArrivals(d, BEN, id);
    expect(ben?.board?.rows).toHaveLength(1);
    expect(ben?.board?.rows[0]).toMatchObject({
      name: "Ana",
      flight: "WS133",
      phase: "airborne",
      isYou: false,
      aircraft: { callsign: "WJA133", registration: "C-GZWS" },
    });
    expect(ben?.board?.rows[0]?.position).toMatchObject({
      lat: 49.229233,
      lon: -123.419847,
    });
  });

  it("sharing makes Ana seen in the conference under the name she gave", async () => {
    const { d, id } = await world();
    await saveMine(d, ANA, id, { ...flight, shared: true, displayName: "Ana" });
    const home = await conf.homeFor(d.conference, BEN, id);
    expect(home?.people.visible.map((p) => p.displayName)).toEqual(["Ana"]);
  });

  it("asks ADS-B once for two viewers, because the second read isn't due", async () => {
    const { d, id, adsb } = await world();
    await saveMine(d, ANA, id, { ...flight, shared: true, displayName: "Ana" });
    await readArrivals(d, BEN, id);
    const after = adsb.calls.length;
    await readArrivals(d, ANA, id);
    expect(adsb.calls.length).toBe(after);
  });
});

describe("sharing ADSB.lol's quota", () => {
  it("finds an aircraft near the airport in the shared area query, with no call of its own", async () => {
    const { d, id, adsb } = await world();
    adsb.around = async () => {
      adsb.calls.push("around");
      return readSnapshot(fixture("callsign-WJA133"));
    };
    await saveMine(d, ANA, id, { ...flight, shared: true, displayName: "Ana" });
    const view = await readArrivals(d, BEN, id);
    expect(view?.board?.rows[0]?.phase).toBe("airborne");
    expect(adsb.calls).toEqual(["around"]);
  });

  it("skips the area query when the only work is following an aircraft far from the airport", async () => {
    const { d, id, adsb, conference } = await world();
    await saveMine(d, ANA, id, { ...flight, shared: true, displayName: "Ana" });
    await readArrivals(d, BEN, id); // identifies WJA133 near YVR
    const memberId = (await conf.homeFor(conference, ANA, id))!.you.memberId;
    const r = (await d.store.get(id, memberId))!;
    await d.store.put({
      ...r,
      tracking: {
        ...r.tracking,
        last: { ...r.tracking.last!, lat: 51.0, lon: -114.8 },
        checkedAt: "2026-10-12T05:20:00Z",
      },
    });
    adsb.calls.length = 0;
    await readArrivals(d, BEN, id);
    expect(adsb.calls).toEqual(["hex:c088fb"]);
  });

  it("asks nothing at all when no flight is due", async () => {
    const { d, id, adsb } = await world();
    await saveMine(d, ANA, id, { ...flight, date: "2026-10-22" });
    await readArrivals(d, BEN, id);
    expect(adsb.calls).toEqual([]);
  });
});

describe("authorization", () => {
  it("a stranger reads nothing and saves nothing, exactly as for no conference", async () => {
    const { d, id } = await world();
    await saveMine(d, ANA, id, { ...flight, shared: true, displayName: "Ana" });
    expect(await readArrivals(d, STRANGER, id)).toBeNull();
    expect(await readArrivals(d, STRANGER, "no-such-id")).toBeNull();
    expect(
      await saveMine(d, STRANGER, id, { ...flight, shared: true }),
    ).toEqual({ ok: false, error: "not-found" });
    expect(await removeMine(d, STRANGER, id)).toBe(false);
  });

  it("closed, it answers everyone as for a stranger and never asks ADS-B", async () => {
    const { d, id, adsb } = await world();
    await saveMine(d, ANA, id, { ...flight, shared: true, displayName: "Ana" });
    const closed = { ...d, enabled: false };
    const before = adsb.calls.length;
    expect(await readArrivals(closed, ANA, id)).toBeNull();
    expect(await readArrivals(closed, ORG, id)).toBeNull();
    expect(await saveMine(closed, BEN, id, { ...flight })).toEqual({
      ok: false,
      error: "not-found",
    });
    expect(await removeMine(closed, ANA, id)).toBe(false);
    expect(adsb.calls.length).toBe(before);
  });

  it("a member of another conference can't read this one", async () => {
    const { d, id, conference } = await world();
    const other = await conf.createConference(conference, STRANGER, {
      ...SYCLE_VANCOUVER_2026,
      name: "Somebody else's offsite",
      modules: ["arrivals"],
    });
    expect(other.ok).toBe(true);
    expect(await readArrivals(d, STRANGER, id)).toBeNull();
  });

  it("an unshared flight is yours alone", async () => {
    const { d, id } = await world();
    await saveMine(d, ANA, id, { ...flight, shared: false });
    expect((await readArrivals(d, BEN, id))?.board?.rows).toEqual([]);
    const ana = await readArrivals(d, ANA, id);
    expect(ana?.board?.rows[0]).toMatchObject({ isYou: true, shared: false });
    expect(JSON.stringify(await readArrivals(d, BEN, id))).not.toContain(
      "WS133",
    );
  });

  it("organisers get no special view of members' flights", async () => {
    const { d, id } = await world();
    await saveMine(d, ANA, id, { ...flight, shared: false });
    expect((await readArrivals(d, ORG, id))?.board?.rows).toEqual([]);
  });

  it("a member can't see arrivals in a conference that hasn't switched it on", async () => {
    const { d, id, conference } = await world();
    const home = await conf.homeFor(conference, ORG, id);
    await conf.updateConference(conference, ORG, id, {
      ...SYCLE_VANCOUVER_2026,
      timeZone: home!.conference.timeZone,
      modules: ["discover"],
    });
    expect(await readArrivals(d, ANA, id)).toBeNull();
  });

  it("leaving forgets the flight, through the foundation's lifecycle", async () => {
    const { d, id, conference } = await world();
    await saveMine(d, ANA, id, { ...flight, shared: true, displayName: "Ana" });
    await conf.leave(conference, ANA, id);
    expect(await d.store.list(id)).toEqual([]);
  });

  it("deleting the conference forgets every flight in it", async () => {
    const { d, id, conference } = await world();
    await saveMine(d, ANA, id, { ...flight, shared: true, displayName: "Ana" });
    await saveMine(d, BEN, id, { ...flight, shared: false });
    await conf.deleteConference(conference, ORG, id);
    expect(await d.store.list(id)).toEqual([]);
  });
});

describe("saving", () => {
  it("says what's wrong, field by field", async () => {
    const { d, id } = await world();
    const r = await saveMine(d, ANA, id, {
      flight: "12345",
      date: "2026-13-01",
      from: "XQZ",
      shared: true,
    });
    expect(r.ok).toBe(false);
    const paths = !r.ok ? r.issues?.map((i) => i.path) : [];
    expect(paths).toEqual(["flight", "date", "from", "displayName"]);
  });

  it("won't take the conference's own airport as where you're leaving from", async () => {
    const { d, id } = await world();
    const r = await saveMine(d, ANA, id, { ...flight, from: "YVR" });
    expect(!r.ok && r.issues?.[0]?.path).toBe("from");
  });

  it("a different flight starts over; the same one keeps what ADS-B showed", async () => {
    const { d, id, conference } = await world();
    await saveMine(d, ANA, id, { ...flight, shared: true, displayName: "Ana" });
    await readArrivals(d, ANA, id);
    const memberId = (await conf.homeFor(conference, ANA, id))!.you.memberId;
    expect((await d.store.get(id, memberId))?.tracking.phase).toBe("airborne");
    await saveMine(d, ANA, id, { ...flight, shared: false });
    expect((await d.store.get(id, memberId))?.tracking.phase).toBe("airborne");
    await saveMine(d, ANA, id, { ...flight, flight: "B6603", from: "JFK" });
    expect((await d.store.get(id, memberId))?.tracking.phase).toBe("scheduled");
  });
});
