import { defineConfig } from "@playwright/test";

/**
 * Date Night — Jess's invitation and Lorne's private answers, on a phone.
 *
 * Starts no server: run it against a production build started with the
 * local stack's env (stack.mjs) and an Atlas stand-in, on a port whose
 * provenance you know (README.md, "Verification").
 */
const PORT = Number(process.env.E2E_PORT ?? 3120);

export default defineConfig({
  testDir: ".",
  testMatch: /date-night\.spec\.ts$/,
  reporter: "list",
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  outputDir:
    process.env.E2E_OUTPUT ?? `${process.env.HOME}/scratch/date-night-e2e`,
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
