import { beforeEach, describe, expect, it, vi } from "vitest";

const currentUser = vi.fn();
const roleIn = vi.fn();
const saveDay = vi.fn();
const addIdeas = vi.fn();

vi.mock("@/lib/auth/currentUser", () => ({ currentUser: () => currentUser() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({}),
}));
vi.mock("@/lib/adventures/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/adventures/store")>()),
  roleIn: (...args: unknown[]) => roleIn(...args),
  saveDay: (...args: unknown[]) => saveDay(...args),
  addIdeas: (...args: unknown[]) => addIdeas(...args),
}));

import { POST } from "./route";
import { Unavailable } from "@/lib/adventures/store";

const DAY =
  "stops=a%3A1%2Cb-2&say=Saturday+with+a+five-year-old&age=5&at=vernon&on=2026-10-25";
const post = (body: unknown) =>
  POST(
    new Request("http://x/api/adventures/adv12345/days", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "adv12345" }) },
  );

describe("bringing a built day back to its adventure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser.mockResolvedValue({ id: "u", email: null, displayName: "A" });
  });

  it("needs a signed-in person", async () => {
    currentUser.mockResolvedValue(null);
    expect((await post({ query: DAY })).status).toBe(401);
    expect(saveDay).not.toHaveBeenCalled();
  });

  it("refuses what is not a day without asking the database", async () => {
    for (const query of [
      "say=x&on=2026-10-25",
      "stops=a&on=2026-10-25",
      "stops=a&say=x",
      "stops=has%20space&say=x&on=2026-10-25",
    ]) {
      expect((await post({ query })).status).toBe(400);
    }
    expect((await post({})).status).toBe(400);
    expect(roleIn).not.toHaveBeenCalled();
  });

  it("saves the owner's day: its stops in order, and how it was asked for", async () => {
    roleIn.mockResolvedValue("owner");
    const response = await post({ query: DAY });
    expect(await response.json()).toEqual({
      saved: "day",
      onDay: "2026-10-25",
    });
    const [, id, me, input] = saveDay.mock.calls[0]!;
    expect([id, me]).toEqual(["adv12345", "u"]);
    expect(input.stops).toEqual(["a:1", "b-2"]);
    expect(input.onDay).toBe("2026-10-25");
    expect(new URLSearchParams(input.ask).has("stops")).toBe(false);
    expect(addIdeas).not.toHaveBeenCalled();
  });

  it("turns anybody else's day into suggestions for the owner", async () => {
    roleIn.mockResolvedValue("participant");
    addIdeas.mockResolvedValue(2);
    const response = await post({ query: DAY });
    expect(await response.json()).toEqual({ saved: "suggested", added: 2 });
    expect(addIdeas.mock.calls[0]![3]).toEqual(["a:1", "b-2"]);
    expect(saveDay).not.toHaveBeenCalled();
  });

  it("says not found for an adventure that isn't theirs, and 503 when it can't ask", async () => {
    roleIn.mockResolvedValue(null);
    expect((await post({ query: DAY })).status).toBe(404);
    roleIn.mockRejectedValue(new Unavailable("relation does not exist"));
    expect((await post({ query: DAY })).status).toBe(503);
  });
});
