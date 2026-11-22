import {
  expect,
  test,
  type Browser,
  type BrowserContext,
} from "@playwright/test";

/**
 * **Christmas privacy, at the HTTP layer — five kinds of visitor.**
 *
 * Alice plans a private Christmas adventure and announces a change. Then:
 *
 *   - an anonymous visitor reaches none of it (pages, API, photos);
 *   - Bob, signed in but never invited, reaches none of it either, and cannot
 *     write to it;
 *   - Carol, invited by link, sees what a member may — and cannot do what
 *     only the owner may (announce, mint links, read the link list);
 *   - every public Christmas page works for the anonymous visitor, and shows
 *     nothing of Alice's.
 *
 * Nothing is hidden in the UI: every check is a request, and the database
 * behind it is real GoTrue + PostgREST + Postgres with row-level security
 * (stack.mjs). The database-level half is `privacy.stack.test.ts`.
 *
 *   E2E_PORT=3131 npx playwright test -c docs/product/christmas/verification privacy.spec
 */

const PASSWORD = "jingle-all-the-way-9";
const stamp = Date.now().toString(36);
const emailFor = (who: string) => `${who}-priv-${stamp}@example.test`;
const SECRET_TITLE = `Alice's secret surprise ${stamp}`;

async function signedIn(
  browser: Browser,
  who: string,
): Promise<BrowserContext> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/auth?next=%2Fchristmas");
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(emailFor(who));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"));
  await page.close();
  return context;
}

const json = (data: unknown) => ({
  data,
  headers: { "content-type": "application/json" },
});

