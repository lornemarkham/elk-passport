import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/**
 * **Christmas Lights Map — community launch (owner decision 2026-11-22).**
 *
 * The owner's end-to-end, on a phone:
 *
 *   submit a photo (no account) → pending review → the administrator is
 *   emailed → approve → it is on the public map → a household requests
 *   removal (no account) → the listing is hidden at once → the administrator
 *   is emailed → delete → the place can't be added again.
 *
 * Needs the memory store, the test identity, and a stand-in for the mail
 * service this spec starts itself:
 *
 *   INSIDERS_STORE=memory INSIDERS_TEST_IDENTITY=on ADMIN_EMAILS=elf@example.test
 *   RESEND_API_KEY=test CHRISTMAS_MAIL_FROM="Passport <noreply@example.test>"
 *   CHRISTMAS_NOTIFY_EMAIL=owner@example.test
 *   RESEND_API_URL=http://127.0.0.1:3132/emails   (E2E_MAIL_PORT)
 *
 * then `E2E_LIGHTS_COMMUNITY=1 E2E_PORT=… npx playwright test`.
 */
test.use({ viewport: { width: 390, height: 844 } });
test.describe.configure({ mode: "serial" });
test.skip(
  process.env.E2E_LIGHTS_COMMUNITY !== "1",
  "needs the memory store, the test identity and the mail stand-in",
);

const MAIL_PORT = Number(process.env.E2E_MAIL_PORT ?? 3132);
const RUN = Date.now().toString(36);
const NAME = `Candy Cane Lane ${RUN}`;
const PHOTO = "docs/product/christmas/verification/test-lights.jpg";
const SHOTS = "docs/product/christmas/screenshots";

interface Mail {
  to: string[];
  subject: string;
  text: string;
  from: string;
  auth: string | undefined;
}
const inbox: Mail[] = [];
let mailServer: Server;

test.beforeAll(async () => {
  mailServer = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const m = JSON.parse(raw) as Mail;
      inbox.push({ ...m, auth: req.headers.authorization });
      res.writeHead(200, { "content-type": "application/json" });
      res.end('{"id":"stand-in"}');
    });
  });
  await new Promise<void>((ok) =>
    mailServer.listen(MAIL_PORT, "127.0.0.1", ok),
  );
});
test.afterAll(async () => {
  await new Promise((ok) => mailServer.close(ok));
});

async function as(context: BrowserContext, email: string, baseURL: string) {
  await context.addCookies([
    { name: "insiders-as", value: encodeURIComponent(email), url: baseURL },
  ]);
}

async function mapReady(page: Page) {
  await expect(page.getByTestId("lights-map").first()).toHaveAttribute(
    "data-ready",
    "1",
    { timeout: 20_000 },
  );
}

async function mailWith(subject: RegExp) {
  await expect
    .poll(() => inbox.some((m) => subject.test(m.subject)), { timeout: 15_000 })
    .toBe(true);
  return inbox.find((m) => subject.test(m.subject))!;
}

let id = "";
let coords = { lat: 0, lng: 0 };

