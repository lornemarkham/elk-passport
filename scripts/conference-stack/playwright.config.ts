import { defineConfig, devices } from "@playwright/test";

/**
 * The two-colleague acceptance run. Deliberately starts no server: it must run
 * against one built and started with the local stack's env and
 * CONFERENCE_STORE=supabase (see docs/products/go-have-a-conference/REAL-PEOPLE.md),
 * on a port whose provenance you know.
 */
const PORT = Number(process.env.E2E_PORT ?? 3150);

export default defineConfig({
  testDir: ".",
  testMatch: /acceptance\.spec\.ts$/,
  reporter: "list",
  workers: 1,
  outputDir: "/tmp/conference-playwright",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
