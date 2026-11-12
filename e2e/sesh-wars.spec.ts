import { devices, expect, test } from "@playwright/test";

/**
 * **Sesh Wars ships demo-capable** (M737). Its tables are a proposal in
 * `docs/product/snow/sesh-wars-migration.sql`, so on a Passport without them
 * `/snow/sesh-wars` says it is warming up and opens the demo, and the demo
 * mountain is fully playable on the visitor's own device. The full journey,
 * and the real thing on a local stack, are
 * `docs/product/snow/verification/sesh.spec.ts`.
 */
for (const [label, device] of [
  ["desktop", devices["Desktop Chrome"]],
  ["phone", devices["Pixel 7"]],
] as const) {
  test.describe(label, () => {
    test.use({
      viewport: device.viewport,
      userAgent: device.userAgent,
      deviceScaleFactor: device.deviceScaleFactor,
      isMobile: device.isMobile,
      hasTouch: device.hasTouch,
    });

    test("Snow → Sesh Wars → the demo mountain, under the one header", async ({
      page,
    }) => {
      await page.goto("/snow");
      await page
        .getByRole("main")
        .getByRole("link", { name: /Sesh Wars/ })
        .first()
        .click();
      // The real page asks Supabase whether its tables exist first; against a
      // placeholder Supabase that takes several seconds.
      await expect(page).toHaveURL(/\/snow\/sesh-wars$/, { timeout: 20_000 });
      await expect(page.getByTestId("global-header")).toHaveCount(1);

      const demo = page.getByRole("link", {
        name: /Play the demo|Try the demo mountain/,
      });
      await demo.first().click();
      await expect(page).toHaveURL(/\/snow\/sesh-wars\/demo$/);
      await expect(page.getByText("Demo mode").first()).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /Every feature has a champion/i }),
      ).toBeVisible();
      await expect(page.getByTestId("global-header")).toHaveCount(1);

      await page.getByRole("link", { name: /SilverStar.*features/ }).click();
      await expect(
        page.getByRole("heading", { level: 1, name: "SilverStar" }),
      ).toBeVisible();
      await page
        .getByRole("link", { name: /Starlight Rail/ })
        .first()
        .click();
      await expect(
        page.getByRole("heading", { level: 1, name: "Starlight Rail" }),
      ).toBeVisible();
      await expect(page.getByText("Today's Champion")).toBeVisible();
    });
  });
}

test.describe("phone: record, preview and post to the demo", () => {
  test.use({
    viewport: devices["Pixel 7"].viewport,
    userAgent: devices["Pixel 7"].userAgent,
    isMobile: true,
    hasTouch: true,
  });

  test("RECORD VIDEO → preview → Replace → Remove → publish stays local", async ({
    page,
  }) => {
    const uploads: string[] = [];
    page.on("request", (r) => {
      if (r.method() !== "GET" && /video|upload|sesh/i.test(r.url()))
        uploads.push(`${r.method()} ${r.url()}`);
    });
    await page.goto("/snow/sesh-wars/demo/post");
    await expect(
      page.getByRole("heading", { name: /Post your session/ }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("video-destination")).toContainText(
      "not uploaded",
    );
    await expect(
      page.getByRole("button", { name: /Record video/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Upload video/i }),
    ).toBeVisible();

    const clip = (name: string, kb: number) => ({
      name,
      mimeType: "video/mp4",
      buffer: Buffer.alloc(kb * 1024, 1),
    });
    await page
      .getByTestId("video-record-input")
      .setInputFiles(clip("jump.mp4", 300));
    await expect(page.getByTestId("video-name")).toHaveText("jump.mp4");
    await expect(page.getByTestId("video-size")).toHaveText("300 KB");
    await expect(page.locator("video[controls]")).toBeVisible();

    await page.getByRole("button", { name: "Replace" }).click();
    await page
      .getByTestId("video-upload-input")
      .setInputFiles(clip("second.mp4", 600));
    await expect(page.getByTestId("video-name")).toHaveText("second.mp4");

    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByTestId("video-preview")).toHaveCount(0);
    await page
      .getByTestId("video-record-input")
      .setInputFiles(clip("final.mp4", 100));

    await page.getByRole("button", { name: /Starlight Rail/ }).click();
    await page.getByRole("button", { name: "Snowboard", exact: true }).click();
    await page.getByRole("button", { name: "Wingman", exact: true }).click();
    await page.getByRole("button", { name: "Best Trick", exact: true }).click();
    await page.getByPlaceholder("What did you land?").fill("Backside 180");
    await page.getByLabel(/I filmed this/).check();
    await page.getByLabel(/open, resort-built feature/).check();
    await expect(page.getByTestId("publish-destination")).toContainText(
      "stays on your phone",
    );
    await page.getByRole("button", { name: /Publish/ }).click();
    await page.waitForURL(/\/demo\/c\//);
    expect(uploads).toEqual([]);
  });
});