test("anyone can submit a display with a photo, no account; it is pending, and the owner is emailed", async ({
  browser,
  baseURL,
}) => {
  const base = baseURL!;
  const stranger = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await stranger.newPage();
  await page.goto("/christmas/lights/pin");
  // No sign-in wall.
  await expect(page.getByTestId("pin-sign-in")).toHaveCount(0);
  await expect(page.getByTestId("pin-form")).toBeVisible();
  await page.getByRole("link", { name: "Privacy notice" }).first().waitFor();
  await mapReady(page);
  await page.getByTestId("lights-map").click({ position: { x: 190, y: 130 } });
  await expect(page.getByTestId("pick-said")).toContainText("Pinned");

  // The photo promise is required, and the photo itself.
  await page.getByTestId("what-home").click();
  await page.getByTestId("pin-name-input").fill(NAME);
  await page
    .getByTestId("pin-about-input")
    .fill("Giant candy canes, music at 7");
  await page.waitForTimeout(2600);
  await page.getByTestId("pin-submit").click();
  await expect(page.getByTestId("pin-error")).toContainText("photo");
  await page.getByTestId("photo-input").setInputFiles(PHOTO);
  await expect(page.getByTestId("photo-preview")).toBeVisible();
  await page.getByTestId("pin-submit").click();
  await expect(page.getByTestId("pin-error")).toContainText(
    "no people, licence plates",
  );
  await page.getByTestId("photo-ok").check();
  await page.getByTestId("pin-submit").click();

  // The confusing message is gone: it says what happens, plainly.
  const done = page.getByTestId("pin-done");
  await expect(done).toBeVisible();
  await expect(done).toContainText(
    "We check every display before it appears on the public map",
  );
  await expect(done).not.toContainText("only you can see");
  await expect(done).not.toContainText("Waiting for a reviewer");
  await expect(page.getByTestId("pin-status")).toContainText("pending review");
  await page.screenshot({ path: `${SHOTS}/community-01-submitted.png` });

  // Nothing public: not the API, the photo, the page, the map page.
  const api = await stranger.request.get(`${base}/christmas/api/lights`);
  const text = JSON.stringify(await api.json());
  expect(text).not.toContain(NAME);
  expect(
    await (await stranger.request.get(`${base}/christmas/lights`)).text(),
  ).not.toContain(NAME);

  // The administrator was emailed — name and town and a link, never the submitter.
  const mail = await mailWith(
    new RegExp(`New Christmas lights submission: ${NAME}`),
  );
  expect(mail.to).toEqual(["owner@example.test"]);
  expect(mail.auth).toBe("Bearer test");
  expect(mail.text).toContain("/christmas/lights/review");
  expect(mail.text).toContain("Nothing is public until you approve it");
  await stranger.close();
});

test("only the administrator can reach the queue or act on it", async ({
  browser,
  baseURL,
}) => {
  const base = baseURL!;
  // Signed out.
  const anon = await browser.newContext();
  const a = await anon.newPage();
  await a.goto("/christmas/lights/review");
  await expect(a.getByTestId("review-refused")).toBeVisible();
  await expect(a.getByTestId("review-item")).toHaveCount(0);
  // A signed-in person who is not the administrator.
  const family = await browser.newContext();
  await as(family, `family-${RUN}@example.test`, base);
  const f = await family.newPage();
  await f.goto("/christmas/lights/review");
  await expect(f.getByTestId("review-refused")).toContainText("administrator");
  await expect(f.getByTestId("review-item")).toHaveCount(0);

  // Find the pending pin's id via the administrator, then try to act without being one.
  const elf = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await as(elf, "elf@example.test", base);
  const r = await elf.newPage();
  await r.goto("/christmas/lights/review");
  const item = r.locator('[data-testid="review-item"]', { hasText: NAME });
  await expect(item).toHaveCount(1);
  id = (await item.getAttribute("data-id"))!;
  const link = await item.locator('a[href*="google.com/maps"]').innerText();
  const m = link.match(/(-?\d+\.\d+), (-?\d+\.\d+)/)!;
  coords = { lat: Number(m[1]), lng: Number(m[2]) };

  for (const ctx of [anon, family]) {
    for (const action of ["approve", "hide", "remove"]) {
      const res = await ctx.request.post(`${base}/christmas/api/lights/${id}`, {
        data: { action },
      });
      expect([401, 403, 404]).toContain(res.status());
    }
    // …and a pending listing is neither visible nor fetchable to them.
    expect(
      (
        await ctx.request.get(`${base}/christmas/api/lights/${id}/photo`)
      ).status(),
    ).toBe(404);
    expect(
      (await ctx.request.get(`${base}/christmas/lights/${id}`)).status(),
    ).toBe(404);
  }
  await Promise.all([anon.close(), family.close(), elf.close()]);
});

