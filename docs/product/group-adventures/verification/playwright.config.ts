import { defineConfig, devices } from "@playwright/test";

/**
 * The group-adventures browser run. Deliberately starts no server: it must
 * run against a production build started with the local stack's env (see
 * ../README.md, "Verification"), on a port whose provenance you know.
 */
const PORT = Number(process.env.E2E_PORT ?? 3126);

export default defineConfig({
  testDir: ".",
  testMatch: /acceptance\.spec\.ts$/,
  reporter: "list",
  workers: 1,
  outputDir: "/tmp/adventures-playwright",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
