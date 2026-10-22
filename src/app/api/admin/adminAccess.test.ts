/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * **The workbench is closed to everyone but approved administrators, on every
 * proxy route — proven by calling them, not by reading them.**
 *
 * The failure this guards is not a wrong check, it is a route nobody checked:
 * `/api/admin/*` used to attach `ADMIN_TOKEN` for any caller on the internet.
 * So every route module is discovered by glob (a route added tomorrow is
 * covered without anyone remembering to list it) and driven as three people:
 * a stranger, a signed-in non-administrator, and an administrator.
 */

type User = { email: string | null; email_confirmed_at: string | null } | null;
let user: User = null;

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user } }) },
  }),
}));

const routes = import.meta.glob("/src/app/api/admin/**/route.ts", {
  eager: true,
}) as Record<string, Record<string, unknown>>;

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
type Handler = (req: Request, ctx: unknown) => Promise<Response>;

const ctx = {
  params: Promise.resolve({ id: "e1", runId: "r1", regionId: "g1" }),
};

const handlers = Object.entries(routes).flatMap(([file, mod]) =>
  METHODS.filter((m) => typeof mod[m] === "function").map((method) => ({
    label: `${method} ${file.replace("/src/app/api", "/api").replace("/route.ts", "")}`,
    run: () =>
      (mod[method] as Handler)(
        new Request("http://passport.test/x", {
          method,
          headers: { "content-type": "application/json" },
          body: method === "GET" ? undefined : "{}",
        }),
        ctx,
      ),
  })),
);

let fetchMock: ReturnType<typeof vi.fn>;
const ENV = { ...process.env };

beforeEach(() => {
  user = null;
  fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  process.env.ADMIN_TOKEN = "secret-admin-token";
  process.env.ADMIN_EMAILS = "curator@example.com";
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...ENV };
});

describe("discovery", () => {
  it("finds the proxy routes", () => {
    expect(handlers.length).toBeGreaterThanOrEqual(29);
  });
});

describe.each(handlers)("$label", ({ run }) => {
  it("answers a stranger 401 and never reaches Atlas", async () => {
    const response = await run();
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.stringify(await response.json())).not.toContain(
      "secret-admin-token",
    );
  });

  it("answers a signed-in non-administrator 403 and never reaches Atlas", async () => {
    user = { email: "visitor@example.com", email_confirmed_at: "2026-01-01" };
    const response = await run();
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a listed but unverified address", async () => {
    user = { email: "curator@example.com", email_confirmed_at: null };
    expect((await run()).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is closed when ADMIN_EMAILS is unset, even for the right address", async () => {
    delete process.env.ADMIN_EMAILS;
    user = { email: "curator@example.com", email_confirmed_at: "2026-01-01" };
    expect((await run()).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("an approved administrator", () => {
  beforeEach(() => {
    user = { email: "Curator@Example.com", email_confirmed_at: "2026-01-01" };
  });

  it("reaches Atlas with ADMIN_TOKEN attached on the server", async () => {
    const { POST } = routes["/src/app/api/admin/merge/route.ts"] as {
      POST: Handler;
    };
    const response = await POST(
      new Request("http://passport.test/api/admin/merge", {
        method: "POST",
        body: JSON.stringify({ survivingId: "a", absorbedIds: ["b"] }),
      }),
      ctx,
    );
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/admin\/merge$/);
    expect((init.headers as Record<string, string>)["x-admin-token"]).toBe(
      "secret-admin-token",
    );
  });

  it("reads a list through the proxy", async () => {
    const { GET } = routes["/src/app/api/admin/duplicates/route.ts"] as {
      GET: Handler;
    };
    const response = await GET(new Request("http://passport.test/x"), ctx);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("still says so when ADMIN_TOKEN is missing, rather than calling Atlas", async () => {
    delete process.env.ADMIN_TOKEN;
    const { POST } = routes["/src/app/api/admin/merge/route.ts"] as {
      POST: Handler;
    };
    const response = await POST(
      new Request("http://passport.test/x", { method: "POST", body: "{}" }),
      ctx,
    );
    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("structure", () => {
  const files: string[] = (
    readdirSync(path.join(process.cwd(), "src"), {
      recursive: true,
    }) as string[]
  )
    .map((f) => path.join("src", f))
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
  const read = (f: string) => readFileSync(path.join(process.cwd(), f), "utf8");

  it("no admin route names a localhost Atlas", () => {
    const offenders = files.filter(
      (f) =>
        (f.startsWith("src/app/api/admin/") ||
          f === "src/lib/knowledge/regions.ts") &&
        /["'`]https?:\/\/(localhost|127\.0\.0\.1)/.test(read(f)),
    );
    expect(offenders).toEqual([]);
  });

  it("every admin route handler calls the gate before it does anything", () => {
    const offenders = files
      .filter((f) => /^src\/app\/api\/admin\/.*route\.ts$/.test(f))
      .filter((f) => {
        const text = read(f);
        const handlers = text.match(
          /export async function (GET|POST|PUT|PATCH|DELETE)\b/g,
        );
        const gates = text.match(/await requireAdminApi\(\)/g);
        return (handlers?.length ?? 0) !== (gates?.length ?? 0);
      });
    expect(offenders).toEqual([]);
  });

  it("ADMIN_TOKEN is never read by client code or a public variable", () => {
    const offenders = files.filter((f) => {
      const text = read(f);
      const isClient = /^\s*["']use client["']/.test(text);
      return (
        /NEXT_PUBLIC_[A-Z_]*(ADMIN_TOKEN|SERVICE_TOKEN)/.test(text) ||
        (isClient &&
          /process\.env\.(ADMIN_TOKEN|ADMIN_EMAILS|ATLAS_SERVICE_TOKEN)/.test(
            text,
          ))
      );
    });
    expect(offenders).toEqual([]);
  });

  it("every admin and explorer page gates itself, not just its layout", () => {
    const offenders = files
      .filter((f) => /^src\/app\/(admin|explorer)\/.*page\.tsx$/.test(f))
      .filter((f) => !/await requireAdminPage\(/.test(read(f)));
    expect(offenders).toEqual([]);
  });

  it("a page outside the workbench reaches an ADMIN_TOKEN reader only past the gate", () => {
    // These modules attach ADMIN_TOKEN themselves; /passport/[id] once read
    // the whole corpus with it for anybody who typed ?curator=1.
    const readers =
      /@\/lib\/(knowledge\/(workspaceData|adminSummary|domainWork|regions|runData|researchMissions)|data\/explorer-dossier-repo|explorer\/passportView)["']/;
    const offenders = files
      .filter((f) => /^src\/app\/.*(page|layout|route)\.tsx?$/.test(f))
      .filter((f) => !/^src\/app\/(admin|explorer|api\/admin)\//.test(f))
      .filter((f) => readers.test(read(f)))
      .filter(
        (f) => !/adminVerdictForRequest|requireAdmin(Page|Api)/.test(read(f)),
      );
    expect(offenders).toEqual([]);
  });

  it("every server action is gated", () => {
    const offenders = files
      .filter((f) => /^\s*["']use server["']/.test(read(f)))
      .filter(
        (f) => f.includes("/admin/") && !/requireAdminAction\(\)/.test(read(f)),
      );
    expect(offenders).toEqual([]);
  });
});
