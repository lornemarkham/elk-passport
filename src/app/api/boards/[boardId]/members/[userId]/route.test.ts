import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * **Leaving needs nobody's permission; removing somebody is the owner's.**
 *
 * And a leave Passport could not carry out is reported as exactly that —
 * never "you've left" while everyone can still see you.
 */
const requireUser = vi.fn();
const accessToBoard = vi.fn();
const removeMember = vi.fn();
const leaveBoard = vi.fn();
const recordEvent = vi.fn();

vi.mock("@/lib/auth/requireUser", () => ({ requireUser: () => requireUser() }));
vi.mock("@/lib/collaboration/boardAccess", () => ({
  accessToBoard: (...a: unknown[]) => accessToBoard(...a),
  removeMember: (...a: unknown[]) => removeMember(...a),
}));
vi.mock("@/lib/collaboration/events", () => ({
  CORE_EVENT_KINDS: { memberRemoved: "member-removed" },
  recordEvent: (...a: unknown[]) => recordEvent(...a),
}));
vi.mock("@/lib/data/boards-membership-server", () => {
  class LeaveUnavailable extends Error {}
  return {
    LeaveUnavailable,
    leaveBoard: (...a: unknown[]) => leaveBoard(...a),
  };
});

const me = { id: "me", email: "me@x", displayName: "Me" };
const ctx = (userId: string) => ({
  params: Promise.resolve({ boardId: "b", userId }),
});
const del = async (userId: string) =>
  (await import("./route")).DELETE(new Request("http://x"), ctx(userId));

beforeEach(() => {
  vi.resetModules();
  for (const f of [
    requireUser,
    accessToBoard,
    removeMember,
    leaveBoard,
    recordEvent,
  ])
    f.mockReset();
  requireUser.mockResolvedValue({ user: me });
  accessToBoard.mockResolvedValue({ role: "editor", ownerId: "owner" });
});

describe("DELETE a member", () => {
  it("asks a visitor to sign in", async () => {
    requireUser.mockResolvedValue({
      response: NextResponse.json({}, { status: 401 }),
    });
    expect((await del("me")).status).toBe(401);
  });

  it("tells a non-member nothing", async () => {
    accessToBoard.mockResolvedValue(null);
    expect((await del("me")).status).toBe(404);
    expect(leaveBoard).not.toHaveBeenCalled();
  });

  it("lets a member leave as `me`, without knowing their own id", async () => {
    const res = await del("me");
    expect(res.status).toBe(204);
    expect(leaveBoard).toHaveBeenCalledWith(me, "b");
    expect(removeMember).not.toHaveBeenCalled();
    // The event does not carry who left, and is written while they are still
    // a member who may write one.
    expect(recordEvent.mock.calls[0]![0].payload).toEqual({ left: true });
    expect(recordEvent.mock.invocationCallOrder[0]!).toBeLessThan(
      leaveBoard.mock.invocationCallOrder[0]!,
    );
  });

  it("lets a viewer leave too — leaving is not editing", async () => {
    accessToBoard.mockResolvedValue({ role: "viewer", ownerId: "owner" });
    expect((await del("me")).status).toBe(204);
  });

  it("says plainly when Passport cannot take them off yet", async () => {
    const { LeaveUnavailable } =
      await import("@/lib/data/boards-membership-server");
    leaveBoard.mockRejectedValue(new LeaveUnavailable("rls"));
    const res = await del("me");
    expect(res.status).toBe(503);
    expect((await res.json()).message).toMatch(/can't take you off/);
  });

  it("will not let the owner leave their own board", async () => {
    accessToBoard.mockResolvedValue({ role: "owner", ownerId: "me" });
    expect((await del("me")).status).toBe(400);
    expect(leaveBoard).not.toHaveBeenCalled();
  });

  it("lets the owner remove somebody else", async () => {
    accessToBoard.mockResolvedValue({ role: "owner", ownerId: "me" });
    expect((await del("sam")).status).toBe(204);
    expect(removeMember).toHaveBeenCalledWith("b", "sam");
  });

  it("refuses an editor removing somebody else", async () => {
    expect((await del("sam")).status).toBe(403);
    expect(removeMember).not.toHaveBeenCalled();
  });
});
