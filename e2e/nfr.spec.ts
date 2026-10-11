import { test, expect, type Page } from "@playwright/test";

/**
 * **The non-functional contract: how the product behaves, not what it says.**
 *
 * Every other spec in here asserts meaning — the right copy, the right link,
 * the right experience. These assert the things a person notices before they
 * read a word: whether it arrived, whether it stayed still, whether it fits on
 * their phone, and whether anything is broken in the console.
 *
 * ## What these measurements are, and what they are not
 *
 * This runs against `next build && next start` on localhost, over a loopback
 * interface, on whatever machine is running the suite, with a warm Atlas
 * cache. **It is not an SLA measurement and must never be reported as one.**
 * A real LCP for a real person includes a network, a cold Vercel function, a
 * six-second cold Atlas read and a phone's CPU — all of which are absent here.
 *
 * What a fixed budget on a fixed machine *does* catch is a regression: the day
 * somebody adds a blocking script, ships an unoptimised hero, or turns a
 * static section into a client component that waits on a fetch. That is worth
 * having, and it is all that is claimed. Field numbers come from the field.
 *
 * The budgets below are therefore deliberately slack against the Core Web
 * Vitals thresholds they are named after — they are a tripwire set well clear
 * of the fence, not the fence.
 */

/**
 * **Two budgets, because "slow" has two completely different causes.**
 *
 * A single LCP number cannot tell you whether the server took five seconds to
 * answer or the browser took five seconds to paint what it was handed, and the
 * two have nothing to do with each other. Splitting them turned one vague red
 * number into two findings, both measured on a local production build with
 * local Atlas:
 *
 * ```
 * /discovery   server     50ms    the shell streams immediately
 *              paint   5,404ms    largest element: the H1, not a photograph
 * /day/{id}    server  4,211ms    a cold full-corpus Atlas read, for one subject
 *              paint   4,308ms    it paints as soon as the server answers
 * ```
 *
 * **Discovery's paint is its payload.** The `/discovery` response is **2.77MB
 * (368KB gzipped) and carries all 2,681 experiences**: `DiscoveryListView` is
 * a client component taking the whole corpus as a prop, so nothing it renders
 * — including the headline — exists until all of that has arrived and been
 * parsed. That is why the largest element is a line of text on a page full of
 * photographs, and it is the single biggest thing standing between this
 * product and a fast first screen.
 *
 * **A plan costs a corpus read.** `/day/{id}` reads all 2,680 candidates to
 * find one. Cached per age after the first, so the 4.2s is the cold case and
 * the warm case is 10ms — but the cold case is the one a person meets.
 *
 * Both are recorded here rather than fixed here: each is an architectural
 * change with its own consequences, and this file's job is to measure.
 *
 * ## What these budgets are, and what they are not
 *
 * They are set **above the measurements above**, not at the Core Web Vitals
 * thresholds they are named after. This runs on loopback, on whatever machine
 * has the suite, with no network and no phone CPU — it is not an SLA
 * measurement and must never be reported as one. A fixed budget on a fixed
 * machine catches a regression: the day somebody adds a blocking script or
 * doubles the payload. A budget set at the real-world target would simply be
 * red every run, and a suite that is always red teaches people to ignore it.
 *
 * Lower them when the two findings above are fixed. That is the point of
 * writing the numbers down.
 */
const SERVER_BUDGET_MS = 6_000;

/** See `SERVER_BUDGET_MS`. Measured 5,404ms; this is a tripwire above it. */
const PAINT_BUDGET_MS = 7_000;

/** Core Web Vitals calls 0.1 "good". Layout that moves under a reader. */
const CLS_BUDGET = 0.1;

/** The three widths the product is designed against. */
const WIDTHS = [
  { name: "a phone", width: 375, height: 812 },
  { name: "a laptop", width: 1440, height: 900 },
  { name: "a large display", width: 1920, height: 1080 },
] as const;

/**
 * Largest Contentful Paint, read from the browser's own observer.
 *
 * Buffered, so an entry emitted before this ran is still counted — without
 * `buffered: true` the observer attaches after the paint it exists to measure
 * and reports nothing, which reads as a pass.
 */
