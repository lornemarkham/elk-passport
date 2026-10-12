import { defineConfig, devices } from "@playwright/test";

/**
 * **The Discovery → Go have a day journeys, on a desktop and on a phone.**
 *
 * Its own config because it needs its own servers and must never meet anybody
 * else's: an Atlas stand-in it can switch into failure (`e2e/support/
 * atlas-standin.mjs`) and a `next dev` pointed at it. `reuseExistingServer`
 * is false on purpose — see the trap described in `playwright.config.ts`.
 * Nothing here calls a paid API and nothing needs a real key: the app runs on
 * its local fallbacks and the Supabase values are placeholders that fail fast.
 *
 *   npx playwright test -c playwright.journeys.config.ts
 *
 * Ports: 3122 (app), 3123 (stand-in). `JOURNEYS_PORT` moves the app; the
 * stand-in is always one above it.
 */
const PORT = Number(process.env.JOURNEYS_PORT ?? 3122);
const ATLAS_PORT = PORT + 1;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /discovery-journeys\.spec\.ts/,
  // One at a time: the stand-in's failure modes are global to the server.
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  outputDir: "test-results/journeys",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: `node e2e/support/atlas-standin.mjs docs/product/critic/evidence/atlas-candidates-2026-10-11.json.gz ${ATLAS_PORT}`,
      url: `http://127.0.0.1:${ATLAS_PORT}/__mode`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `npx next dev -p ${PORT}`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        ATLAS_API_URL: `http://127.0.0.1:${ATLAS_PORT}`,
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "placeholder",
      },
    },
  ],
});
