import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  experienceForPath,
  experienceHomeFor,
  experienceRewriteFor,
} from "./experience-domains";

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

/**
 * **The header is the whole of how a server component learns about a rewrite.**
 *
 * A rewrite changes what is rendered and leaves the URL alone, so nothing
 * downstream can work out from the request that `iamoctober.com/` is
 * October's Discover. The middleware says so on the request, and these pin
 * the two halves of that contract: the name is shared rather than typed twice,
 * and an incoming value is never trusted.
 */
describe("the experience-path header", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("is a single shared constant, so nobody retypes the name", async () => {
    const { EXPERIENCE_PATH_HEADER } = await import("./experience-domains");
    expect(EXPERIENCE_PATH_HEADER).toBe("x-experience-path");

    const middleware = read("middleware.ts");
    const layout = read("src/app/october/layout.tsx");
    for (const [where, source] of [
      ["middleware", middleware],
      ["October layout", layout],
    ] as const) {
      expect(source, where).toContain("EXPERIENCE_PATH_HEADER");
      // The literal must appear once, in the module that owns it.
      expect(source, where).not.toContain('"x-experience-path"');
    }
  });

  it("is removed when there is no rewrite, so a forged one cannot survive", async () => {
    const middleware = read("middleware.ts");
    // Set on a rewrite, deleted otherwise — never merely read through.
    expect(middleware).toMatch(/headers\.set\(EXPERIENCE_PATH_HEADER/);
    expect(middleware).toMatch(/headers\.delete\(EXPERIENCE_PATH_HEADER\)/);
  });

  it("carries exactly what the mapping decided, for every spelling of the host", async () => {
    const { EXPERIENCE_PATH_HEADER } = await import("./experience-domains");
    expect(EXPERIENCE_PATH_HEADER.startsWith("x-")).toBe(true);
    for (const host of ["iamoctober.com", "www.iamoctober.com"]) {
      expect(experienceRewriteFor(host, "/")).toBe("/october/discover");
    }
    // And nothing to carry anywhere else.
    expect(experienceRewriteFor("elk-passport.vercel.app", "/")).toBeNull();
    expect(experienceRewriteFor("localhost:3100", "/")).toBeNull();
  });
});

/**
 * **Which experience a path belongs to.**
 *
 * This exists because `/account` is shared and looks like Passport. The
 * production defect it closes: October's nav linked a bare `/account`, so a
 * signed-in October reader tapped their own name and landed on a cream page
 * titled Passport whose only exit was Passport's Discovery.
 */
describe("experienceForPath", () => {
  it("recognises October's own pages", () => {
    for (const path of [
      "/october",
      "/october/discover",
      "/october/mine",
      "/october/movies/jaws",
    ]) {
      expect(experienceForPath(path)?.name).toBe("October");
    }
  });

  it("leaves a Passport path to Passport's own wording", () => {
    for (const path of [
      "/discovery",
      "/boards",
      "/account",
      "/",
      "/passport/x",
    ]) {
      expect(experienceForPath(path)).toBeNull();
    }
  });

  it("does not claim a path that merely starts with the same letters", () => {
    // `/octoberfest` is not October, and a bare `startsWith` would say it was.
    expect(experienceForPath("/octoberfest")).toBeNull();
  });

  it("says nothing when there is nothing to read", () => {
    expect(experienceForPath(null)).toBeNull();
    expect(experienceForPath(undefined)).toBeNull();
    expect(experienceForPath("")).toBeNull();
  });

  it("names home the same way the host lookup does, from one table", () => {
    expect(experienceForPath("/october/mine")?.home).toBe(
      experienceHomeFor("iamoctober.com"),
    );
  });
});
