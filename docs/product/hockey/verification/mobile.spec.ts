import { expect, test } from "@playwright/test";

/**
 * Hockey Night on a phone (320 and 375 wide, touch). Checks what a coworker
 * on the concourse would feel: nothing scrolls sideways, and what they are
 * meant to tap is big enough to tap. Runs against the same built server and
 * local stack as the acceptance run.
 */
const PASSWORD = "puck-drops-at-seven";
const stamp = Date.now().toString(36);

for (const width of [320, 375]) {
  test(`phone ${width}px: host and guest screens do not overflow and taps are tappable`, async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({
      viewport: { width, height: 740 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    const report: string[] = [];

    async function audit(label: string) {
      const result = await page.evaluate(() => {
        const doc = document.documentElement;
        const small: string[] = [];
        for (const el of document.querySelectorAll<HTMLElement>(
          "button, a[href], input, select, textarea, [role=button]",
        )) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          const style = getComputedStyle(el);
          if (style.visibility === "hidden") continue;
          if (r.height < 32 || r.width < 32) {
            small.push(
              `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`,
            );
          }
        }
        return {
          overflow: doc.scrollWidth - doc.clientWidth,
          small,
        };
      });
      report.push(
        `${label}: overflow=${result.overflow}px small=${result.small.length}`,
      );
      for (const s of result.small) report.push(`   small: ${s}`);
      expect
        .soft(result.overflow, `${label} scrolls sideways`)
        .toBeLessThanOrEqual(0);
      expect
        .soft(result.small, `${label} has taps smaller than 32px`)
        .toEqual([]);
    }

    await page.goto("/hockey");
    await page.getByRole("tab", { name: "Sign Up" }).click();
    await page
      .getByLabel("Email address")
      .fill(`phone${width}-${stamp}@example.test`);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText(/Nothing on yet/)).toBeVisible();
    await audit("shelf");
    await page.getByLabel("Your name").fill("Pat");
    await page.getByRole("button", { name: "Start it" }).click();
    await expect(page).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
    await page.getByRole("button", { name: /Skip/ }).click();
    await expect(page.getByText("Canucks vs Wild")).toBeVisible();
    await audit("night, top");
    await page.screenshot({
      path: `${process.env.SHOTS ?? "."}/night-${width}-top.png`,
    });
    await page.screenshot({
      path: `${process.env.SHOTS ?? "."}/night-${width}-full.png`,
      fullPage: true,
    });
    // scroll through so lazy sections mount, then audit again
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
    });
    await audit("night, scrolled");
    console.log(report.join("\n"));
    await context.close();
  });
}
