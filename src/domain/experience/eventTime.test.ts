import { describe, expect, it } from "vitest";
import { formatEventWhen } from "./eventTime";
import { candidateToExperience } from "./atlasMapper";
import { destinationFor } from "./destination";
import type { DiscoveryCandidate } from "@/lib/data/types";

// Rain Dance at the Ranch, exactly as Atlas stores it: 6–10 p.m. PDT.
const START = "2026-09-13T01:00:00.000Z";
const END = "2026-09-13T05:00:00.000Z";

describe("formatEventWhen", () => {
  it("renders the Okanagan local time the publisher printed", () => {
    // The instant is UTC; the traveller reads Pacific, which is what is on the
    // ticket. A Toronto reader must not be told this starts at 9 p.m.
    const when = formatEventWhen(START, END)!;
    expect(when).toContain("Sep 12, 2026");
    expect(when).toContain("6:00");
    expect(when).toContain("10:00");
  });

  it("writes both dates when an event crosses midnight", () => {
    const when = formatEventWhen(
      "2026-10-31T23:00:00.000Z",
      "2026-11-01T07:00:00.000Z",
    )!;
    expect(when).toContain("Oct 31, 2026");
    expect(when).toContain("Nov 1, 2026");
  });

  it("says nothing rather than something empty", () => {
    expect(formatEventWhen(undefined, undefined)).toBeUndefined();
    expect(formatEventWhen("not-a-date", END)).toBeUndefined();
  });

  it("renders a start alone when there is no end", () => {
    expect(formatEventWhen(START, undefined)).toContain("6:00");
  });
});

const candidate = (over: Partial<DiscoveryCandidate>): DiscoveryCandidate => ({
  id: "event-1",
  kind: "Event",
  name: "Rain Dance at the Ranch",
  description: "Live music, dancing, food and a silent auction.",
  mediaCount: 0,
  containsCount: 0,
  regionIds: [],
  ...over,
});

describe("an Event in Discover", () => {
  it("carries its dates from Atlas onto the Experience", () => {
    const e = candidateToExperience(
      candidate({ startTime: START, endTime: END }),
    );
    expect(e.startTime).toBe(START);
    expect(e.endTime).toBe(END);
  });

  it("opens its entity Passport page — a dated card must not be a dead end", () => {
    const e = candidateToExperience(
      candidate({ startTime: START, endTime: END }),
    );
    expect(destinationFor(e)).toBe("/passport/event-1");
  });

  it("is not sent to /places/{id}, which would be a 404 dressed as a link", () => {
    const e = candidateToExperience(
      candidate({ startTime: START, endTime: END }),
    );
    expect(destinationFor(e)).not.toContain("/places/");
  });

  it("an Event with no date still opens, it just has no date to show", () => {
    // Atlas drops an Event proposal whose dates the source never stated, so
    // this should not occur. When it does, a missing date is a missing *fact*,
    // not a reason the thing cannot be looked at: the card renders no date and
    // the traveller page says what it knows.
    const e = candidateToExperience(candidate({}));
    expect(formatEventWhen(e.startTime, e.endTime)).toBeUndefined();
    expect(destinationFor(e)).toBe("/passport/event-1");
  });

  it("no other kind gains a date", () => {
    for (const kind of ["Place", "Organization", "Activity"] as const) {
      const e = candidateToExperience(
        candidate({ kind, startTime: undefined, endTime: undefined }),
      );
      expect(e.startTime).toBeUndefined();
      expect(e.endTime).toBeUndefined();
    }
  });
});

describe("an interval that ends where it starts", () => {
  it("prints the start, not a range from a time to itself", () => {
    // Atlas stores a publisher's lone start time as both ends, which read as
    // `7:30 p.m. – 7:30 p.m.` on Urge/Detour's page.
    expect(
      formatEventWhen(
        "2026-10-10T02:30:00.000Z",
        "2026-10-10T02:30:00.000Z",
        "minute",
      ),
    ).not.toMatch(/–/);
  });

  it("still prints a real range", () => {
    const line = formatEventWhen(
      "2026-10-10T02:30:00.000Z",
      "2026-10-10T04:30:00.000Z",
      "minute",
    );
    expect(line).toMatch(/–/);
  });
});
