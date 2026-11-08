import { defineConfig, devices } from "@playwright/test";

/**
 * **The Go Have a Day journey, end to end** (owner brief "Go Have a Day — the
 * experience overhaul", 2026-11-08, P9) — desktop and phone.
 *
 * Starts no server, on purpose: run it against a production build started
 * with the local stack's env and the Atlas stand-in (see ../OVERHAUL.md,
 * "Verification"), on a port whose provenance you know.
 *
 *   E2E_PORT=3164 npx playwright test -c docs/product/go-have-a-day/verification
 */
const PORT = Number(process.env.E2E_PORT ?? 3164);

export default defineConfig({
  testDir: ".",
  testMatch: /journey\.spec\.ts$/,
  reporter: "list",
  workers: 1,
  timeout: 600_000,
  outputDir: process.env.E2E_OUTPUT ?? "/tmp/ghad-journey-playwright",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
});
