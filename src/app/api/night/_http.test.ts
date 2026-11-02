import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/adventures/server", () => ({
  answer: (work: () => Promise<unknown>) => work(),
}));

import { PackingOff } from "@/lib/date-night/night";
import { night } from "./_http";

describe("night()", () => {
  it("answers 409 and names the database's reason", async () => {
    const res = await night(async () => {
      throw new PackingOff("unseen", "PGRST205");
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      off: true,
      trouble: "unseen",
      code: "PGRST205",
    });
  });
});
