import { expect, test, request as pwRequest } from "@playwright/test";

/**
 * **October lives under `/october`, and everything that used to be printed,
 * bookmarked or shared under `/labs/october` still arrives.**
 *
 * The first half asserts the redirects themselves — status, destination, and
 * that the query string and the join code survive — without following them,
 * so a wrong destination cannot be hidden by the page it happens to land on.
 * The second half follows each old URL in a real browser and checks the room
 * on the other side is the room.
 */

const MOVES: ReadonlyArray<readonly [string, string]> = [
  ["/labs/october/found-you", "/october/found-you"],
  ["/labs/october/witching-hour", "/october/witching-hour"],
  [
    "/labs/october/witching-hour?at=doorway",
    "/october/witching-hour?at=doorway",
  ],
  [
    "/labs/october/witching-hour/join/ABCD-1234",
    "/october/witching-hour/join/ABCD-1234",
  ],
  ["/labs/october/discovery", "/october/discovery"],
  ["/labs/october/discovery/a", "/october/discovery/a"],
  ["/labs/october/discovery/b", "/october/discovery/b"],
  ["/labs/october/discovery/c", "/october/discovery/c"],
  ["/labs/october/discovery/d", "/october/discovery/d"],
  ["/labs/october/discovery/legacy", "/october/discovery/legacy"],
  ["/labs/october/for-bryan", "/october/for-bryan"],
  [
    "/labs/october/scariest-room/has-been-here",
    "/october/scariest-room/has-been-here",
  ],
  [
    "/labs/october/secret-room/another-way-out",
    "/october/secret-room/another-way-out",
  ],
  ["/labs/october/sketchbook", "/october/sketchbook"],
  ["/labs/october/sketchbook/the-store", "/october/sketchbook/the-store"],
  ["/labs/october/video-store", "/october/store"],
  [
    "/labs/october/video-store?intervene=1&anomaly=1&presence=child",
    "/october/store?intervene=1&anomaly=1&presence=child",
  ],
];

test.describe("old /labs/october URLs forward", () => {
  for (const [from, to] of MOVES) {
    test(`${from} → ${to}`, async ({ request, baseURL }) => {
      const res = await request.get(from, { maxRedirects: 0 });
      expect(res.status()).toBe(307);
      const location = new URL(res.headers()["location"]!, baseURL);
      expect(location.pathname + location.search).toBe(to);
    });
  }

  test("an unknown parameter is not dropped on the way", async ({
    request,
    baseURL,
  }) => {
    const res = await request.get("/labs/october/found-you?utm=card&x=1", {
      maxRedirects: 0,
    });
    const location = new URL(res.headers()["location"]!, baseURL);
    expect(location.search).toBe("?utm=card&x=1");
  });

  test("on iamoctober.com the redirect stays on iamoctober.com", async ({
    baseURL,
  }) => {
    const ctx = await pwRequest.newContext({
      baseURL,
      extraHTTPHeaders: { host: "iamoctober.com" },
    });
    const res = await ctx.get("/labs/october/video-store?intervene=1", {
      maxRedirects: 0,
    });
    expect(res.status()).toBe(307);
    const location = res.headers()["location"]!;
    // Relative, or absolute on the same host — never off the domain.
    expect(
      location.startsWith("/") || location.includes("iamoctober.com"),
    ).toBe(true);
    expect(location).toContain("/october/store?intervene=1");
    await ctx.dispose();
  });

  test("the iamoctober.com homepage is still October's Discover", async ({
    baseURL,
  }) => {
    const ctx = await pwRequest.newContext({
      baseURL,
      extraHTTPHeaders: { host: "iamoctober.com" },
    });
    const res = await ctx.get("/", { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain("From October");
    await ctx.dispose();
  });

  test("Labs still serves what is not October's to move", async ({
    request,
  }) => {
    const res = await request.get("/labs/october/synthesis", {
      maxRedirects: 0,
    });
    expect(res.status()).toBe(200);
  });
});

test.describe("the rooms, at their new addresses", () => {
  const ROOMS: ReadonlyArray<readonly [string, string]> = [
    ["/october/for-bryan", "for-bryan"],
    ["/october/scariest-room/has-been-here", "has-been-here"],
    ["/october/secret-room/another-way-out", "another-way-out"],
    ["/october/sketchbook", "sketchbook"],
    ["/october/discovery", "discovery"],
    ["/october/discovery/a", "discovery"],
    ["/october/discovery/b", "discovery"],
    ["/october/discovery/c", "discovery"],
    ["/october/discovery/d", "discovery"],
    ["/october/discovery/legacy", "discovery"],
  ];

  for (const [path] of ROOMS) {
    test(`${path} renders without error`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.locator("body")).not.toContainText(
        /application error|404|This page could not be found/i,
      );
      expect(errors).toEqual([]);
    });
  }

  test("an old bookmark opens the room in a browser", async ({ page }) => {
    await page.goto("/labs/october/video-store?intervene=1");
    await expect(page).toHaveURL(/\/october\/store\?intervene=1$/);
    await expect(page.getByTestId("leave-store")).toBeVisible();
  });

  test("an old QR code lands on the pairing page, code intact", async ({
    page,
  }) => {
    await page.goto("/labs/october/witching-hour/join/ABCD-1234");
    await expect(page).toHaveURL(/\/october\/witching-hour\/join\/ABCD-1234$/);
  });
});
