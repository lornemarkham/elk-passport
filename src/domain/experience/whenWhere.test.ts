import { describe, expect, it } from "vitest";
import { formatEventWhen } from "./eventTime";
import { candidateToExperience } from "./atlasMapper";
import { whereLine } from "@/components/october/discover/cards";
import { asDiscoveryUnits } from "@/domain/discovery/discoveryUnits";
import type { DiscoveryCandidate } from "@/lib/data/types";
import type { Experience } from "./types";

/**
 * **When and where may be absent. They may never be more certain than the
 * evidence.**
 *
 * The rule this whole area exists to protect: information must not become more
 * specific as it travels toward a person. A date is not a time, a region is not
 * a venue, and a publisher is not a location.
 */

const candidate = (over: Partial<DiscoveryCandidate>): DiscoveryCandidate =>
  ({
    id: "c1",
    kind: "Event",
    name: "A thing",
    aliases: [],
    description: "",
    mediaCount: 0,
    containsCount: 0,
    regionIds: [],
    ...over,
  }) as DiscoveryCandidate;

const unitOf = (e: Experience) => asDiscoveryUnits([e], [e])[0]!;

describe("when", () => {
  it("renders a genuinely stated time, in Okanagan local time", () => {
    // 02:30Z on the 18th is 7:30 p.m. on the 17th in Vancouver — the time
    // printed on the ticket.
    const when = formatEventWhen(
      "2026-10-18T02:30:00.000Z",
      "2026-10-18T05:30:00.000Z",
    );
    expect(when).toContain("Oct 17, 2026");
    expect(when).toContain("7:30");
    expect(when).toContain("10:30");
  });

  it("keeps both ends of a genuinely timed interval", () => {
    const when = formatEventWhen(
      "2026-10-03T17:00:00.000Z",
      "2026-10-03T22:00:00.000Z",
    );
    expect(when).toContain("10:00");
    expect(when).toContain("3:00");
  });

  it("says nothing when there is nothing to say", () => {
    expect(formatEventWhen(undefined, undefined)).toBeUndefined();
    expect(formatEventWhen("not a date", undefined)).toBeUndefined();
  });

  /**
   * The open seam, pinned so it cannot be forgotten or quietly "fixed" with a
   * guess.
   *
   * A source that states only `October 17` is stored as `2026-10-17T00:00:00Z`
   * and is indistinguishable, at this layer, from a source that states 5 p.m.
   * Pacific — which 3 Events in the corpus genuinely do. Passport therefore
   * renders what Atlas gave it and does not attempt to tell them apart; the
   * distinction has to arrive as evidence, not be inferred here.
   */
  it("does not try to guess which midnight instants were date-only", () => {
    // Still open, and still visible, on an interval short enough to be one
    // sitting: a stated midnight prints as 5 p.m. Pacific because that is
    // what the instant is, and nothing here knows whether a clock was meant.
    const dateOnly = formatEventWhen(
      "2026-10-17T00:00:00.000Z",
      "2026-10-17T04:00:00.000Z",
    );
    expect(dateOnly).toContain("5:00");
  });

  it("stops exposing that seam once the span is far too long to be a sitting", () => {
    // This case used to print `Mon, Sep 28, 2026 5:00 p.m. – Thu, Jun 24,
    // 2027 5:00 p.m.` — nine months of continuous running, with a phantom
    // clock on both ends. The original version of the test above asserted
    // that 5 p.m. and said in its own comment: *if this ever fails because
    // the value became a bare date, the contract arrived — update the test.*
    //
    // It did not quite arrive; what changed is narrower and worth stating
    // exactly. Nothing here can still tell a stated midnight from a stated
    // 5 p.m. The clock is dropped beyond a day and a half because at that
    // length it is asserting continuity rather than telling the time, so the
    // ambiguity stops *showing* without being resolved.
    const long = formatEventWhen(
      "2026-09-29T00:00:00.000Z",
      "2027-06-25T00:00:00.000Z",
    )!;
    expect(long).not.toContain("5:00");
    expect(long).toContain("Sep 28, 2026");
    expect(long).toContain("Jun 24, 2027");
  });
});

describe("where", () => {
  it("carries a stated venue and town through to a card line", () => {
    const e = candidateToExperience(
      candidate({
        location: {
          name: "Vernon Jazz Club",
          locality: "Vernon",
          basis: "stated-venue",
        },
      }),
    );
    expect(e.venue?.name).toBe("Vernon Jazz Club");
    expect(whereLine(unitOf(e))).toBe("Vernon Jazz Club · Vernon");
  });

  it("fabricates nothing when Atlas knows no location", () => {
    const e = candidateToExperience(candidate({}));
    expect(e.venue).toBeUndefined();
    expect(whereLine(unitOf(e))).toBeUndefined();
  });

  it("never prints a town twice when the venue is the town", () => {
    const e = candidateToExperience(
      candidate({
        location: {
          name: "Armstrong",
          locality: "Armstrong",
          basis: "stated-venue",
        },
      }),
    );
    expect(whereLine(unitOf(e))).toBe("Armstrong");
  });

  it("keeps the place id when an edge asserted it", () => {
    const e = candidateToExperience(
      candidate({
        location: {
          placeId: "pl-1",
          name: "Davison Orchards",
          locality: "Vernon",
          basis: "happens-at",
        },
      }),
    );
    expect(e.venue?.placeId).toBe("pl-1");
    expect(e.venue?.basis).toBe("happens-at");
  });

  it("does not turn a region membership into a location", () => {
    // 19 of the dated records carry a region id and no venue. A region is a
    // grouping Atlas made, not a door a person walks through.
    const e = candidateToExperience(
      candidate({ regionIds: ["region-okanagan"] }),
    );
    expect(e.venue).toBeUndefined();
    expect(whereLine(unitOf(e))).toBeUndefined();
  });
});

describe("a grouped unit", () => {
  const whole = candidateToExperience(
    candidate({
      id: "whole",
      kind: "Experience",
      name: "The Black Mountain Haunted House",
    }),
  );
  const mode = candidateToExperience(
    candidate({
      id: "mode",
      kind: "Experience",
      name: "Evening Haunt",
      partOf: {
        id: "whole",
        kind: "Experience",
        name: "The Black Mountain Haunted House",
      },
      location: {
        name: "Hillcrest Farm Market",
        locality: "Kelowna",
        basis: "stated-venue",
      },
    } as Partial<DiscoveryCandidate>),
  );

  it("finds a location a part knows when the whole does not", () => {
    const unit = asDiscoveryUnits([mode], [whole, mode])[0]!;
    expect(unit.head.title).toBe("The Black Mountain Haunted House");
    expect(unit.head.venue).toBeUndefined();
    // The card is the whole; the only stated door belongs to the mode.
    expect(whereLine(unit)).toBe("Hillcrest Farm Market · Kelowna");
  });

  it("invents no location when neither the whole nor its parts know one", () => {
    const bare = candidateToExperience(
      candidate({
        id: "mode2",
        kind: "Experience",
        name: "Family Fun Hours",
        partOf: {
          id: "whole",
          kind: "Experience",
          name: "The Black Mountain Haunted House",
        },
      } as Partial<DiscoveryCandidate>),
    );
    const unit = asDiscoveryUnits([bare], [whole, bare])[0]!;
    expect(whereLine(unit)).toBeUndefined();
  });
});
