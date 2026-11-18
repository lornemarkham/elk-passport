import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { answerDateNight } = vi.hoisted(() => ({ answerDateNight: vi.fn() }));
vi.mock("@/lib/date-night/store", () => ({
  answerDateNight,
  NotReady: class NotReady extends Error {},
}));

import { POST } from "./route";

function post(slug: string, body = "{}") {
  return POST(
    new Request(`http://t/api/date-night/${slug}`, { method: "POST", body }),
    {
      params: Promise.resolve({ slug }),
    },
  );
}

describe("POST /api/date-night/[slug]", () => {
  it("takes no answers for a personal night, and says it does not exist", async () => {
    const res = await post("lorne-and-jess");
    expect(res.status).toBe(404);
    expect(answerDateNight).not.toHaveBeenCalled();
  });
});
