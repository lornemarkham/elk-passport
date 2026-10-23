import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

// One throwaway password per run, shared by every spec (see test-credentials.ts).
process.env.HOCKEY_TEST_PASSWORD ??= `t-${randomBytes(12).toString("hex")}`;

/**
 * Hockey Night's two-person acceptance run. Deliberately starts no server:
 * it must run against one built and started with the local stack's env
 * (see README.md here), on a port whose provenance you know.
 */
const PORT = Number(process.env.E2E_PORT ?? 3130);

export default defineConfig({
  testDir: ".",
  testMatch:
    /(acceptance|email-confirmation|plan-and-results|mobile|multi-night|modules|redesign|polish|seats|arena-mode|arena-off|release1|release2|restaurant-photos|finish|finish-off|finish-play)\.spec\.ts$/,
  reporter: "list",
  workers: 1,
  outputDir: process.env.PW_OUT ?? "/tmp/hockey-playwright",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
