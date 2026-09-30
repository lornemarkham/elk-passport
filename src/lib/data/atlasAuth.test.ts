import { readdirSync, readFileSync } from "node:fs";
import { join as joinPath } from "node:path";
import { join } from "node:path";
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import {
  atlasAuthHeaders,
  atlasIsConfigured,
  atlasServiceToken,
  AtlasUnavailableError,
  describeAtlasFailure,
  isAtlasUnavailable,
} from "./atlasAuth";

/**
 * **Passport proves it is Passport, in one place, and never in the browser.**
 *
 * Atlas stopped answering the internet: every route but `/health` wants
 * `Authorization: Bearer $ATLAS_SERVICE_TOKEN`, and admin routes want that
 * *and* `x-admin-token`. Two claims, neither substituting for the other.
 */
const ORIGINAL = process.env.ATLAS_SERVICE_TOKEN;

beforeEach(() => {
  process.env.ATLAS_SERVICE_TOKEN = "test-service-token";
});
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ATLAS_SERVICE_TOKEN;
  else process.env.ATLAS_SERVICE_TOKEN = ORIGINAL;
});

describe("the header Passport presents", () => {
  it("is a bearer token", () => {
    expect(atlasAuthHeaders().Authorization).toBe("Bearer test-service-token");
  });

  it("keeps every header the caller already had", () => {
    const headers = atlasAuthHeaders({
      "x-admin-token": "admin",
      "Content-Type": "application/json",
    });
    // The whole point: an admin call sends BOTH claims.
    expect(headers["x-admin-token"]).toBe("admin");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers.Authorization).toBe("Bearer test-service-token");
  });

  it("does not overwrite an Authorization the caller chose", () => {
    expect(
      atlasAuthHeaders({ Authorization: "Bearer theirs" }).Authorization,
    ).toBe("Bearer theirs");
  });

  it("sends nothing rather than inventing a token", () => {
    delete process.env.ATLAS_SERVICE_TOKEN;
    expect(atlasAuthHeaders().Authorization).toBeUndefined();
    expect(atlasIsConfigured()).toBe(false);
    // The admin claim still goes; only the one we do not have is absent.
    expect(atlasAuthHeaders({ "x-admin-token": "a" })["x-admin-token"]).toBe(
      "a",
    );
  });

  it("treats an empty or blank token as unset", () => {
    process.env.ATLAS_SERVICE_TOKEN = "   ";
    expect(atlasServiceToken()).toBeUndefined();
    expect(atlasAuthHeaders().Authorization).toBeUndefined();
  });

  it("reads the token per call, so a rotated secret is used", () => {
    expect(atlasAuthHeaders().Authorization).toBe("Bearer test-service-token");
    process.env.ATLAS_SERVICE_TOKEN = "rotated";
    expect(atlasAuthHeaders().Authorization).toBe("Bearer rotated");
  });
});

describe("what a refusal means", () => {
  it("calls a 401 with a token configured a refused token", () => {
    const failure = describeAtlasFailure(401);
    expect(failure?.reason).toBe("unauthorized");
    expect(failure?.status).toBe(401);
  });

  it("calls a 401 with no token configured our own misconfiguration", () => {
    delete process.env.ATLAS_SERVICE_TOKEN;
    expect(describeAtlasFailure(401)?.reason).toBe("not-configured");
  });

  it("calls Atlas's own 503 Atlas's problem, not ours", () => {
    expect(describeAtlasFailure(503)?.reason).toBe("unavailable");
  });

  it("leaves an ordinary answer alone", () => {
    // A 404 is Atlas answering. Only auth failures are this function's.
    expect(describeAtlasFailure(404)).toBeUndefined();
    expect(describeAtlasFailure(200)).toBeUndefined();
    expect(describeAtlasFailure(500)).toBeUndefined();
  });

  it("keeps the underlying cause so a network fault stays diagnosable", () => {
    const cause = new Error("getaddrinfo ENOTFOUND atlas");
    const error = new AtlasUnavailableError("unreachable", undefined, {
      cause,
    });
    expect(isAtlasUnavailable(error)).toBe(true);
    expect(error.cause).toBe(cause);
  });

  it("is recognisable, and an ordinary Error is not", () => {
    expect(isAtlasUnavailable(new Error("nope"))).toBe(false);
    expect(isAtlasUnavailable(undefined)).toBe(false);
  });
});

/**
 * The security property, asserted against the source rather than the runtime:
 * `server-only` is a build-time guarantee, and a test that imported its way
 * around it would be proving the opposite of what it claims.
 */
describe("the token never reaches a browser", () => {
  const read = (path: string) =>
    readFileSync(join(process.cwd(), path), "utf8");

  it("is declared server-only", () => {
    expect(read("src/lib/data/atlasAuth.ts")).toMatch(/^import "server-only";/);
  });

  it("is never named with a NEXT_PUBLIC_ prefix anywhere", () => {
    // `NEXT_PUBLIC_*` is inlined into the JavaScript served to every visitor.
    const hits = grepSource(/NEXT_PUBLIC_[A-Z_]*ATLAS|ATLAS[A-Z_]*NEXT_PUBLIC/);
    expect(hits).toEqual([]);
  });

  it("is read by no client component", () => {
    const offenders = sourceFiles()
      .filter((f) => read(f).includes("ATLAS_SERVICE_TOKEN"))
      .filter((f) => read(f).startsWith('"use client"'));
    expect(offenders).toEqual([]);
  });

  it("is read from the environment in exactly one module", () => {
    // Other modules may *name* it in an operator's error message; only this
    // one may read it, so there is one place to get the reading wrong.
    const readers = sourceFiles().filter(
      (f) =>
        !f.endsWith(".test.ts") &&
        /process\.env\.ATLAS_SERVICE_TOKEN/.test(read(f)),
    );
    expect(readers).toEqual(["src/lib/data/atlasAuth.ts"]);
  });

  /** Every `.ts`/`.tsx` under `src`, walked rather than globbed: the repo's
   *  TypeScript lib does not declare `fs.globSync`. */
  function sourceFiles(dir = "src"): string[] {
    return readdirSync(joinPath(process.cwd(), dir), {
      withFileTypes: true,
    }).flatMap((entry) => {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return sourceFiles(path);
      return /\.tsx?$/.test(entry.name) ? [path] : [];
    });
  }

  function grepSource(pattern: RegExp): string[] {
    return sourceFiles().filter((f) => pattern.test(read(f)));
  }
});
