import { beforeEach, describe, expect, it, vi } from "vitest";

const currentUser = vi.fn();
const describeInvite = vi.fn();
const redeemInvite = vi.fn();

vi.mock("@/lib/auth/currentUser", () => ({ currentUser: () => currentUser() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({}),
}));
vi.mock("@/lib/adventures/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/adventures/store")>()),
  describeInvite: (...args: unknown[]) => describeInvite(...args),
  redeemInvite: (...args: unknown[]) => redeemInvite(...args),
}));

import { POST } from "./route";

const TOKEN = "t".repeat(43);
const post = (body: unknown) =>
  POST(
    new Request("http://x/api/adventures/join", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );

describe("joining from a link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser.mockResolvedValue({ id: "u", email: null, displayName: "Bob" });
  });

  it("needs a signed-in person — the link alone is never enough", async () => {
    currentUser.mockResolvedValue(null);
    expect((await post({ token: TOKEN })).status).toBe(401);
    expect(redeemInvite).not.toHaveBeenCalled();
  });

  it("refuses something that is not a token without asking the database", async () => {
    expect((await post({ token: "../x" })).status).toBe(400);
    expect(describeInvite).not.toHaveBeenCalled();
  });

  it("uses the kind's listing default, under the person's own name", async () => {
    describeInvite.mockResolvedValue({ state: "valid", kind: "conference" });
    redeemInvite.mockResolvedValue("adv");
    const response = await post({ token: TOKEN });
    expect(await response.json()).toEqual({ id: "adv" });
    expect(redeemInvite.mock.calls[0][2]).toEqual({
      displayName: "Bob",
      visibility: "hidden",
    });
  });

  it("lets the joiner choose to be listed", async () => {
    describeInvite.mockResolvedValue({ state: "valid", kind: "conference" });
    redeemInvite.mockResolvedValue("adv");
    await post({ token: TOKEN, visibility: "members" });
    expect(redeemInvite.mock.calls[0][2].visibility).toBe("members");
  });

  it("says gone (410) for a dead link and unknown (404) for no link", async () => {
    describeInvite.mockResolvedValue({
      state: "used-up",
      kind: "hockey-night",
    });
    redeemInvite.mockResolvedValue(null);
    expect((await post({ token: TOKEN })).status).toBe(410);
    describeInvite.mockResolvedValue(null);
    expect((await post({ token: TOKEN })).status).toBe(404);
  });
});
