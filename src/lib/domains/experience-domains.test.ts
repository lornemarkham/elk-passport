import { describe, expect, it } from "vitest";
import { experienceRewriteFor } from "./experience-domains";

describe("experienceRewriteFor", () => {
  it("opens iamoctober.com on October Discover", () => {
    expect(experienceRewriteFor("iamoctober.com", "/")).toBe(
      "/october/discover",
    );
  });

  it("treats www, case, port and a trailing dot as the same domain", () => {
    for (const host of [
      "www.iamoctober.com",
      "IAmOctober.com",
      "iamoctober.com:443",
      "iamoctober.com.",
    ]) {
      expect(experienceRewriteFor(host, "/")).toBe("/october/discover");
    }
  });

  it("leaves every other path on the domain alone", () => {
    for (const path of [
      "/october/discover",
      "/october/mine",
      "/auth",
      "/api/october/x",
    ]) {
      expect(experienceRewriteFor("iamoctober.com", path)).toBeNull();
    }
  });

  it("leaves Passport's own hosts on Passport's homepage", () => {
    for (const host of [
      "elk-passport.vercel.app",
      "elk-passport-git-main-lornemarkham.vercel.app",
      "localhost:3100",
      "notiamoctober.com",
      "iamoctober.com.evil.example",
    ]) {
      expect(experienceRewriteFor(host, "/")).toBeNull();
    }
  });

  it("serves the request as asked when there is no host", () => {
    expect(experienceRewriteFor(null, "/")).toBeNull();
    expect(experienceRewriteFor(undefined, "/")).toBeNull();
    expect(experienceRewriteFor("", "/")).toBeNull();
  });
});
