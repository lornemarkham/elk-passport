import { expect, type Browser, type Page } from "@playwright/test";
import { openTab } from "./night-tabs";
import { TEST_PASSWORD } from "./test-credentials";

/** Helpers shared by mayhem.spec, mayhem-ai.spec and mayhem-off.spec. */

const stamp = Date.now().toString(36);
let suffix = "mayhem";
/** Each spec signs up its own people: "mayhem", "mayhem-ai", "mayhem-off". */
export function peopleCalled(s: string) {
  suffix = s;
}
export const emailFor = (who: string) =>
  `${who}-${suffix}-${stamp}@example.test`;
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const PHONE = {
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
};

export interface Person {
  who: string;
  name: string;
  page: Page;
  id: string;
}

export interface Snapshot {
  state: {
    meId: string;
    addedPrompts: {
      id: string;
      family?: string;
      audience?: { only?: string };
    }[];
  };
  definition: {
    prompts: { id: string; scoring?: { points: number; label?: string } }[];
  };
  chirp: {
    on: boolean;
    fans: Record<string, string>;
    lines: { id: string; kind: string; text: string; about?: string }[];
  };
  play: {
    available: boolean;
    challenges: {
      id: string;
      kind: string;
      status: string;
      challenger_id: string;
      target_id: string;
    }[];
    ledger: { earner: string }[];
  };
}

export let night = "";
export function setNight(id: string) {
  night = id;
}

export async function signUp(page: Page, who: string) {
  await page.getByRole("tab", { name: "Sign Up" }).click();
  await page.getByLabel("Email address").fill(emailFor(who));
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

export async function phone(browser: Browser, width = 390) {
  const context = await browser.newContext({
    ...PHONE,
    viewport: { width, height: 844 },
  });
  return context.newPage();
}

export async function token(who: string): Promise<string> {
  const res = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email: emailFor(who), password: TEST_PASSWORD }),
  });
  expect(res.status).toBe(200);
  return (await res.json()).access_token as string;
}

/** Straight to PostgREST with a member's own JWT: what a cheater with devtools has. */
export async function rest(
  who: string,
  method: string,
  path: string,
  body?: unknown,
) {
  const res = await fetch(`${SUPABASE}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: ANON,
      authorization: `Bearer ${await token(who)}`,
      "content-type": "application/json",
      prefer: "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

export async function snapshot(page: Page): Promise<Snapshot> {
  const res = await page.request.get(`/hockey/api/occasions/${night}`);
  expect(res.status()).toBe(200);
  return (await res.json()) as Snapshot;
}

export async function act(page: Page, action: unknown) {
  return page.request.post(`/hockey/api/occasions/${night}/actions`, {
    data: action as never,
  });
}

export async function ok(page: Page, action: unknown) {
  const res = await act(page, action);
  expect(res.ok(), `${JSON.stringify(action)} → ${await res.text()}`).toBe(
    true,
  );
}

export async function refused(page: Page, action: unknown, status?: number) {
  const res = await act(page, action);
  expect(res.ok(), `${JSON.stringify(action)} should be refused`).toBe(false);
  if (status) expect(res.status()).toBe(status);
  return (await res.json().catch(() => ({}))) as { error?: string };
}

export async function botLine(
  page: Page,
  kind: string,
  about?: string,
  timeout = 20_000,
) {
  let found: Snapshot["chirp"]["lines"][number] | undefined;
  await expect
    .poll(
      async () => {
        found = (await snapshot(page)).chirp.lines.find(
          (l) => l.kind === kind && (!about || l.about === about),
        );
        return Boolean(found);
      },
      { timeout, message: `Chirp Bot ${kind} line` },
    )
    .toBe(true);
  return found!;
}

export async function moveStart(startsAt: Date) {
  const res = await rest(
    "lorne",
    "PATCH",
    `passport_occasions?id=eq.${night}`,
    { starts_at: startsAt.toISOString() },
  );
  expect(res.status, JSON.stringify(res.json)).toBe(200);
}

export async function shot(page: Page, name: string, full = true) {
  if (!process.env.MAYHEM_SHOTS) return;
  await page.waitForTimeout(450);
  await page.screenshot({
    path: `${process.env.MAYHEM_SHOTS}/${name}.jpg`,
    fullPage: full,
    quality: 72,
    type: "jpeg",
  });
}

export async function noSidewaysScroll(page: Page) {
  const [scroll, client] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ]);
  expect(scroll, "sideways scroll").toBeLessThanOrEqual(client);
}

export async function noTinyTargets(page: Page) {
  const tiny = await page.evaluate(() =>
    [
      ...document.querySelectorAll(
        "main [role=tabpanel] button, main [role=tabpanel] a, main [role=tabpanel] summary, [role=dialog] button",
      ),
    ]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return (
          r.width > 0 &&
          r.height > 0 &&
          s.visibility !== "hidden" &&
          r.height < 32
        );
      })
      .map((el) =>
        (el.textContent || el.getAttribute("aria-label") || "").trim(),
      )
      .slice(0, 5),
  );
  expect(tiny, `undersized targets: ${tiny.join(" | ")}`).toEqual([]);
}

export async function declareTeam(p: Person, team: string) {
  await p.page.getByRole("button", { name: "Pick my team" }).first().click();
  const picker = p.page.getByRole("dialog", { name: /WHO DO YOU BLEED FOR/i });
  await picker.getByLabel("Find your team").fill(team.split(" ").pop()!);
  await picker.getByRole("radio", { name: team, exact: true }).click();
  await expect(
    p.page.getByRole("dialog", { name: `${p.name} bleeds for the ${team}` }),
  ).toBeVisible();
  await p.page.getByRole("button", { name: "Let's go" }).click();
  await p.page
    .getByRole("region", { name: /game night/ })
    .getByRole("button", { name: "At the arena", exact: true })
    .click();
}

/** The Cup, as one phone draws it: every competitor's name and points, in order. */
export async function standings(page: Page): Promise<string[]> {
  await page.reload();
  await openTab(page, "Play");
  const list = page.getByRole("list", { name: "Standings" });
  await expect(list).toBeVisible();
  return list.locator(":scope > li").evaluateAll((items) =>
    items.map((li) => {
      const name = li.querySelector("p")?.firstChild?.textContent?.trim() ?? "";
      const points =
        li
          .querySelector("[aria-label$='points']")
          ?.getAttribute("aria-label") ?? "";
      return `${name}: ${points}`;
    }),
  );
}
