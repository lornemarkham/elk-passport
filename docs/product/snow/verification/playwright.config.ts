import { defineConfig } from "@playwright/test";

/**
 * Powder Day on two phones, against a real local Supabase (stack.mjs).
 * Starts no server: run `next dev -p 3132` (or a production build) with the
 * stack's env, then E2E_PORT=3132 npx playwright test -c <this file>.
 */
const PORT = Number(process.env.E2E_PORT ?? 3132);

export default defineConfig({
  testDir: ".",
  testMatch: /(two-phones|hill|sesh)\.spec\.ts$/,
  reporter: "list",
  workers: 1,
  timeout: 240_000,
  expect: { timeout: 20_000 },
  outputDir: process.env.E2E_OUTPUT ?? `${process.env.HOME}/scratch/snow-e2e`,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  },
  projects: [{ name: "phone" }],
});
