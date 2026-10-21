import { describe, expect, it } from "vitest";
import { decideRemoval } from "./boards-membership";

/** Leaving is any member's; removing somebody else is the owner's alone. */
describe("decideRemoval", () => {
  const OWNER = "owner";

  it("lets an editor or a viewer leave, with nobody's permission", () => {
    expect(decideRemoval({ id: "e", role: "editor" }, OWNER, "e")).toEqual({
      kind: "leave",
    });
    expect(decideRemoval({ id: "v", role: "viewer" }, OWNER, "v")).toEqual({
      kind: "leave",
    });
  });

  it("will not let the owner leave a board that would then have nobody to delete it", () => {
    const d = decideRemoval({ id: OWNER, role: "owner" }, OWNER, OWNER);
    expect(d.kind).toBe("refuse");
    expect(d).toMatchObject({ status: 400 });
  });

  it("lets the owner remove anybody else", () => {
    expect(decideRemoval({ id: OWNER, role: "owner" }, OWNER, "x")).toEqual({
      kind: "remove",
    });
  });

  it("refuses a member removing somebody else", () => {
    expect(
      decideRemoval({ id: "e", role: "editor" }, OWNER, "someone"),
    ).toMatchObject({ kind: "refuse", status: 403 });
    expect(
      decideRemoval({ id: "e", role: "editor" }, OWNER, OWNER),
    ).toMatchObject({ kind: "refuse", status: 403 });
  });
});
