import { describe, expect, it } from "vitest";
import { canEdit, canShare, type BoardRole } from "./boardAccess";

/**
 * **Three roles, and the two questions asked about them.**
 *
 * Small enough to look trivial, which is exactly why it is pinned: every route
 * that changes a board asks one of these, and widening either by accident is a
 * silent privilege escalation rather than a visible bug.
 */
const ROLES: readonly BoardRole[] = ["owner", "editor", "viewer"];

describe("who may change a board's contents", () => {
  it("is the owner and the editor, and nobody else", () => {
    expect(ROLES.filter(canEdit)).toEqual(["owner", "editor"]);
  });

  it("never a viewer", () => {
    expect(canEdit("viewer")).toBe(false);
  });
});

describe("who may share, rename or delete a board", () => {
  it("is the owner alone", () => {
    expect(ROLES.filter(canShare)).toEqual(["owner"]);
  });

  it("not an editor — changing what everyone sees is a different power from adding a place", () => {
    expect(canShare("editor")).toBe(false);
  });
});
