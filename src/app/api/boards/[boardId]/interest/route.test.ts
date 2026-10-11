import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * **Who may raise a hand on a board, and on what.**
 *
 * Members only; only things on the board; a name only when asked; and an
 * unavailable store is a 503, never an empty "nobody is interested".
 */
const requireUser = vi.fn();
const accessToBoard = vi.fn();
const listBoardItemsFor = vi.fn();
const readBoardInterest = vi.fn();
const markInterest = vi.fn();
const clearInterest = vi.fn();
const readBoardPlans = vi.fn();

vi.mock("@/lib/auth/requireUser", () => ({ requireUser: () => requireUser() }));
vi.mock("@/lib/collaboration/boardAccess", () => ({
  accessToBoard: (...a: unknown[]) => accessToBoard(...a),
}));
vi.mock("@/lib/data/boards-server", () => ({
  listBoardItemsFor: (...a: unknown[]) => listBoardItemsFor(...a),
}));
vi.mock("@/lib/data/boards-interest-server", async () => {
  class InterestUnavailable extends Error {}
  return {
    InterestUnavailable,
    readBoardInterest: (...a: unknown[]) => readBoardInterest(...a),
    markInterest: (...a: unknown[]) => markInterest(...a),
    clearInterest: (...a: unknown[]) => clearInterest(...a),
  };
});

vi.mock("@/lib/data/boards-plans-server", () => ({
  readBoardPlans: (...a: unknown[]) => readBoardPlans(...a),
}));

const BOARD = "board-1";
const ENV = "PASSPORT_BOARD_SYCLE_VANCOUVER_2026";
const HOCKEY = "sycle-vancouver-2026:staff-hockey";
const me = { id: "me", email: "me@x", displayName: "Me" };

const context = { params: Promise.resolve({ boardId: BOARD }) };
const body = (b: unknown) =>
  new Request("http://x", { method: "PUT", body: JSON.stringify(b) });

const route = () => import("./route");

beforeEach(() => {
  vi.resetModules();
  for (const f of [
    requireUser,
    accessToBoard,
    listBoardItemsFor,
    readBoardInterest,
    markInterest,
    clearInterest,
    readBoardPlans,
  ])
    f.mockReset();
  readBoardPlans.mockResolvedValue({ rows: [], memberIds: new Set() });
  process.env[ENV] = BOARD;
  requireUser.mockResolvedValue({ user: me });
  accessToBoard.mockResolvedValue({ role: "viewer", ownerId: "owner" });
  listBoardItemsFor.mockResolvedValue([{ experienceId: "atlas-hike" }]);
  readBoardInterest.mockResolvedValue({
    rows: [{ itemId: HOCKEY, userId: "me", shownAs: null }],
    memberIds: new Set(["me"]),
  });
});

describe("GET", () => {
  it("asks a visitor to sign in", async () => {
    requireUser.mockResolvedValue({
      response: NextResponse.json({}, { status: 401 }),
    });
    const res = await (await route()).GET(new Request("http://x"), context);
    expect(res.status).toBe(401);
    expect(readBoardInterest).not.toHaveBeenCalled();
  });

  it("tells a non-member nothing at all", async () => {
    accessToBoard.mockResolvedValue(null);
    const res = await (await route()).GET(new Request("http://x"), context);
    expect(res.status).toBe(404);
    expect(readBoardInterest).not.toHaveBeenCalled();
  });

  it("gives a member the board's picture", async () => {
    const res = await (await route()).GET(new Request("http://x"), context);
    const json = await res.json();
    expect(json.summaries[HOCKEY]).toMatchObject({ count: 1, youAreIn: true });
    expect(json.kindred).toEqual([]);
  });

  it("is a 503 — not an empty board — when interest cannot be read", async () => {
    const { InterestUnavailable } =
      await import("@/lib/data/boards-interest-server");
    readBoardInterest.mockRejectedValue(new InterestUnavailable("no table"));
    const res = await (await route()).GET(new Request("http://x"), context);
    expect(res.status).toBe(503);
  });
});

describe("PUT", () => {
  it("lets a viewer say they're interested in the staff game, unnamed by default", async () => {
    const res = await (await route()).PUT(body({ itemId: HOCKEY }), context);
    expect(res.status).toBe(200);
    expect(markInterest).toHaveBeenCalledWith(me, BOARD, HOCKEY, null);
  });

  it("names them only when they ask", async () => {
    await (
      await route()
    ).PUT(body({ itemId: HOCKEY, showName: true }), context);
    expect(markInterest).toHaveBeenCalledWith(me, BOARD, HOCKEY, "Me");
  });

  it("accepts an adventure saved to the board", async () => {
    const res = await (
      await route()
    ).PUT(body({ itemId: "atlas-hike" }), context);
    expect(res.status).toBe(200);
  });

  it('accepts "I\'m in" on a day shared to the board', async () => {
    readBoardPlans.mockResolvedValue({
      rows: [{ id: "p1", userId: "sam" }],
      memberIds: new Set(),
    });
    const res = await (await route()).PUT(body({ itemId: "plan:p1" }), context);
    expect(res.status).toBe(200);
    expect(markInterest).toHaveBeenCalled();
  });

  it("refuses a shared day that is not on this board", async () => {
    const res = await (await route()).PUT(body({ itemId: "plan:p1" }), context);
    expect(res.status).toBe(404);
  });

  it("still lets the staff game be marked when shared days are not switched on", async () => {
    readBoardPlans.mockRejectedValue(new Error("no table"));
    const res = await (await route()).PUT(body({ itemId: HOCKEY }), context);
    expect(res.status).toBe(200);
  });

  it("refuses anything that is not on this board", async () => {
    const res = await (
      await route()
    ).PUT(body({ itemId: "elsewhere" }), context);
    expect(res.status).toBe(404);
    expect(markInterest).not.toHaveBeenCalled();
  });

  it("still lets the staff game be marked when Atlas is down", async () => {
    listBoardItemsFor.mockRejectedValue(new Error("down"));
    const res = await (await route()).PUT(body({ itemId: HOCKEY }), context);
    expect(res.status).toBe(200);
  });

  it("does not offer the staff game on a board that is not the gathering's", async () => {
    delete process.env[ENV];
    const res = await (await route()).PUT(body({ itemId: HOCKEY }), context);
    expect(res.status).toBe(404);
  });

  it("refuses a malformed request", async () => {
    const res = await (await route()).PUT(body({}), context);
    expect(res.status).toBe(400);
  });

  it("refuses a non-member", async () => {
    accessToBoard.mockResolvedValue(null);
    const res = await (await route()).PUT(body({ itemId: HOCKEY }), context);
    expect(res.status).toBe(404);
    expect(markInterest).not.toHaveBeenCalled();
  });
});

describe("DELETE", () => {
  it("always lets somebody take their hand down", async () => {
    const res = await (
      await route()
    ).DELETE(
      new Request("http://x", {
        method: "DELETE",
        body: JSON.stringify({ itemId: "no-longer-on-board" }),
      }),
      context,
    );
    expect(res.status).toBe(200);
    expect(clearInterest).toHaveBeenCalledWith(me, BOARD, "no-longer-on-board");
  });
});
