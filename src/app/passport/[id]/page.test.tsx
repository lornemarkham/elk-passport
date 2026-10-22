import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { DiscoveryCandidate } from "@/lib/data/types";

/**
 * **`/passport/[id]` renders what Atlas does not compose, and does not call
 * an Atlas failure a missing page.**
 *
 * Atlas composes Organizations, Experiences and Events. Everything else that
 * reached this page fell through to the curator's admin bundle, which the
 * traveller's Passport cannot read, and rendered "There's nothing at this
 * address". Real candidates from the committed Atlas body stand in for
 * Discovery's read; the composed reads answer "not that kind" (404 → null),
 * which is what Atlas does for an Activity or a Place id.
 */
const corpus = JSON.parse(
  gunzipSync(
    readFileSync(
      resolve(
        __dirname,
        "../../../../docs/product/critic/evidence/atlas-candidates-2026-10-11.json.gz",
      ),
    ),
  ).toString("utf8"),
) as DiscoveryCandidate[];

const getSubjectDetail = vi.fn();
const listDiscoveryCandidates = vi.fn();
const loadWorkspaceBundle = vi.fn();

vi.mock("@/lib/data/atlas-repo", () => ({
  getSubjectDetail: (...args: unknown[]) => getSubjectDetail(...args),
  listDiscoveryCandidates: (...args: unknown[]) =>
    listDiscoveryCandidates(...args),
}));
vi.mock("@/lib/knowledge/workspaceData", () => ({
  loadWorkspaceBundle: () => loadWorkspaceBundle(),
}));
vi.mock("@/lib/auth/currentUser", () => ({ currentUser: async () => null }));
let admin = false;
vi.mock("@/lib/admin/requireAdmin", () => ({
  adminVerdictForRequest: async () =>
    admin
      ? { ok: true, email: "curator@example.com" }
      : { ok: false, reason: "not-approved" },
}));

const { default: PassportPage } = await import("./page");

const open = (id: string, query: Record<string, string> = {}) =>
  PassportPage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve(query),
  });

/** What Next throws for `redirect()` and `notFound()`, by its digest. */
const digestOf = async (page: Promise<unknown>) => {
  try {
    await page;
  } catch (error) {
    return (error as { digest?: string }).digest ?? (error as Error).message;
  }
  return "rendered";
};

beforeEach(() => {
  getSubjectDetail.mockReset().mockResolvedValue(null);
  listDiscoveryCandidates.mockReset().mockResolvedValue(corpus);
  // The admin bundle is unreadable without an admin token, as on production.
  loadWorkspaceBundle.mockReset().mockRejectedValue(new Error("401"));
  admin = false;
});

