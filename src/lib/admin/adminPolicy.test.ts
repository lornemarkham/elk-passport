import { describe, expect, it } from "vitest";
import {
  adminVerdict,
  isAdminSurface,
  parseAdminEmails,
  statusFor,
} from "./adminPolicy";

const verified = (email: string) => ({
  email,
  email_confirmed_at: "2026-10-01T00:00:00Z",
});

describe("isAdminSurface", () => {
  it.each([
    "/admin",
    "/admin/",
    "/admin/duplicates",
    "/ADMIN/Entities/x",
    "/api/admin/merge",
    "/Api/Admin/merge",
    "/explorer",
    "/explorer/abc",
  ])("guards %s", (path) => expect(isAdminSurface(path)).toBe(true));

  it.each([
    "/",
    "/discovery",
    "/administrator-guide",
    "/api/adminx",
    "/api/session/admin",
    "/explorers",
    "/conferences/1/admin",
  ])("leaves %s alone", (path) => expect(isAdminSurface(path)).toBe(false));
});

describe("adminVerdict", () => {
  const list = "Lorne@Example.com, second@example.com";

  it("admits a verified, listed address, any case", () => {
    expect(adminVerdict(verified("LORNE@example.COM"), list)).toEqual({
      ok: true,
      email: "lorne@example.com",
    });
  });

  it("refuses the signed-out", () => {
    expect(adminVerdict(null, list)).toEqual({
      ok: false,
      reason: "signed-out",
    });
  });

  it("refuses a listed address that was never verified", () => {
    expect(
      adminVerdict(
        { email: "lorne@example.com", email_confirmed_at: null },
        list,
      ),
    ).toEqual({ ok: false, reason: "unverified" });
  });

  it("refuses an unlisted address, including near-misses", () => {
    for (const email of [
      "x@example.com",
      "lorne@example.com.evil.io",
      "xlorne@example.com",
    ]) {
      expect(adminVerdict(verified(email), list)).toEqual({
        ok: false,
        reason: "not-approved",
      });
    }
  });

  it("refuses a user with no email", () => {
    expect(
      adminVerdict({ email: null, email_confirmed_at: "x" }, list).ok,
    ).toBe(false);
  });

  it("is closed, not open, when the allowlist is unset or empty", () => {
    for (const raw of [undefined, "", "  ", ",;", "not-an-email"]) {
      expect(adminVerdict(verified("lorne@example.com"), raw)).toEqual({
        ok: false,
        reason: "not-configured",
      });
    }
  });

  it("maps refusals to statuses", () => {
    expect(statusFor("signed-out")).toBe(401);
    expect(statusFor("not-approved")).toBe(403);
    expect(statusFor("not-configured")).toBe(403);
  });
});

describe("parseAdminEmails", () => {
  it("splits on commas, spaces and semicolons", () => {
    expect([...parseAdminEmails("a@x.io; B@x.io  c@x.io,")]).toEqual([
      "a@x.io",
      "b@x.io",
      "c@x.io",
    ]);
  });
});
