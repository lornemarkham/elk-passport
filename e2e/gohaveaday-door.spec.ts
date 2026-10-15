import { expect, request as pwRequest, test } from "@playwright/test";

/**
 * **`gohaveaday.com` opens on Discovery, with nothing in between.**
 *
 * Production served Passport's static landing page at the root of the domain
 * while Discovery sat one click away at `/discovery`. The root is now
 * rewritten — not redirected — to the existing `/discovery` route, so the
 * browser stays on `gohaveaday.com/` and the page is the one implementation.
 *
 * These drive the real middleware with a `Host` header rather than the unit
 * table, because the one thing the table cannot show is what the rewrite
 * does to the rest of the URL: the first version resolved the target with
 * `new URL(path, request.url)` and silently dropped the query string.
 */
test.describe("gohaveaday.com", () => {
  const onDomain = (baseURL: string | undefined, host: string) =>
    pwRequest.newContext({ baseURL, extraHTTPHeaders: { host } });

  for (const host of ["gohaveaday.com", "www.gohaveaday.com"]) {
    test(`${host}/ is Discovery, served at the root without a redirect`, async ({
      baseURL,
    }) => {
      const ctx = await onDomain(baseURL, host);
      const res = await ctx.get("/", { maxRedirects: 0 });
      expect(res.status()).toBe(200);
      const html = await res.text();
      expect(html).toContain("<title>Discovery — Passport</title>");
      expect(html).not.toContain("Go have a day in the Okanagan.");
      await ctx.dispose();
    });
  }

  test("the query string reaches Discovery", async ({ baseURL }) => {
    const ctx = await onDomain(baseURL, "gohaveaday.com");
    // `?age=` is the one parameter Discovery turns into a different question
    // for Atlas, and the one it echoes back into the page. The root with it
    // must render exactly what `/discovery` with it renders.
    const [root, direct] = await Promise.all([
      ctx.get("/?age=5", { maxRedirects: 0 }),
      ctx.get("/discovery?age=5", { maxRedirects: 0 }),
    ]);
    expect(root.status()).toBe(200);
    // The App Router stamps the page segment with the search params it was
    // given (`__PAGE__?{"age":"5"}`), so the payload itself says whether the
    // query arrived — whatever Atlas is or is not answering underneath.
    const ageMarker = (html: string) =>
      html.match(/__PAGE__\?\{[^}]*age[^}]*5[^}]*\}/)?.[0] ?? null;
    const marker = ageMarker(await direct.text());
    expect(
      marker,
      "/discovery?age=5 must itself reflect the age",
    ).not.toBeNull();
    expect(await root.text()).toContain(marker!);
    await ctx.dispose();
  });

  test("every other path on the domain is served as itself", async ({
    baseURL,
  }) => {
    const ctx = await onDomain(baseURL, "gohaveaday.com");
    for (const [path, expected] of [
      ["/discovery", "<title>Discovery — Passport</title>"],
      ["/go", null],
    ] as const) {
      const res = await ctx.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(200);
      if (expected) expect(await res.text()).toContain(expected);
    }
    await ctx.dispose();
  });

  test("Passport's own host keeps Passport's own homepage", async ({
    request,
  }) => {
    const res = await request.get("/", { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain("Go have a day in the Okanagan.");
  });

  test("iamoctober.com is untouched", async ({ baseURL }) => {
    const ctx = await onDomain(baseURL, "iamoctober.com");
    const res = await ctx.get("/", { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain("From October");
    await ctx.dispose();
  });
});