describe("/passport/[id]", () => {
  it("renders an Activity from its Discovery candidate (U-Pick Apple Orchard Tours)", async () => {
    render(await open("59b5ed9c-b075-4d21-9e84-a608d1aaa12d"));
    expect(
      screen.getByRole("heading", { name: "U-Pick Apple Orchard Tours" }),
    ).toBeTruthy();
    expect(screen.getByTestId("candidate-subject")).toBeTruthy();
    // And the step a decided person needs, into the day.
    expect(screen.getByTestId("lets-do-this").getAttribute("href")).toBe(
      "/day/59b5ed9c-b075-4d21-9e84-a608d1aaa12d",
    );
  });

  it("shows an Activity's picture when Atlas has one (Fairy Doors)", async () => {
    const { container } = render(
      await open("f3d2101f-c59a-4c46-905a-2b2607e5728d", {
        on: "2026-10-12",
        childAge: "5",
      }),
    );
    expect(screen.getByRole("heading", { name: "Fairy Doors" })).toBeTruthy();
    expect(container.querySelector("img")?.getAttribute("src")).toMatch(
      /^https:\/\//,
    );
    // The day and the age are carried into the day, never dropped.
    expect(screen.getByTestId("lets-do-this").getAttribute("href")).toBe(
      "/day/f3d2101f-c59a-4c46-905a-2b2607e5728d?on=2026-10-12&childAge=5",
    );
  });

  it("sends an old /passport link to a Place on to the Place page, query and all (Caravan Farm Theatre)", async () => {
    const digest = await digestOf(
      open("f54d6acc-91f7-4558-a2ad-6565f318f978", { on: "2026-10-12" }),
    );
    expect(digest).toContain(
      "/places/f54d6acc-91f7-4558-a2ad-6565f318f978?on=2026-10-12",
    );
    expect(digest).toMatch(/^NEXT_REDIRECT/);
  });

  it("carries a query with its own query string intact through the redirect", async () => {
    const digest = await digestOf(
      open("f54d6acc-91f7-4558-a2ad-6565f318f978", {
        back: "/discovery?x=1&y=2",
      }),
    );
    expect(digest).toContain(
      "/places/f54d6acc-91f7-4558-a2ad-6565f318f978?back=%2Fdiscovery%3Fx%3D1%26y%3D2",
    );
  });

  it("keeps a curator on this page for a Place, with the curator bar", async () => {
    admin = true;
    render(
      await open("f54d6acc-91f7-4558-a2ad-6565f318f978", { curator: "1" }),
    );
    expect(
      screen.getByRole("heading", { name: "Caravan Farm Theatre" }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Evidence" })).toBeTruthy();
  });

  it("shows a curator an Activity even without the admin bundle", async () => {
    admin = true;
    render(
      await open("59b5ed9c-b075-4d21-9e84-a608d1aaa12d", { curator: "1" }),
    );
    expect(
      screen.getByRole("heading", { name: "U-Pick Apple Orchard Tours" }),
    ).toBeTruthy();
  });

  it("treats ?curator=1 from anyone but an administrator as the traveller's page", async () => {
    const digest = await digestOf(
      open("f54d6acc-91f7-4558-a2ad-6565f318f978", { curator: "1" }),
    );
    expect(digest).toMatch(/^NEXT_REDIRECT/);
    render(
      await open("59b5ed9c-b075-4d21-9e84-a608d1aaa12d", { curator: "1" }),
    );
    expect(screen.queryByRole("link", { name: "Evidence" })).toBeNull();
    expect(loadWorkspaceBundle).not.toHaveBeenCalled();
  });

  it("never spends ADMIN_TOKEN on the corpus bundle for a non-administrator", async () => {
    loadWorkspaceBundle.mockResolvedValue({
      entities: [{ id: "00000000-0000-0000-0000-00000000a1d0" }],
      relationships: [],
      sources: [],
    });
    for (const query of [{}, { curator: "1" }] as Record<string, string>[]) {
      const digest = await digestOf(
        open("00000000-0000-0000-0000-00000000a1d0", query),
      );
      expect(digest).toMatch(/NOT_FOUND|404/);
    }
    expect(loadWorkspaceBundle).not.toHaveBeenCalled();
  });

  it("is a 404 only when nothing knows the id", async () => {
    const digest = await digestOf(open("00000000-0000-0000-0000-000000000000"));
    expect(digest).toMatch(/404/);
  });

  it("is an error, not a 404, when only Discovery's read failed", async () => {
    // The composed reads say "not that kind"; without the candidates there is
    // no telling the id is not an Activity.
    listDiscoveryCandidates.mockRejectedValue(new Error("Atlas 500"));
    const digest = await digestOf(open("59b5ed9c-b075-4d21-9e84-a608d1aaa12d"));
    expect(digest).toMatch(/Atlas did not answer/);
  });

  it("is an error, not a 404, when Atlas did not answer", async () => {
    getSubjectDetail.mockRejectedValue(new Error("Atlas 500"));
    listDiscoveryCandidates.mockRejectedValue(new Error("Atlas 500"));
    const digest = await digestOf(open("32866d7e-60d3-4575-8ace-1b37110cdd44"));
    expect(digest).toMatch(/Atlas did not answer/);
  });
});
