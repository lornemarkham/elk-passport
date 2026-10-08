import { afterEach, describe, expect, it, vi } from "vitest";
import { reportError, sanitize, scrub } from "./report";

/**
 * **The reporter must never become the leak.**
 *
 * Error messages and stacks are the single most likely place for a credential
 * to end up in a log: a failed Supabase call puts the URL in the message, a
 * failed auth callback puts the code in it. So most of what is pinned here is
 * what does *not* come out the other end.
 *
 * The rest pins the property that makes it usable at all — reporting must
 * never itself throw, because it runs inside an error boundary that is
 * already the last thing standing.
 */

afterEach(() => vi.restoreAllMocks());

describe("what never reaches a log line", () => {
  it("removes email addresses", () => {
    expect(scrub("failed for lorne.markham@gmail.com")).toBe(
      "failed for [email]",
    );
  });

  it("removes a JWT, wherever it appears in a message", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc-def_123";
    expect(scrub(`Bearer ${jwt} rejected`)).not.toContain("eyJ");
  });

  it("removes an auth code out of a URL, which is the recovery-link case", () => {
    const got = scrub("GET /auth/callback?code=pkce_abc123&next=/october");
    expect(got).toContain("code=[redacted]");
    expect(got).not.toContain("pkce_abc123");
    // The useful part of the URL survives, or the report says nothing.
    expect(got).toContain("/auth/callback");
  });

  it("removes an auth code written in prose, not only in a URL", () => {
    // Found in a real production log line: the first version of this only
    // matched after `?` or `&`, and an error message does not write URLs.
    const got = scrub("reset failed with code=pkce_secret123 for that user");
    expect(got).not.toContain("pkce_secret123");
    expect(got).toContain("code=[redacted]");
  });

  it("removes an api key however it is spelled", () => {
    expect(scrub("apikey=abc123def")).toBe("apikey=[redacted]");
    expect(scrub("access_token=xyz789")).toBe("access_token=[redacted]");
  });

  it("removes a Supabase key prefix", () => {
    expect(scrub("key sbp_0123456789abcdefghijklmno")).not.toContain("sbp_0");
  });
});

describe("a report is bounded and fixed in shape", () => {
  it("caps a runaway stack rather than logging a megabyte", () => {
    const report = sanitize({ message: "x", stack: "y".repeat(50_000) });
    expect(report.stack!.length).toBeLessThanOrEqual(4000);
  });

  it("keeps only the five fields it knows", () => {
    const smuggled = {
      message: "boom",
      cookie: "session=abc",
      headers: { authorization: "Bearer x" },
    } as never;
    expect(Object.keys(sanitize(smuggled)).sort()).toEqual(["message"]);
  });

  it("never produces an empty message", () => {
    expect(sanitize({ message: "" }).message).toBe("Unknown error");
  });
});

describe("reporting is safe to call from inside a failure", () => {
  // These run under jsdom, which is the browser branch — the one that
  // matters, because a browser failure is the gap this closes.
  it("posts a browser failure to the one route that can log it", () => {
    const fetched = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));
    reportError(new Error("client side"), { boundary: "october" });

    expect(fetched).toHaveBeenCalledOnce();
    const [url, init] = fetched.mock.calls[0];
    expect(String(url)).toBe("/api/client-errors");
    expect((init as RequestInit).method).toBe("POST");
    // `keepalive`, or the report dies with the navigation the error caused.
    expect((init as RequestInit).keepalive).toBe(true);
    const sent = JSON.parse(String((init as RequestInit).body));
    expect(sent.boundary).toBe("october");
    expect(sent.message).toBe("client side");
  });

  it("does not break the page when the report itself cannot be sent", () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("offline");
    });
    expect(() => reportError(new Error("boom"))).not.toThrow();
  });

  it("survives a non-Error being thrown", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => reportError("just a string")).not.toThrow();
    expect(() => reportError(undefined)).not.toThrow();
    expect(() => reportError({ weird: true })).not.toThrow();
  });

  it("scrubs before it leaves the browser, not after it arrives", () => {
    const fetched = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));
    reportError(new Error("rejected for ana@example.com"));
    const body = String((fetched.mock.calls[0][1] as RequestInit).body);
    expect(body).not.toContain("ana@example.com");
    expect(body).toContain("[email]");
  });
});

describe("a huge report is cheap, not just small", () => {
  it("caps before it scrubs, so a long stack cannot stall the page", () => {
    // Scrubbing first and slicing after made the email pattern backtrack
    // across the whole input: eight seconds for one report, inside an error
    // boundary that is already the last thing standing.
    const started = Date.now();
    const report = sanitize({ message: "x", stack: "y".repeat(200_000) });
    expect(Date.now() - started).toBeLessThan(250);
    expect(report.stack!.length).toBeLessThanOrEqual(4000);
  });

  it("still scrubs what survives the cut", () => {
    const stack = `at handler (ana@example.com) ${"z".repeat(50_000)}`;
    expect(sanitize({ message: "x", stack }).stack).toContain("[email]");
  });
});