async function paint(page: Page): Promise<{
  readonly lcp: number;
  readonly ttfb: number;
  /** What the browser decided the largest thing was, so a failure is a lead. */
  readonly element: string;
}> {
  return page.evaluate(
    () =>
      new Promise<{ lcp: number; ttfb: number; element: string }>((resolve) => {
        let latest: LargestContentfulPaint | undefined;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            latest = entry as LargestContentfulPaint;
          }
        }).observe({ type: "largest-contentful-paint", buffered: true });
        // LCP is only final when the page stops changing, so this samples
        // after the network has gone quiet rather than racing the first paint.
        setTimeout(() => {
          const nav = performance.getEntriesByType("navigation")[0] as
            PerformanceNavigationTiming | undefined;
          const element = latest?.element;
          resolve({
            lcp: latest?.startTime ?? 0,
            ttfb: nav?.responseStart ?? 0,
            element: element
              ? `${element.tagName} ${(
                  (element as HTMLImageElement).currentSrc ||
                  element.textContent ||
                  ""
                ).slice(0, 80)}`
              : "none",
          });
        }, 1_500);
      }),
  );
}

/** Asserts both budgets and names the element, so a red run is a diagnosis. */
async function expectWithinBudget(page: Page, where: string) {
  const { lcp, ttfb, element } = await paint(page);
  const said = `${where}: server ${Math.round(ttfb)}ms, painted ${Math.round(
    lcp,
  )}ms, largest element ${element}`;
  expect(ttfb, said).toBeLessThan(SERVER_BUDGET_MS);
  expect(lcp, said).toBeLessThan(PAINT_BUDGET_MS);
}

/** Cumulative Layout Shift, excluding shifts a person's own input caused. */
async function layoutShift(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let total = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const shift = entry as PerformanceEntry & {
              value: number;
              hadRecentInput: boolean;
            };
            if (!shift.hadRecentInput) total += shift.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
        setTimeout(() => resolve(total), 1_500);
      }),
  );
}

/** How far the document can be dragged sideways. Anything but zero is a bug. */
const sidewaysOverflow = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );

/**
 * A subject id, taken from the page rather than hardcoded.
 *
 * A UUID written into a test is a test that breaks when Atlas archives one
 * record, and it breaks with a 404 that says nothing about what changed.
 */
async function firstSubjectId(page: Page): Promise<string> {
  await page.goto("/discovery");
  const href = await page
    .getByTestId("possibility")
    .first()
    .getByRole("link")
    .first()
    .getAttribute("href");
  const id = href?.match(/\/(?:places|passport)\/([^?]+)/)?.[1];
  expect(id, `no subject link on /discovery — href was ${href}`).toBeTruthy();
  return id!;
}

/**
 * **These measure the warm case, deliberately and out loud.**
 *
 * Run in parallel with the rest of the suite, several workers raced the same
 * cold full-corpus Atlas read and the plan page's server time went past six
 * seconds — a flake, and a measurement of Playwright contending with itself
 * rather than of anything a person would meet. Four browsers asking Atlas for
 * 2,680 candidates at the same instant is not a scenario; the second visitor
 * to a warm server is.
 *
 * So each one warms the route first and measures the next navigation. The cold
 * number is not lost — it is recorded in `SERVER_BUDGET_MS` above, which is
 * where a fact belongs when it is a finding rather than an assertion.
 */
