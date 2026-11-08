import { describe, expect, it, vi } from "vitest";
import raw from "./fixtures/open-meteo-whistler-2026-11-07.json";
import { conditionsFor } from "./conditions";

// vitest does not resolve "server-only"; the other server tests mock it too.
vi.mock("server-only", () => ({}));

const at = new Date("2026-11-07T16:00:00Z");

describe("conditionsFor", () => {
  it("asks Open-Meteo for the mountain's own coordinates and validates the answer", async () => {
    const f = vi.fn(async () => Response.json(raw));
    const c = await conditionsFor(
      "whistler-blackcomb",
      f as unknown as typeof fetch,
      () => at,
    );
    expect(c?.days).toHaveLength(7);
    expect(c?.fetchedAt).toBe(at.toISOString());
    const url = String((f.mock.calls[0] as unknown[])[0]);
    expect(url).toContain("latitude=50.1163");
    expect(url).toContain("longitude=-122.9574");
  });

  it("is null for an unknown mountain without calling anyone", async () => {
    const f = vi.fn();
    expect(await conditionsFor("nowhere", f as unknown as typeof fetch)).toBe(
      null,
    );
    expect(f).not.toHaveBeenCalled();
  });

  it.each([
    ["a non-200", async () => new Response("no", { status: 503 })],
    ["a thrown network error", async () => Promise.reject(new Error("down"))],
    ["a body that is not a forecast", async () => Response.json({ hi: 1 })],
  ])("is null, never invented, on %s", async (_n, impl) => {
    const c = await conditionsFor(
      "cypress",
      impl as unknown as typeof fetch,
      () => at,
    );
    expect(c).toBeNull();
  });
});
