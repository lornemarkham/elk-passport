import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ATLAS_TRAVEL_LEGS, travelTimeReadingSchema } from "./contracts";

/**
 * **Passport's reading schema against Atlas's own code, not a copy of it.**
 *
 * `../atlas` is the read-only elk-atlas reference clone (as
 * `src/lib/october/types.test.ts` uses it). These tests import Atlas's
 * `travelTime.ts` and run its real OSRM adapter over a fake `fetch`, so a
 * field Atlas renames, drops or adds as required fails here — not on `/go`.
 *
 * The OSRM bodies are synthetic except where a comment cites ADR 097's probe.
 */

const ATLAS = resolve(process.cwd(), "../atlas");
const TRAVEL_TIME = resolve(ATLAS, "src/application/travel/travelTime.ts");

// A literal path, so Vite compiles Atlas's TypeScript; it is the same
// `../atlas` as ATLAS above, seen from this file.
const loadAtlas = () =>
  import("../../../../../atlas/src/application/travel/travelTime");

const VERNON = { lng: -119.272, lat: 50.267 };
const FINTRY = { id: "fintry", at: { lng: -119.5, lat: 50.137 } };
const KAL_PARK = { id: "kal-park", at: { lng: -119.27, lat: 50.2 } };

const osrm = (body: unknown) =>
  (async () =>
    new Response(JSON.stringify(body), {
      status: 200,
    })) as unknown as typeof fetch;

describe("Atlas's TravelTimeReading, as Atlas's code produces it", () => {
  it("has the reference clone to read", () => {
    expect(existsSync(TRAVEL_TIME), `${TRAVEL_TIME} is missing`).toBe(true);
  });

  it("parses an estimate, including the slow-route caution", async () => {
    const { OsrmTravelTimeProvider } = await loadAtlas();
    const provider = new OsrmTravelTimeProvider("http://osrm.test", {
      now: () => new Date("2026-10-11T08:00:00Z"),
      // Fintry: 50.4 km, 61 min (ADR 097's probe). Kal Park: 33.3 km in 82 min,
      // the route that averages under 30 km/h and earns `accessCaution`.
      fetchImpl: osrm({
        code: "Ok",
        durations: [[0, 3640, 4900]],
        distances: [[0, 50400, 33300]],
        sources: [{ distance: 10 }],
        destinations: [{ distance: 0 }, { distance: 20 }, { distance: 30 }],
      }),
    });
    const [fintry, kal] = await provider.matrix(
      VERNON,
      [FINTRY, KAL_PARK],
      "driving",
    );

    const a = travelTimeReadingSchema.parse(fintry);
    expect(a).toMatchObject({
      state: "estimated",
      minutes: 61,
      routeKm: 50.4,
      provider: "osrm",
    });
    expect(a.state === "estimated" && a.accessCaution).toBeFalsy();

    const b = travelTimeReadingSchema.parse(kal);
    expect(b.state === "estimated" && b.accessCaution).toMatch(/minor tracks/);
  });

  it("parses every way Atlas says there is no estimate", async () => {
    const { OsrmTravelTimeProvider } = await loadAtlas();
    const offRoad = new OsrmTravelTimeProvider("http://osrm.test", {
      fetchImpl: osrm({
        code: "Ok",
        durations: [[0, null, 600]],
        distances: [[0, null, 5000]],
        sources: [{ distance: 0 }],
        destinations: [{ distance: 0 }, { distance: 0 }, { distance: 900 }],
      }),
    });
    const [noRoute, tooFar] = await offRoad.matrix(
      VERNON,
      [FINTRY, KAL_PARK],
      "driving",
    );
    expect(travelTimeReadingSchema.parse(noRoute)).toMatchObject({
      state: "unavailable",
    });
    expect(travelTimeReadingSchema.parse(tooFar)).toMatchObject({
      state: "unavailable",
      because: expect.stringMatching(/from the nearest routable road/),
    });

    const refused = new OsrmTravelTimeProvider("http://osrm.test", {
      fetchImpl: osrm({ code: "NoTable" }),
    });
    const [answer] = await refused.matrix(VERNON, [FINTRY], "driving");
    expect(travelTimeReadingSchema.parse(answer)).toMatchObject({
      state: "unavailable",
    });

    const [walk] = await refused.matrix(VERNON, [FINTRY], "walking");
    expect(travelTimeReadingSchema.parse(walk)).toMatchObject({
      state: "unsupported",
      mode: "walking",
    });
  });

  it("refuses an estimate that has lost its provenance", () => {
    const honest = {
      state: "estimated",
      mode: "driving",
      minutes: 10,
      routeKm: 4.9,
      straightKm: 3.1,
      provider: "openrouteservice",
      calculatedAt: "2026-10-11T08:00:00.000Z",
      limitations: [
        "© openrouteservice.org by HeiGIT · map data © OpenStreetMap contributors",
      ],
    };
    expect(travelTimeReadingSchema.safeParse(honest).success).toBe(true);
    for (const field of ["provider", "calculatedAt", "limitations"]) {
      const without: Record<string, unknown> = { ...honest };
      delete without[field];
      expect(travelTimeReadingSchema.safeParse(without).success, field).toBe(
        false,
      );
    }
    expect(
      travelTimeReadingSchema.safeParse({ ...honest, minutes: 9.5 }).success,
    ).toBe(false);
  });
});

describe("where the /travel/legs route stands", () => {
  /**
   * A tripwire, not a judgement. The reference clone is GitHub `main`; the
   * route is on Atlas's `release/routing-rc` only. When GitHub `main` gains it, this
   * fails, and `ATLAS_TRAVEL_LEGS` must be re-measured against the source —
   * the reports it was read from are no longer the best evidence.
   */
  it("is not on the Atlas reference clone, as ATLAS_TRAVEL_LEGS records", () => {
    const server = readFileSync(resolve(ATLAS, "src/api/server.ts"), "utf8");
    const onGitHubMain = server.includes(ATLAS_TRAVEL_LEGS.path);
    expect(
      onGitHubMain,
      "Atlas GitHub main now serves /travel/legs: re-read src/api/travelLegs.ts and update src/lib/domains/travel/contracts.ts",
    ).toBe(false);
    expect(ATLAS_TRAVEL_LEGS.status).toBe("release-candidate-not-deployed");
  });

  it("is reached only by an authenticated caller, who gets 404 for a path Atlas lacks", () => {
    const server = readFileSync(resolve(ATLAS, "src/api/server.ts"), "utf8");
    // Auth runs before routing, so a missing token is 401 — never "not served".
    expect(server).toMatch(
      /Before any routing[\s\S]{0,200}serviceAuthFailure\(req\)/,
    );
    expect(server).toMatch(/sendJson\(res, 404, \{\s*error: "Not found"/);
  });
});
