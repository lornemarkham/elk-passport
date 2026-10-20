/**
 * The one place the Hockey verification specs get a test password.
 *
 * No password is written in source. `playwright.config.ts` sets
 * HOCKEY_TEST_PASSWORD once, in the main Playwright process, before any worker
 * starts — so every spec file and every worker sees the same value, and a
 * credential scanner has no literal to find. Set it yourself to pin a value.
 */
const fromEnv = process.env.HOCKEY_TEST_PASSWORD;

if (!fromEnv) {
  throw new Error(
    "HOCKEY_TEST_PASSWORD is not set. Run these specs through " +
      "`npx playwright test -c docs/product/hockey/verification`, whose config sets it.",
  );
}

export const TEST_PASSWORD: string = fromEnv;
