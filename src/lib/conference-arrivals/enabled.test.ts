import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { arrivalsEnabled } from "./enabled";

const secret = "x".repeat(32);

describe("arrivalsEnabled (its store is not durable)", () => {
  it("is open in development on the memory store", () => {
    expect(arrivalsEnabled({}, true)).toBe(true);
    expect(arrivalsEnabled({ CONFERENCE_STORE: "memory" }, true)).toBe(true);
  });

  it("is closed on the durable conference store, even in development", () => {
    expect(arrivalsEnabled({ CONFERENCE_STORE: "supabase" }, true)).toBe(false);
  });

  it("is closed in production, whichever store is stated", () => {
    expect(arrivalsEnabled({}, false)).toBe(false);
    expect(
      arrivalsEnabled(
        { CONFERENCE_STORE: "memory", CONFERENCE_SECRET: secret },
        false,
      ),
    ).toBe(false);
    expect(arrivalsEnabled({ CONFERENCE_STORE: "supabase" }, false)).toBe(
      false,
    );
  });

  it("is closed when the conference foundation itself is closed", () => {
    expect(arrivalsEnabled({ CONFERENCE_STORE: "bogus" }, true)).toBe(false);
  });
});
