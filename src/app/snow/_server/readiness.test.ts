import { describe, expect, it } from "vitest";
import { readinessFrom } from "./readiness";

describe("shared days readiness", () => {
  it("is ready when the table answers permission denied (it exists, anon holds nothing)", () => {
    expect(readinessFrom({ code: "42501" })).toBe(true);
  });
  it("is ready when a signed-in caller's query simply succeeds (the table is there)", () => {
    expect(readinessFrom(null)).toBe(true);
  });
  it("is not ready when the table is not in the schema (migration not applied)", () => {
    expect(readinessFrom({ code: "PGRST205" })).toBe(false);
    expect(readinessFrom({ code: "42P01" })).toBe(false);
  });
  it("is not ready for anything it does not understand: no network, no Supabase, a surprise", () => {
    expect(readinessFrom({ code: "PGRST301" })).toBe(false);
    expect(readinessFrom({})).toBe(false);
  });
});
