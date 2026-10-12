import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { candidateToExperience } from "./atlasMapper";
import { COMPOSED_READS, destinationFor } from "./destination";

/**
 * **Every card Discovery shows opens a page that can render it.**
 *
 * The old tests checked the URL `destinationFor` produced and never asked
 * whether anything at that URL could answer for the entity. 740 of 3,110
 * Discovery cards on production (2026-10-11) led to "There's nothing at this
 * address" (all 17 sampled did): every Activity, and every Place that was not
 * detail-ready, because
 * `/passport/[id]` asks Atlas only for Organization, Experience and Event
 * compositions.
 *
 * Run on the committed real Atlas body (2,979 candidates, fetched 2026-10-11)
 * and against Atlas's own route table in the reference clone, so a read
 * Passport relies on that Atlas does not serve fails here, not in a browser.
 */
const corpus = JSON.parse(
  gunzipSync(
    readFileSync(
      resolve(
        __dirname,
        "../../../docs/product/critic/evidence/atlas-candidates-2026-10-11.json.gz",
      ),
    ),
  ).toString("utf8"),
) as DiscoveryCandidate[];

const atlasServer = readFileSync(
  resolve(__dirname, "../../../../atlas/src/api/server.ts"),
  "utf8",
);
/** Whether Atlas routes `GET /{read}/:id/detail`. */
const atlasServes = (read: string) =>
  atlasServer.includes(`path.match(/^\\/${read}\\/([^/]+)\\/detail$/)`);

/** Real ids from that body, each opened on production while it 404'd. */
const REAL = {
  caravanFarmTheatre: "f54d6acc-91f7-4558-a2ad-6565f318f978", // Place, not detail-ready
  paynters: "ef3a970a-ea89-4110-92be-da0a44d5fd62", // Place, detail-ready
  donORay: "32866d7e-60d3-4575-8ace-1b37110cdd44", // Organization
  acrylicPainting: "e1a2db61-ce81-4846-9775-52bed6186cca", // Event
  uPickOrchard: "59b5ed9c-b075-4d21-9e84-a608d1aaa12d", // Activity
  fairyDoors: "f3d2101f-c59a-4c46-905a-2b2607e5728d", // Activity
} as const;

const byId = (id: string) => {
  const found = corpus.find((c) => c.id === id);
  if (!found) throw new Error(`fixture has no ${id}`);
  return candidateToExperience(found);
};

describe("destinationFor, on the real corpus", () => {
  it("holds every kind Discovery offers", () => {
    expect(new Set(corpus.map((c) => c.kind))).toEqual(
      new Set(["Place", "Organization", "Event", "Activity", "Experience"]),
    );
  });

  it("sends every Place to the Place page, ready or not", () => {
    const places = corpus.filter((c) => c.kind === "Place");
    const notReady = places
      .map(candidateToExperience)
      .filter((e) => !e.detailReady);
    // The bug lived in the not-ready ones, so the fixture must hold some.
    expect(notReady.length).toBeGreaterThan(100);
    for (const place of places) {
      expect(destinationFor(candidateToExperience(place))).toBe(
        `/places/${place.id}`,
      );
    }
    expect(atlasServes("places")).toBe(true);
  });

  it("sends every other kind to /passport, which can render it", () => {
    for (const candidate of corpus.filter((c) => c.kind !== "Place")) {
      const href = destinationFor(candidateToExperience(candidate));
      expect(href).toBe(`/passport/${candidate.id}`);
      // Either Atlas composes it, or /passport/[id] renders it from this very
      // candidate (see its page test). An Activity is the second kind.
      const composed = (COMPOSED_READS as Record<string, string>)[
        candidate.kind
      ];
      if (composed) expect(atlasServes(composed)).toBe(true);
      else expect(candidate.kind).toBe("Activity");
    }
  });

  it("opens the real ids that were dead on production", () => {
    expect(destinationFor(byId(REAL.caravanFarmTheatre))).toBe(
      `/places/${REAL.caravanFarmTheatre}`,
    );
    expect(destinationFor(byId(REAL.paynters))).toBe(
      `/places/${REAL.paynters}`,
    );
    expect(destinationFor(byId(REAL.donORay))).toBe(
      `/passport/${REAL.donORay}`,
    );
    expect(destinationFor(byId(REAL.acrylicPainting))).toBe(
      `/passport/${REAL.acrylicPainting}`,
    );
    expect(destinationFor(byId(REAL.uPickOrchard))).toBe(
      `/passport/${REAL.uPickOrchard}`,
    );
    expect(destinationFor(byId(REAL.fairyDoors))).toBe(
      `/passport/${REAL.fairyDoors}`,
    );
  });
});
