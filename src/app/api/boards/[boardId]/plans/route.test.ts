import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * **Shared days: members read, editors share, the sharer or owner takes down.**
 *
 * An unavailable store is a 503, never an empty "nobody has shared a day".
 */
const requireUser = vi.fn();
const accessToBoard = vi.fn();
const readBoardPlans = vi.fn();
const sharePlan = vi.fn();
const withdrawPlan = vi.fn();
const recordEvent = vi.fn();

vi.mock("@/lib/auth/requireUser", () => ({ requireUser: () => requireUser() }));
vi.mock("@/lib/collaboration/boardAccess", () => ({
  accessToBoard: (...a: unknown[]) => accessToBoard(...a),
  canEdit: (role: string) => role === "owner" || role === "editor",
}));
vi.mock("@/lib/collaboration/events", () => ({
  recordEvent: (...a: unknown[]) => recordEvent(...a),
}));
vi.mock("@/lib/data/boards-plans-server", () => {
  class PlansUnavailable extends Error {}
  return {
    PlansUnavailable,
    readBoardPlans: (...a: unknown[]) => readBoardPlans(...a),
    sharePlan: (...a: unknown[]) => sharePlan(...a),
    withdrawPlan: (...a: unknown[]) => withdrawPlan(...a),
  };
});

const me = { id: "me", email: "me@x", displayName: "Lorne" };
const context = { params: Promise.resolve({ boardId: "b" }) };
const route = () => import("./route");
const post = (body: unknown) =>
  new Request("http://x", { method: "POST", body: JSON.stringify(body) });

const SAMS_DAY = {
  id: "p-sam",
  userId: "sam",
  title: null,
  dayQuery: "stops=a%2Cb",
  shownAs: null,
  createdAt: "2026-10-11T00:00:00Z",
};

beforeEach(() => {
  vi.resetModules();
  for (const f of [
    requireUser,
    accessToBoard,
    readBoardPlans,
    sharePlan,
    withdrawPlan,
    recordEvent,
  ])
    f.mockReset();
  requireUser.mockResolvedValue({ user: me });
  accessToBoard.mockResolvedValue({ role: "editor", ownerId: "owner" });
  readBoardPlans.mockResolvedValue({
    rows: [SAMS_DAY],
    memberIds: new Set(["me", "sam"]),
  });
  withdrawPlan.mockResolvedValue(true);
});

describe("GET", () => {
  it("tells a non-member nothing", async () => {
    accessToBoard.mockResolvedValue(null);
    const res = await (await route()).GET(new Request("http://x"), context);
    expect(res.status).toBe(404);
    expect(readBoardPlans).not.toHaveBeenCalled();
  });

  it("asks a visitor to sign in", async () => {
    requireUser.mockResolvedValue({
      response: NextResponse.json({}, { status: 401 }),
    });
    const res = await (await route()).GET(new Request("http://x"), context);
    expect(res.status).toBe(401);
  });

  it("lists the board's days without anybody's id", async () => {
    const res = await (await route()).GET(new Request("http://x"), context);
    const plans = await res.json();
    expect(plans).toHaveLength(1);
    expect(JSON.stringify(plans)).not.toContain('"sam"');
  });

  it("is a 503, not an empty list, when the store is not there", async () => {
    const { PlansUnavailable } = await import("@/lib/data/boards-plans-server");
    readBoardPlans.mockRejectedValue(new PlansUnavailable("missing table"));
    const res = await (await route()).GET(new Request("http://x"), context);
    expect(res.status).toBe(503);
  });
});

describe("POST", () => {
  it("shares a printed day, unnamed unless asked", async () => {
    const res = await (
      await route()
    ).POST(post({ link: "/go/print?stops=x,y&at=vancouver&junk=1" }), context);
    expect(res.status).toBe(201);
    expect(sharePlan).toHaveBeenCalledWith(me, "b", {
      dayQuery: "stops=x%2Cy&at=vancouver",
      title: null,
      shownAs: null,
    });
    expect(recordEvent).toHaveBeenCalledOnce();
  });

  it("names the sharer when they ask", async () => {
    await (
      await route()
    ).POST(post({ link: "/go/print?stops=x", showName: true }), context);
    expect(sharePlan.mock.calls[0]![2].shownAs).toBe("Lorne");
  });

  it("refuses what is not a day from Go have a day", async () => {
    const res = await (
      await route()
    ).POST(post({ link: "https://elsewhere.example/" }), context);
    expect(res.status).toBe(400);
    expect(sharePlan).not.toHaveBeenCalled();
  });

  it("refuses a viewer — they were invited to look", async () => {
    accessToBoard.mockResolvedValue({ role: "viewer", ownerId: "owner" });
    const res = await (
      await route()
    ).POST(post({ link: "/go/print?stops=x" }), context);
    expect(res.status).toBe(403);
    expect(sharePlan).not.toHaveBeenCalled();
  });
});

describe("DELETE", () => {
  const del = (id: string) =>
    new Request(`http://x/?id=${id}`, { method: "DELETE" });

  it("lets the sharer take their day down", async () => {
    readBoardPlans.mockResolvedValue({
      rows: [{ ...SAMS_DAY, id: "mine", userId: "me" }],
      memberIds: new Set(["me"]),
    });
    const res = await (await route()).DELETE(del("mine"), context);
    expect(res.status).toBe(200);
    expect(withdrawPlan).toHaveBeenCalledWith("b", "mine");
  });

  it("lets the owner take anybody's day down", async () => {
    accessToBoard.mockResolvedValue({ role: "owner", ownerId: "me" });
    const res = await (await route()).DELETE(del("p-sam"), context);
    expect(res.status).toBe(200);
  });

  it("treats somebody else's day as no such day for an editor", async () => {
    const res = await (await route()).DELETE(del("p-sam"), context);
    expect(res.status).toBe(404);
    expect(withdrawPlan).not.toHaveBeenCalled();
  });

  it("does not claim success when nothing was removed", async () => {
    accessToBoard.mockResolvedValue({ role: "owner", ownerId: "me" });
    withdrawPlan.mockResolvedValue(false);
    const res = await (await route()).DELETE(del("p-sam"), context);
    expect(res.status).toBe(404);
    expect(recordEvent).not.toHaveBeenCalled();
  });
});
