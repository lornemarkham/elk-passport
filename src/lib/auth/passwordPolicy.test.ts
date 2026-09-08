import { describe, expect, it } from "vitest";
import {
  friendlyAuthError,
  MIN_PASSWORD_LENGTH,
  passwordProblem,
} from "./passwordPolicy";

describe("what Passport asks of a password", () => {
  it("accepts one long enough", () => {
    expect(passwordProblem("a".repeat(MIN_PASSWORD_LENGTH))).toBeUndefined();
  });

  it("says how long, rather than that it is wrong", () => {
    expect(passwordProblem("short")).toContain(String(MIN_PASSWORD_LENGTH));
  });

  it("is stricter than Supabase's own minimum of 6, so the server never overrules the form", () => {
    expect(MIN_PASSWORD_LENGTH).toBeGreaterThan(6);
  });
});

describe("turning an auth error into something actionable", () => {
  it("points a failed sign-in at the reset link", () => {
    // The exact failure that stopped a real sign-in: accurate, and useless.
    const said = friendlyAuthError("Invalid login credentials");
    expect(said).toContain("reset");
  });

  it("does not reveal whether an account exists", () => {
    const said = friendlyAuthError("Invalid login credentials").toLowerCase();
    expect(said).not.toContain("no account");
    expect(said).not.toContain("not found");
    expect(said).not.toContain("wrong password");
  });

  it("passes through anything it does not recognise, rather than inventing", () => {
    expect(friendlyAuthError("Something unusual happened")).toBe(
      "Something unusual happened",
    );
  });
});
