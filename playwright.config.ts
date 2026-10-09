import { defineConfig, devices } from "@playwright/test";

// A separate, fixed port for this app's own dev/test/prod servers — this
// machine may have other unrelated local projects already running on 3000.
//
// **Overridable, because `reuseExistingServer` is a trap.** Whatever is
// already listening on this port becomes the system under test. A `next dev`
// left running for eight days was found serving the whole suite: it compiles
// from current source, so most assertions still passed, but it had captured
// `.env.local` at the moment it started and was answering from a different
// Atlas — and its middleware was a stale bundle, so five experience-context
// tests failed against code that was correct.
//
// `E2E_PORT=3214 npx playwright test` points the suite at a server you
// started yourself and know the provenance of, and the command below honours
// it when Playwright starts one. CI always starts its own.
const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
