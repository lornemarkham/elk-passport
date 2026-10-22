import { expect, test } from "@playwright/test";
import { openTab } from "./night-tabs";
import { TEST_PASSWORD } from "./test-credentials";

/**
 * Hockey Night on a phone (320, 375 and 390 wide, touch). Checks what a coworker
 * on the concourse would feel: nothing scrolls sideways, and what they are
 * meant to tap is big enough to tap. Runs against the same built server and
 * local stack as the acceptance run.
 */
const stamp = Date.now().toString(36);

for (const width of [320, 375, 390]) {
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
          if (r.height < 40 || r.width < 32) {
            small.push(
              `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`,
            );
          }
        }
        // Visible text under 12 px is unreadable on a phone held at arm's length.
        const tiny = new Set<string>();
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
        );
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const el = n.parentElement;
          // Emoji-only nodes are avatars and icons, not words to read.
          if (!el || !/[A-Za-z0-9]/.test(n.textContent ?? "")) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          const style = getComputedStyle(el);
          if (style.visibility === "hidden" || style.display === "none")
            continue;
          if (parseFloat(style.fontSize) < 12)
            tiny.add(
              `${parseFloat(style.fontSize)}px "${(n.textContent ?? "").trim().slice(0, 30)}"`,
            );
        }
        return {
          overflow: doc.scrollWidth - doc.clientWidth,
          small,
          tiny: [...tiny],
        };
      });
      report.push(
        `${label}: overflow=${result.overflow}px small=${result.small.length}`,
      );
      for (const s of result.small) report.push(`   small: ${s}`);
      for (const t of result.tiny) report.push(`   tiny: ${t}`);
      expect
        .soft(result.overflow, `${label} scrolls sideways`)
        .toBeLessThanOrEqual(0);
      expect
        .soft(result.small, `${label} has taps smaller than 40px`)
        .toEqual([]);
      expect
        .soft(result.tiny, `${label} has text smaller than 12px`)
        .toEqual([]);
    }

    await page.goto("/hockey");
    await page.getByRole("tab", { name: "Sign Up" }).click();
    await page
      .getByLabel("Email address")
      .fill(`phone${width}-${stamp}@example.test`);
    await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
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
    // Every room of the night, at this width.
    for (const name of ["Play", "Chat", "Group", "Plan"] as const) {
      await openTab(page, name);
      await audit(`night, ${name}`);
    }
    console.log(report.join("\n"));
    await context.close();
  });
}
