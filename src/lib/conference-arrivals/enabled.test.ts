import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { arrivalsEnabled } from "./enabled";

const secret = "x".repeat(32);

describe("arrivalsEnabled", () => {
  it("is open in development on the memory store", () => {
    expect(arrivalsEnabled({}, true)).toBe(true);
    expect(arrivalsEnabled({ CONFERENCE_STORE: "memory" }, true)).toBe(true);
  });

  it("on the durable store is open only once the owner says the migration is applied", () => {
    expect(arrivalsEnabled({ CONFERENCE_STORE: "supabase" }, true)).toBe(false);
    expect(arrivalsEnabled({ CONFERENCE_STORE: "supabase" }, false)).toBe(
      false,
    );
    expect(
      arrivalsEnabled(
        { CONFERENCE_STORE: "supabase", CONFERENCE_ARRIVALS: "on" },
        false,
      ),
    ).toBe(true);
  });

  it("is closed in production on the memory store", () => {
    expect(arrivalsEnabled({}, false)).toBe(false);
    expect(
      arrivalsEnabled(
        { CONFERENCE_STORE: "memory", CONFERENCE_SECRET: secret },
        false,
      ),
    ).toBe(false);
  });

  it("is closed when the conference foundation itself is closed", () => {
    expect(arrivalsEnabled({ CONFERENCE_STORE: "bogus" }, true)).toBe(false);
    expect(arrivalsEnabled({ CONFERENCE_ARRIVALS: "on" }, false)).toBe(false);
  });
});
