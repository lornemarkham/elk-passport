import { describe, expect, it } from "vitest";
import { adminEnvironment } from "./adminEnvironment";

const full = {
  NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  ADMIN_EMAILS: "a@x.io",
  ADMIN_TOKEN: "t",
  ATLAS_SERVICE_TOKEN: "s",
  ATLAS_API_URL: "https://atlas.example.com",
  NODE_ENV: "production",
};

describe("adminEnvironment", () => {
  it("is ready when everything is set", () => {
    expect(adminEnvironment(full)).toEqual({
      ready: true,
      missing: [],
      warnings: [],
    });
  });

  it("names what is missing, never values", () => {
    const report = adminEnvironment({
      ...full,
      ADMIN_TOKEN: "",
      ATLAS_API_URL: undefined,
    });
    expect(report.ready).toBe(false);
    expect(report.missing).toEqual(["ADMIN_TOKEN", "ATLAS_API_URL"]);
    expect(JSON.stringify(report)).not.toContain("anon");
  });

  it("warns about localhost, a /api suffix, and public admin variables", () => {
    const report = adminEnvironment({
      ...full,
      ATLAS_API_URL: "http://localhost:4000/api",
      NEXT_PUBLIC_ADMIN_EMAILS: "a@x.io",
      NEXT_PUBLIC_ADMIN_TOKEN: "oops",
    });
    expect(report.warnings.join("\n")).toMatch(/localhost/);
    expect(report.warnings.join("\n")).toMatch(/\/api/);
    expect(report.warnings.join("\n")).toMatch(/NEXT_PUBLIC_ADMIN_EMAILS/);
    expect(report.warnings.join("\n")).toMatch(/NEXT_PUBLIC_ADMIN_TOKEN/);
  });
});