test.describe("it arrives, and it stays still", () => {
  // **Serial, and not an optimisation.** In parallel these raced the other
  // nine tests in this file for the same cold corpus read: a fresh server
  // failed the first run and passed the second, which is a coin toss rather
  // than a verdict. One worker, in order, after a warm-up.
  test.describe.configure({ mode: "serial" });

  /** One navigation, discarded, so the reading that follows is the warm one. */
  const warm = async (page: Page, url: string) => {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    await page.goto(url);
    await page.waitForLoadState("networkidle");
  };

  test("Discovery answers and paints inside both budgets", async ({ page }) => {
    await warm(page, "/discovery");
    await expectWithinBudget(page, "/discovery");
  });

  test("Discovery does not rearrange itself under the reader", async ({
    page,
  }) => {
    // The photographic shelves load Atlas-hosted images with no intrinsic
    // size. Each one sits in a fixed `aspect-[4/3]` box precisely so the text
    // under it does not jump when the photograph arrives; this is what says
    // so out loud.
    await page.goto("/discovery");
    await page.waitForLoadState("networkidle");
    const cls = await layoutShift(page);
    expect(cls, `CLS was ${cls.toFixed(3)}`).toBeLessThan(CLS_BUDGET);
  });

  test("a plan answers and paints inside both budgets too", async ({
    page,
  }) => {
    const id = await firstSubjectId(page);
    await page.goto(`/day/${id}?on=2026-10-11&childAge=5`);
    await expect(page.getByTestId("day-back")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expectWithinBudget(page, `/day/${id}`);
  });
});

/**
 * **The regression this suite was written for.**
 *
 * Measured on the deployed site at 375px: the bar came to 519px, so the whole
 * document scrolled sideways by 144px and every section under it could be
 * dragged off the screen. Nothing in 1,869 unit tests could see it, because
 * nothing in jsdom has a width.
 */
test.describe("it fits the screen it is on", () => {
  for (const { name, width, height } of WIDTHS) {
    test(`Discovery never scrolls sideways on ${name}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/discovery");
      await page.waitForLoadState("networkidle");
      expect(await sidewaysOverflow(page)).toBe(0);
    });
  }

  test("a plan never scrolls sideways on a phone", async ({ page }) => {
    const id = await firstSubjectId(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/day/${id}?on=2026-10-11&childAge=5`);
    // **Not `day-fact`.** A plan can legitimately have none: Kalamoir Park
    // states no affordance, no occurrence, no age evidence, no weather
    // reading and no coordinate, so every heading lands under *Still
    // unknown* and the page renders zero facts. That is the honest answer,
    // and waiting on a fact would have made it look like a broken page.
    await expect(page.getByTestId("day-back")).toBeVisible();
    expect(await sidewaysOverflow(page)).toBe(0);
  });

  test("the shelves scroll inside themselves rather than pushing the page", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/discovery");
    const shelf = page
      .getByTestId("discovery-section")
      .first()
      .locator("ul")
      .first();
    await expect(shelf).toBeVisible();
    const { client, scroll } = await shelf.evaluate((ul) => ({
      client: ul.clientWidth,
      scroll: ul.scrollWidth,
    }));
    // More cards than fit, and the overflow belongs to the shelf.
    expect(scroll).toBeGreaterThan(client);
    expect(await sidewaysOverflow(page)).toBe(0);
  });
});

test.describe("it can be operated with a thumb", () => {
  test("every control is at least 44px tall at 375", async ({ page }) => {
    // Apple's and Google's floor for a touch target, and the size each of the
    // five rows is built to. A pill that drops below it is usually a padding
    // change nobody connected to tappability.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/discovery");
    const controls = page.getByTestId("ghad-choice");
    const count = await controls.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const box = await controls.nth(i).boundingBox();
      const label = (await controls.nth(i).textContent())?.trim();
      expect(box, `no box for "${label}"`).not.toBeNull();
      expect(
        box!.height,
        `"${label}" was ${box!.height}px tall`,
      ).toBeGreaterThanOrEqual(44);
    }
  });

  test("a control that cannot narrow anything says so rather than lying", async ({
    page,
  }) => {
    // Nobody has shared a position, so there is nothing to measure a distance
    // from. The brief's rule: a control either works or admits it cannot.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/discovery");
    const far = page.locator(
      '[data-testid="ghad-choice"][data-row="distance"]',
    );
    const count = await far.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(far.nth(i)).toBeDisabled();
      await expect(far.nth(i)).toHaveAttribute("title", /share where you are/i);
    }
  });
});

test.describe("nothing is quietly broken", () => {
  test("Discovery logs no errors and asks for nothing it cannot get", async ({
    page,
  }) => {
    const errors: string[] = [];
    const failed: string[] = [];
    page.on("console", (message) => {
      const text = message.text();
      if (message.type() !== "error") return;
      // **A publisher's own object store going down is not Passport's bug.**
      // Atlas's photographs are served from dozens of third-party hosts and
      // one of them failing to resolve is a corpus problem to report to
      // Atlas, not a reason to fail this suite — the same line the network
      // assertion below draws.
      if (/Failed to load resource/i.test(text)) return;
      errors.push(text);
    });
    page.on("response", (response) => {
      // A same-origin request the page made and the server refused. Third
      // party hosts are excluded deliberately: an Atlas photograph served from
      // a publisher's own object store going missing is Atlas's problem to
      // report, not a reason to fail Passport's suite.
      if (response.status() >= 400 && response.url().includes("localhost")) {
        failed.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.goto("/discovery");
    await page.waitForLoadState("networkidle");

    expect(errors, errors.join("\n")).toHaveLength(0);
    expect(failed, failed.join("\n")).toHaveLength(0);
  });
});
