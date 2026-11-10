import { afterEach, describe, expect, it, vi } from "vitest";
import { courtStore, NotReady, setStoreForTests, storeKey } from "./store";

describe("CourtQueue store selection", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    setStoreForTests(undefined);
  });

  it("prefers its own key, else derives one from the Atlas token without revealing it", () => {
    vi.stubEnv("COURTQUEUE_STORE_KEY", "");
    vi.stubEnv("ATLAS_SERVICE_TOKEN", "atlas-token-0123456789abcdef");
    const derived = storeKey()!;
    expect(derived).toHaveLength(43);
    expect(derived).not.toContain("atlas-token");
    expect(storeKey()).toBe(derived);
    vi.stubEnv("COURTQUEUE_STORE_KEY", "a-key-of-at-least-24-characters");
    expect(storeKey()).toBe("a-key-of-at-least-24-characters");
  });

  it("never falls back to memory in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COURTQUEUE_STORE", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(() => courtStore()).toThrow(NotReady);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:9");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("COURTQUEUE_STORE_KEY", "");
    vi.stubEnv("ATLAS_SERVICE_TOKEN", "");
    expect(() => courtStore()).toThrow(/no server key/);
    vi.stubEnv("ATLAS_SERVICE_TOKEN", "atlas-token-0123456789abcdef");
    expect(courtStore().kind).toBe("postgres");
  });
});
