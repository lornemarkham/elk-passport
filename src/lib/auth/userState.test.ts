import { describe, expect, it } from "vitest";
import { displayNameOf } from "./currentUser";
import { DEFAULT_NEXT, safeNext } from "./safeNext";

/**
 * **What Passport is willing to call you, and where it is willing to send you.**
 *
 * Both are small, and both are the kind of small that goes wrong quietly: a
 * name that falls back to a uuid, or a `next=` that walks somebody off the site
 * moments after they typed a password.
 */
describe("what to call the person on screen", () => {
  it("uses the name they gave, when they gave one", () => {
    expect(displayNameOf("Ana", "ana@example.com")).toBe("Ana");
  });

  it("falls back to the local part of the email, never the uuid", () => {
    expect(displayNameOf(undefined, "ana@example.com")).toBe("ana");
  });

  it("treats a blank display name as no display name", () => {
    // Supabase happily stores "   ". Rendering it produces a badge with a
    // sign-out button next to nothing at all.
    expect(displayNameOf("   ", "ana@example.com")).toBe("ana");
  });

  it("still has something to render with neither", () => {
    expect(displayNameOf(undefined, null)).toBe("Traveller");
  });
});

describe("where a sign-in returns to", () => {
  it("keeps a same-site path, so you land where you left", () => {
    expect(safeNext("/places/kekuli-bay")).toBe("/places/kekuli-bay");
    expect(safeNext("/discovery?q=beach")).toBe("/discovery?q=beach");
  });

  it("defaults when there is nothing to go back to", () => {
    expect(safeNext(null)).toBe(DEFAULT_NEXT);
    expect(safeNext("")).toBe(DEFAULT_NEXT);
  });

  it("refuses a protocol-relative path, which looks relative and is not", () => {
    expect(safeNext("//evil.example/phish")).toBe(DEFAULT_NEXT);
    expect(safeNext("/\\evil.example")).toBe(DEFAULT_NEXT);
  });

  it("refuses an absolute URL", () => {
    expect(safeNext("https://evil.example")).toBe(DEFAULT_NEXT);
    expect(safeNext("javascript:alert(1)")).toBe(DEFAULT_NEXT);
  });
});
