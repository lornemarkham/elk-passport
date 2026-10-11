import { describe, expect, it } from "vitest";
import { attributionFor } from "./attribution";
import type { Journey } from "./journey";

const routed = (provider: string, limitations: string[] = []): Journey => ({
  kind: "routed",
  mode: "driving",
  minutes: 9,
  roadKm: 4.5,
  straightKm: 2.2,
  provider,
  calculatedAt: "2026-10-11T17:04:12.000Z",
  limitations,
});

describe("attributionFor", () => {
  it("owes nobody anything for straight lines and empty answers", () => {
    expect(
      attributionFor([
        { kind: "straight-line", km: 3, basis: "coordinates" },
        undefined,
        { kind: "unknown", because: "x" },
      ]),
    ).toEqual([]);
  });

  it("credits openrouteservice and OpenStreetMap", () => {
    expect(attributionFor([routed("openrouteservice")])).toEqual([
      "Routes © openrouteservice.org by HeiGIT · map data © OpenStreetMap contributors",
    ]);
    expect(attributionFor([routed("ors-hgv")])[0]).toMatch(/HeiGIT/);
  });

  it("credits OSRM once however many legs it routed", () => {
    expect(
      attributionFor([routed("osrm"), routed("osrm-demo"), routed("osrm")]),
    ).toEqual([
      "Routes by OSRM · road network © OpenStreetMap contributors (ODbL)",
    ]);
  });

  it("names a provider it does not know, with any credit Atlas sent", () => {
    expect(
      attributionFor([
        routed("valhalla-bc", [
          "no live traffic",
          "map data © OpenStreetMap contributors",
        ]),
      ]),
    ).toEqual([
      "Travel times by valhalla-bc · map data © OpenStreetMap contributors",
    ]);
  });
});
