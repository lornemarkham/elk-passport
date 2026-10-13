import { defineConfig, devices } from "@playwright/test";

/**
 * Hockey Night's two-person acceptance run. Deliberately starts no server:
 * it must run against one built and started with the local stack's env
 * (see README.md here), on a port whose provenance you know.
 */
const PORT = Number(process.env.E2E_PORT ?? 3130);

export default defineConfig({
  testDir: ".",
  testMatch: /(acceptance|email-confirmation|plan-and-results)\.spec\.ts$/,
  reporter: "list",
  workers: 1,
  outputDir: "/tmp/hockey-playwright",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
