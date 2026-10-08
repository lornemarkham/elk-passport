import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_NEXT, safeNext } from "./safeNext";
import { experienceHomeFor } from "@/lib/domains/experience-domains";

/**
 * **Where authentication puts you down.**
 *
 * Two production failures, found by hand after thirteen browser tests said
 * everything was fine:
 *
 * 1. "Sign in to choose" pointed at `/signin`, a route that has never
 *    existed, and dropped the person on Passport's 404.
 * 2. A password reset begun in October finished on `/discovery` — a
 *    different product — because the chain forgot its destination twice and
 *    the fallback was Passport's.
 *
 * Both are navigation contracts, which is why they are pinned here as well as
 * in the browser: a dead href and a wrong default are visible in the source
 * long before anybody clicks them.
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("every sign-in link points at a route that exists", () => {
  const LINKS_TO_AUTH = [
    "src/components/labs/october/LabKeep.tsx",
    "src/components/labs/october/Dealer.tsx",
    "src/components/labs/october/synthesis/TrustMe.tsx",
    "src/components/october/save/KeepOnCard.tsx",
    "src/components/october/detail/SaveToOctober.tsx",
    "src/components/october/discover/HypeSky.tsx",
    "src/components/october/shell/OctoberNav.tsx",
  ];

  it("never sends anybody to /signin", () => {
    // `/signin` was invented in the labs, promoted to production with the
    // synthesis, and was never clicked in a lab because nobody was ever
    // signed out there on purpose.
    for (const file of LINKS_TO_AUTH) {
      expect(read(file), file).not.toContain("/signin");
    }
  });

  it("uses /auth with a next, which is the one convention", () => {
    for (const file of LINKS_TO_AUTH) {
      expect(read(file), file).toMatch(/\/auth\?next=|href="\/auth\?next/);
    }
  });

  it("does not pass returnTo as a query parameter, which no auth route reads", () => {
    // `returnTo` survives as a *prop* name on these components and that is
    // fine — it is the URL parameter that nothing reads. An earlier version
    // of this test matched the JSX `returnTo={...}` and failed on itself.
    for (const file of LINKS_TO_AUTH) {
      expect(read(file), file).not.toMatch(/[?&]returnTo=/);
    }
  });
});

describe("the fallback belongs to the host, not to Passport", () => {
  it("sends an October visitor home to October", () => {
    expect(experienceHomeFor("iamoctober.com")).toBe("/october/discover");
    expect(experienceHomeFor("www.iamoctober.com")).toBe("/october/discover");
  });

  it("leaves ordinary Passport hosts alone", () => {
    for (const host of [
      "elk-passport.vercel.app",
      "localhost:3100",
      "some-preview.vercel.app",
    ]) {
      expect(experienceHomeFor(host), host).toBeNull();
    }
  });

  it("honours an asked-for destination over any fallback", () => {
    expect(safeNext("/october/mine", "/october/discover")).toBe(
      "/october/mine",
    );
  });

  it("falls back to what the caller passed when nothing was asked", () => {
    expect(safeNext(null, "/october/discover")).toBe("/october/discover");
    expect(safeNext("", "/october/discover")).toBe("/october/discover");
  });

  it("still refuses a hostile destination, and refuses it to the fallback", () => {
    // The fallback must not become a way to smuggle one past the guard.
    for (const hostile of [
      "//evil.example",
      "/\\evil.example",
      "https://evil.example",
    ]) {
      expect(safeNext(hostile, "/october/discover"), hostile).toBe(
        "/october/discover",
      );
    }
  });

  it("keeps Passport's own default when no caller says otherwise", () => {
    expect(DEFAULT_NEXT).toBe("/discovery");
    expect(safeNext(null)).toBe("/discovery");
  });
});

describe("the recovery chain carries its destination the whole way", () => {
  it("asks for an update-password that remembers where it started", () => {
    const forgot = read("src/app/auth/forgot/page.tsx");
    expect(forgot).toContain("/auth/update-password?next=");
    expect(forgot).toContain("experienceHomeFor");
  });

  it("hands the destination on to the sign-in that follows", () => {
    const update = read("src/app/auth/update-password/page.tsx");
    expect(update).toContain("password-updated&next=");
    // And never hard-codes a product.
    expect(update).not.toContain('"/discovery"');
  });

  it("gives the callback a host-aware fallback", () => {
    const callback = read("src/app/auth/callback/route.ts");
    expect(callback).toContain("experienceHomeFor");
  });
});

describe("no dead Google control while the provider is off", () => {
  it("renders nothing rather than something disabled", () => {
    const button = read("src/components/auth/GoogleButton.tsx");
    expect(button).toContain("googleSignInAvailable");
    expect(button).toMatch(/if \(!googleSignInAvailable\(\)\) return null/);
    // The old behaviour explained itself in a `title`, which a phone never
    // shows and a screen reader mostly ignores.
    expect(button).not.toContain("Not configured yet");
  });

  it("hides the separator with it, so no 'or' sits above one option", () => {
    const auth = read("src/app/auth/page.tsx");
    expect(auth).toContain("googleSignInAvailable()");
  });
});

describe("the auth inputs have accessible names", () => {
  it("names both email fields", () => {
    for (const file of [
      "src/app/auth/page.tsx",
      "src/app/auth/forgot/page.tsx",
    ]) {
      expect(read(file), file).toContain('aria-label="Email address"');
    }
  });

  it("names the password field from its own label text", () => {
    expect(read("src/components/auth/PasswordField.tsx")).toContain(
      "aria-label={placeholder}",
    );
  });
});
