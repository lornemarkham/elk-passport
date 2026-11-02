import { defineConfig } from "@playwright/test";

/**
 * Smarter adventures — the real-user acceptance tests (A–E), on a phone.
 *
 * Starts no server: run against a production build started with the
 * Christmas verification stack's env (real GoTrue + PostgREST + Postgres)
 * and the Atlas stand-in serving Atlas's corpus of 2026-10-24. See README.
 */
const PORT = Number(process.env.E2E_PORT ?? 3132);

export default defineConfig({
  testDir: ".",
  testMatch: /smarter\.spec\.ts$/,
  reporter: "list",
  workers: 1,
  timeout: 240_000,
  expect: { timeout: 20_000 },
  outputDir:
    process.env.E2E_OUTPUT ?? `${process.env.HOME}/scratch/smart/playwright`,
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
