import { defineConfig } from "@playwright/test";

/**
 * Go Have a Christmas — the family's whole journey, on a phone.
 *
 * Starts no server: run it against a production build started with the
 * local stack's env (stack.mjs) and the Atlas stand-in, on a port whose
 * provenance you know (README.md, "Verification").
 */
const PORT = Number(process.env.E2E_PORT ?? 3131);

export default defineConfig({
  testDir: ".",
  testMatch: /christmas(-off)?\.spec\.ts$/,
  reporter: "list",
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  outputDir:
    process.env.E2E_OUTPUT ??
    `${process.env.HOME}/scratch/christmas/playwright`,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  },
  projects: [{ name: "phone" }],
});