test("a private Christmas adventure is reachable only by its members", async ({
  browser,
  playwright,
  baseURL,
}) => {
  const alice = await signedIn(browser, "alice");
  const bob = await signedIn(browser, "bob");
  const carol = await signedIn(browser, "carol");
  const anon = await playwright.request.newContext({ baseURL });

  // Alice makes a plan and an announcement.
  const made = await alice.request.post("/christmas/api/start", {
    ...json({
      shape: "evening",
      title: SECRET_TITLE,
      startsOn: "2026-12-12",
      townId: "vernon",
      days: 1,
      sketch: false,
    }),
  });
  expect(made.status()).toBe(201);
  const { id } = (await made.json()) as { id: string };

  // Private by default: a fresh adventure has exactly one member, Alice.
  const mine = await alice.request.get(`/api/adventures/${id}`);
  expect(mine.status()).toBe(200);
  const view = (await mine.json()) as { title?: string; members?: unknown[] };
  expect(JSON.stringify(view)).toContain(SECRET_TITLE);
  expect(view.members ?? []).toHaveLength(1);

  const announced = await alice.request.post(`/christmas/api/${id}/notices`, {
    ...json({ kind: "note", headline: `Bring mittens ${stamp}` }),
  });
  // 201 when sharing is switched on in the database, 503/404 when it is not;
  // either way it is the owner's and never leaks below.
  expect([201, 404, 501, 503]).toContain(announced.status());

  // Every request a stranger or a visitor could make about it.
  const probes = (request: typeof anon) => [
    () => request.get(`/api/adventures/${id}`),
    () => request.get(`/api/adventures/${id}/invites`),
    () => request.get(`/christmas/api/${id}/notices`),
    () => request.get(`/christmas/api/${id}/moments`),
    () =>
      request.post(
        `/christmas/api/${id}/notices`,
        json({ kind: "note", headline: "hello" }),
      ),
    () => request.post(`/api/adventures/${id}/invites`, json({ maxUses: 1 })),
    () =>
      request.post(`/api/adventures/${id}/items`, json({ label: "intruder" })),
    () => request.delete(`/api/adventures/${id}`),
  ];

  for (const [name, request] of [
    ["anonymous", anon],
    ["Bob (signed in, never invited)", bob.request],
  ] as const) {
    for (const probe of probes(request)) {
      const r = await probe();
      const body = await r.text();
      // Refused (4xx), or — for a list Postgres filtered to nothing — an
      // empty list. Never a row.
      const emptyList = r.status() === 200 && body.trim() === "[]";
      if (!emptyList) {
        expect(r.status(), `${name}: ${r.url()}`).toBeGreaterThanOrEqual(400);
        expect(r.status(), `${name}: ${r.url()}`).toBeLessThan(500);
      }
      expect(body, `${name}: ${r.url()}`).not.toContain(SECRET_TITLE);
      expect(body, `${name}: ${r.url()}`).not.toContain(`Bring mittens`);
    }
    // Pages: no title, no plan, whatever the status or redirect.
    for (const path of [
      `/christmas/adventure/${id}`,
      `/adventures/${id}`,
      "/christmas/list",
    ]) {
      const page = await (name === "anonymous"
        ? anon.get(path, { maxRedirects: 5 })
        : bob.request.get(path, { maxRedirects: 5 }));
      expect(await page.text(), `${name}: ${path}`).not.toContain(SECRET_TITLE);
    }
  }

  // Bob's own list never holds Alice's adventure, in the page or the API.
  const bobsList = await bob.request.get("/api/adventures");
  expect(bobsList.status()).toBe(200);
  expect(await bobsList.text()).not.toContain(SECRET_TITLE);
  const bobsFront = await bob.request.get("/christmas");
  expect(await bobsFront.text()).not.toContain(SECRET_TITLE);

  // Carol is invited by a one-use link, and becomes a member of that one.
  const link = await alice.request.post(`/api/adventures/${id}/invites`, {
    ...json({ maxUses: 1, label: "Carol" }),
  });
  expect(link.status()).toBe(201);
  const { token } = (await link.json()) as { token: string };
  const joined = await carol.request.post("/api/adventures/join", {
    ...json({ token }),
  });
  expect(joined.status()).toBeLessThan(300);

  // A member sees the plan…
  const carolsView = await carol.request.get(`/api/adventures/${id}`);
  expect(carolsView.status()).toBe(200);
  expect(await carolsView.text()).toContain(SECRET_TITLE);
  // …but a participant cannot do what only the owner may.
  const carolInvites = await carol.request.get(`/api/adventures/${id}/invites`);
  expect(carolInvites.status()).toBeGreaterThanOrEqual(400);
  const carolMints = await carol.request.post(`/api/adventures/${id}/invites`, {
    ...json({ maxUses: 5 }),
  });
  expect(carolMints.status()).toBeGreaterThanOrEqual(400);
  const carolAnnounces = await carol.request.post(
    `/christmas/api/${id}/notices`,
    {
      ...json({ kind: "note", headline: "Carol was here" }),
    },
  );
  expect(carolAnnounces.status()).toBeGreaterThanOrEqual(400);
  const carolDeletes = await carol.request.delete(`/api/adventures/${id}`);
  expect(carolDeletes.status()).toBeGreaterThanOrEqual(400);
  // The link was single-use: a stranger cannot reuse it.
  const reused = await bob.request.post("/api/adventures/join", {
    ...json({ token }),
  });
  expect(reused.status()).toBeGreaterThanOrEqual(400);
  // Bob, still outside, still sees nothing.
  const bobAgain = await bob.request.get(`/api/adventures/${id}`);
  expect(bobAgain.status()).toBeGreaterThanOrEqual(400);

  // Alice's adventure is still there for Alice — and on her own list.
  expect((await alice.request.get(`/api/adventures/${id}`)).status()).toBe(200);
  expect(await (await alice.request.get("/christmas/list")).text()).toContain(
    SECRET_TITLE,
  );
  // Signed out, the list is a sign-in prompt and holds nothing of anyone's.
  const signedOutList = await anon.get("/christmas/list");
  expect(signedOutList.status()).toBe(200);
  expect(await signedOutList.text()).toContain("Sign in");

  // Public Christmas stays public: no sign-in, no Alice.
  for (const path of [
    "/christmas",
    "/christmas/discover",
    "/christmas/list",
    "/christmas/lights",
    "/christmas/lights/tour",
    "/christmas/itinerary?say=lights",
    "/api/adventures/join",
  ]) {
    const r = await anon.get(path);
    if (path === "/api/adventures/join") continue;
    expect(r.status(), path).toBe(200);
    expect(await r.text(), path).not.toContain(SECRET_TITLE);
  }
  // A visitor is not offered someone's plans on the lights API either.
  const lightsApi = await anon.get("/christmas/api/lights");
  expect(lightsApi.status()).toBe(200);
  expect(await lightsApi.text()).not.toContain(SECRET_TITLE);

  // Writes by a visitor are refused (the creation route needs an account).
  const anonStart = await anon.post("/christmas/api/start", {
    ...json({ shape: "evening", title: "anon plan" }),
  });
  expect(anonStart.status()).toBe(401);
  const anonItin = await anon.post("/christmas/api/itinerary", {
    ...json({ say: "lights", save: true }),
  });
  expect([200, 400, 401, 403, 404]).toContain(anonItin.status());

  await Promise.all([
    alice.close(),
    bob.close(),
    carol.close(),
    anon.dispose(),
  ]);
});
