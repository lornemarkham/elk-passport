import { beforeEach, describe, expect, it, vi } from "vitest";

const exchange = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { exchangeCodeForSession: exchange },
  }),
}));

import { GET } from "./route";

const call = (qs: string) =>
  GET(new Request(`https://passport.example/auth/callback${qs}`));
const where = (res: Response) => new URL(res.headers.get("location")!);

describe("/auth/callback", () => {
  beforeEach(() => exchange.mockReset());

  it("sends a successful exchange to next", async () => {
    exchange.mockResolvedValue({ error: null });
    const res = await call("?code=abc&next=%2Fhockey%2Fjoin%2Ftok");
    expect(where(res).pathname).toBe("/hockey/join/tok");
  });

  it("keeps the invitation when the exchange fails (email opened on another device)", async () => {
    exchange.mockResolvedValue({ error: new Error("code verifier missing") });
    const res = await call("?code=abc&next=%2Fhockey%2Fjoin%2Ftok");
    const to = where(res);
    expect(to.pathname).toBe("/auth");
    expect(to.searchParams.get("notice")).toBe("link-expired");
    expect(to.searchParams.get("next")).toBe("/hockey/join/tok");
  });

  it("keeps it when the link has no code, too", async () => {
    const to = where(await call("?next=%2Fhockey%2Fjoin%2Ftok"));
    expect(to.searchParams.get("notice")).toBe("link-incomplete");
    expect(to.searchParams.get("next")).toBe("/hockey/join/tok");
  });

  it("never carries a hostile next onto the sign-in page", async () => {
    exchange.mockResolvedValue({ error: new Error("x") });
    for (const evil of ["https://evil.example", "//evil.example", "/\\evil"]) {
      const to = where(
        await call(`?code=abc&next=${encodeURIComponent(evil)}`),
      );
      expect(to.origin).toBe("https://passport.example");
      expect(to.searchParams.get("next")).toBeNull();
    }
  });

  it("adds no next when none was asked for", async () => {
    exchange.mockResolvedValue({ error: new Error("x") });
    expect(where(await call("?code=abc")).search).toBe("?notice=link-expired");
  });
});
