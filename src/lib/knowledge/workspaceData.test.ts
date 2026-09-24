import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * **Atlas's address is configuration, not a constant.**
 *
 * This module hardcoded `http://localhost:3000` while `ATLAS_API_URL` said
 * 3001. Every admin read threw, `loadWorkspaceBundle` caught it and returned
 * null, and `/passport/[id]` answered 404 for every entity in the corpus — so
 * the traveller page that Organizations, Events and thin Places all depend on
 * appeared not to exist. It existed; nothing could reach it.
 *
 * Asserted against the source rather than by importing, because the value is
 * read at module scope: any import here would bind whatever the test
 * environment happened to hold, which is exactly the class of bug this guards.
 */
describe("workspaceData", () => {
  const source = readFileSync(
    join(process.cwd(), "src/lib/knowledge/workspaceData.ts"),
    "utf8",
  );

  it("reads Atlas's base URL from ATLAS_API_URL", () => {
    expect(source).toMatch(
      /const ATLAS_BASE_URL = process\.env\.ATLAS_API_URL \?\?/,
    );
  });

  it("names no port of its own outside that one fallback", () => {
    // Comments stripped first: the rule is about what the module *does*, and
    // the doc comment quotes the old address precisely to explain the bug.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    const hardcoded = code.match(/["'`]https?:\/\/localhost:\d+/g) ?? [];
    expect(hardcoded).toHaveLength(1);
  });
});
