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
 * The invariant did not move when Atlas started requiring a service token; its
 * home did. `atlasAuth` now owns the address for every Atlas caller, so what
 * this module must not do is name one of its own — and `atlasAuth.test.ts`
 * holds the other half, that the shared constant reads `ATLAS_API_URL`.
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

  it("takes Atlas's address from the one module that owns it", () => {
    expect(source).toMatch(/from "@\/lib\/data\/atlasAuth"/);
    expect(source).toMatch(/const \{ ATLAS_BASE_URL \} = AtlasAuth;/);
  });

  it("names no address of its own at all", () => {
    // Comments stripped first: the rule is about what the module *does*, and
    // the doc comment quotes the old address precisely to explain the bug.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(code.match(/["'`]https?:\/\/localhost:\d+/g) ?? []).toHaveLength(0);
    expect(code).not.toMatch(/process\.env\.ATLAS_API_URL/);
  });
});
