import { beforeEach, describe, expect, it } from "vitest";
import { defaultPact } from "./pact";
import { leave, newOuting } from "./outing";
import { KEPT, forgetOffline, updateOffline, writeOffline } from "./store";

/**
 * **The store survives a reload and shrugs off whatever it finds.**
 *
 * `localStorage` is user-controlled. A corrupt value, a value from some later
 * version, or a stray key must cost the person their postcards at worst —
 * never the page.
 */
const KEY = "ghad.offline";
const stored = () => JSON.parse(window.localStorage.getItem(KEY)!);

beforeEach(() => {
  window.localStorage.clear();
  forgetOffline();
});

describe("offline store", () => {
  it("writes through to storage and reads it back after a reload", () => {
    const current = leave(newOuting({ pact: defaultPact() }), new Date());
    writeOffline({ current, past: [] });
    forgetOffline();
    let seen: unknown;
    updateOffline((state) => {
      seen = state;
      return state;
    });
    expect(seen).toEqual({ current, past: [] });
  });

  it("keeps only the newest postcards", () => {
    const one = newOuting({ pact: defaultPact() });
    writeOffline({ past: Array.from({ length: KEPT + 4 }, () => one) });
    expect(stored().past).toHaveLength(KEPT);
  });

  it("starts empty from garbage, and drops entries it cannot read", () => {
    window.localStorage.setItem(KEY, "{not json");
    let seen: unknown;
    updateOffline((state) => ((seen = state), state));
    expect(seen).toEqual({ past: [] });

    forgetOffline();
    const good = newOuting({ pact: defaultPact() });
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ current: { version: 9 }, past: [good, 42, null] }),
    );
    updateOffline((state) => ((seen = state), state));
    expect(seen).toEqual({ past: [good] });
  });
});