test("the administrator reviews on a phone, approves, and it appears on the public map without any identity", async ({
  browser,
  baseURL,
}) => {
  const base = baseURL!;
  const elf = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await as(elf, "elf@example.test", base);
  const r = await elf.newPage();
  await r.goto("/christmas/lights/review");
  await expect(r.getByTestId("mail-status")).toContainText(
    "owner@example.test",
  );
  const item = r.locator(`[data-testid="review-item"][data-id="${id}"]`);
  // Photo, location, description, date, status.
  await expect(item.getByTestId("review-photo")).toBeVisible();
  await expect(item).toContainText("Giant candy canes");
  await expect(item).toContainText("open map");
  await expect(item).toContainText("Submitted");
  await expect(item.getByTestId("review-status")).toHaveText("Pending review");
  // Phone: nothing overflows sideways, and the buttons are thumb-sized.
  expect(
    await r.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  for (const t of [
    "review-approve",
    "review-reject",
    "review-edit-open",
    "review-remove",
  ]) {
    const box = await item.getByTestId(t).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await item.scrollIntoViewIfNeeded();
  await r.screenshot({ path: `${SHOTS}/community-02-admin-pending.png` });

  // Edit, then approve.
  await item.getByTestId("review-edit-open").click();
  await item
    .getByTestId("edit-description")
    .fill("Giant candy canes, music at 7 pm");
  await item.getByTestId("edit-save").click();
  await expect(item).toContainText("music at 7 pm");
  await item.getByTestId("review-approve").click();
  await expect(item.getByTestId("review-status")).toHaveText("Published");
  await expect(item.getByTestId("review-hide")).toBeVisible();
  await elf.close();

  // The public: map, photo, detail — no submitter, no admin, no contact.
  const visitor = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const api = await (
    await visitor.request.get(`${base}/christmas/api/lights`)
  ).text();
  expect(api).toContain(NAME);
  expect(api).not.toContain("anon_");
  expect(api).not.toContain("elf@example.test");
  expect(api).not.toContain("submittedBy");
  expect(
    (
      await visitor.request.get(`${base}/christmas/api/lights/${id}/photo`)
    ).status(),
  ).toBe(200);
  const p = await visitor.newPage();
  await p.goto(`/christmas/lights/${id}`);
  await expect(p.getByTestId("pin-name")).toHaveText(NAME);
  await expect(p.getByTestId("pin-photo")).toBeVisible();
  await expect(p.getByTestId("detail-add-to-tour")).toBeVisible();
  await expect(p.getByRole("link", { name: /Directions/ })).toBeVisible();
  await expect(p.getByTestId("report-open")).toBeVisible();
  await expect(p.getByTestId("star-5")).toBeVisible();
  // The removal button is prominent, and above the fold of the actions.
  await expect(p.getByTestId("removal-open")).toContainText(
    "Is this your home? Request removal",
  );
  await p.getByTestId("removal-open").scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${SHOTS}/community-03-public-listing.png` });
  const body = await p.content();
  expect(body).not.toContain("anon_");
  expect(body).not.toContain("elf@example.test");
  // On the map itself.
  await p.goto(`/christmas/lights?pin=${id}`);
  await mapReady(p);
  await expect(
    p.locator(`[data-testid="map-marker"][data-id="${id}"]`),
  ).toBeVisible();
  await expect(p.getByTestId("sheet-removal")).toContainText("Request removal");
  await visitor.close();
});

test("a household requests removal with no account: hidden at once, administrator emailed, then deleted for good and blocked", async ({
  browser,
  baseURL,
}) => {
  const base = baseURL!;
  const household = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const p = await household.newPage();
  await p.goto(`/christmas/lights/${id}#removal`);
  // Opened by the link from the map; sends with nothing proved.
  await expect(p.getByTestId("removal-text")).toBeVisible();
  await p
    .getByTestId("removal-text")
    .fill("This is our home — please take it down");
  await p.getByTestId("removal-contact").fill("household@example.test");
  await p.getByTestId("removal-send").click();
  await expect(p.getByTestId("removal-done")).toContainText(
    "hidden from the map now",
  );
  await p.screenshot({ path: `${SHOTS}/community-04-removal-requested.png` });

  // Hidden for everybody, immediately — page, photo, API, map.
  expect(
    (await household.request.get(`${base}/christmas/lights/${id}`)).status(),
  ).toBe(404);
  expect(
    (
      await household.request.get(`${base}/christmas/api/lights/${id}/photo`)
    ).status(),
  ).toBe(404);
  expect(
    await (await household.request.get(`${base}/christmas/api/lights`)).text(),
  ).not.toContain(NAME);

  // The administrator is told — with a link, and without the requester's contact.
  const mail = await mailWith(new RegExp(`REMOVAL REQUEST.*${NAME}`));
  expect(mail.text).toContain("hidden from the public map immediately");
  expect(mail.text).not.toContain("household@example.test");
  await household.close();

  // The administrator sees it first in the queue, with the reason and contact.
  const elf = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await as(elf, "elf@example.test", base);
  const r = await elf.newPage();
  await r.goto("/christmas/lights/review");
  const item = r.locator(`[data-testid="review-removals"] [data-id="${id}"]`);
  await expect(item.getByTestId("removal-flag")).toContainText(
    "household@example.test",
  );
  await expect(item.getByTestId("removal-flag")).toContainText("take it down");
  await item.scrollIntoViewIfNeeded();
  await r.screenshot({ path: `${SHOTS}/community-05-admin-removal.png` });

  // The audit trail names every step, then Delete erases the contact.
  await item.locator("summary").click();
  const trail = item.getByTestId("review-trail");
  for (const step of [
    "submitted",
    "details",
    "approved",
    "removal-request",
    "hidden",
  ])
    await expect(trail).toContainText(step);
  r.once("dialog", (d) => void d.accept());
  await item.getByTestId("review-remove").click();
  await expect(r.locator(`[data-id="${id}"]`)).toHaveCount(0);
  // A fresh load from the server, not the page's earlier payload.
  await r.reload();
  expect(await r.content()).not.toContain("household@example.test");
  expect(await r.content()).not.toContain(NAME);

  // The same place can't be submitted again — even by script, with a good photo.
  const photo = readFileSync(PHOTO).toString("base64");
  const again = await elf.request.post(`${base}/christmas/api/lights/submit`, {
    data: {
      kind: "home",
      name: "Again",
      lat: coords.lat,
      lng: coords.lng,
      photo,
      photoOk: true,
      openedFor: 9000,
      device: "e2edevice12345",
    },
  });
  expect(again.status()).toBe(409);
  expect((await again.json()).error).toContain("household");
  await elf.close();
});

test("abuse prevention: bots, instant sends, links, missing photo promise and floods are turned away", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(300_000);
  const base = baseURL!;
  const bot = await browser.newContext();
  const photo = readFileSync(PHOTO).toString("base64");
  const good = {
    kind: "public-display",
    name: `Bot ${RUN}`,
    lat: 50.2701,
    lng: -119.2802,
    photo,
    photoOk: true,
    openedFor: 9000,
    device: "abcdefgh12345678",
  };
  const post = (data: Record<string, unknown>) =>
    bot.request.post(`${base}/christmas/api/lights/submit`, { data });
  // The per-address limit is four sends a minute, so the checks come in
  // batches of three, a minute apart (and the limit itself is asserted below).
  const status = async (data: Record<string, unknown>) =>
    (await post(data)).status();
  expect(await status({ ...good, openedFor: 100 })).toBe(400);
  expect(await status({ ...good, photoOk: false })).toBe(400);
  expect(await status({ ...good, photo: "" })).toBe(400);
  await new Promise((ok) => setTimeout(ok, 61_000));
  expect(await status({ ...good, photo: "not-a-jpeg" })).toBe(400);
  expect(
    await status({ ...good, description: "buy at https://spam.example" }),
  ).toBe(400);
  expect(await status({ ...good, lat: 49.28, lng: -123.12 })).toBe(400);
  await new Promise((ok) => setTimeout(ok, 61_000));
  // A hidden field only a script fills: looks accepted, stores nothing.
  const trap = await post({
    ...good,
    name: `Trapped ${RUN}`,
    website: "http://spam.example",
  });
  expect(trap.status()).toBe(201);
  const elf = await browser.newContext();
  await as(elf, "elf@example.test", base);
  const q = await elf.newPage();
  await q.goto("/christmas/lights/review");
  expect(await q.content()).not.toContain(`Trapped ${RUN}`);
  // …and a flood from one address is slowed down.
  const flood: number[] = [];
  for (let i = 0; i < 6; i++)
    flood.push(await status({ ...good, openedFor: 100 }));
  expect(flood).toContain(429);
  await new Promise((ok) => setTimeout(ok, 61_000));
  // Removal-request abuse: a stranger can't hide what doesn't exist, nor spam one listing.
  const missing = await bot.request.post(
    `${base}/christmas/api/lights/pin-nope`,
    {
      data: { action: "request-removal" },
    },
  );
  expect(missing.status()).toBe(404);
  const junk = await bot.request.post(`${base}/christmas/api/lights/${id}`, {
    data: { action: "request-removal", contact: "call me maybe" },
  });
  expect([400, 404]).toContain(junk.status());
  await Promise.all([bot.close(), elf.close()]);
});
