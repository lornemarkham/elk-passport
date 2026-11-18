import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const gate = vi.hoisted(() => ({ admin: true }));
vi.mock("@/lib/admin/requireAdmin", () => ({
  requireAdminApi: async () =>
    gate.admin
      ? { admin: { email: "owner@example.ca" } }
      : { response: NextResponse.json({ error: "no" }, { status: 403 }) },
}));

import { clearPulseLimits } from "@/lib/pulse/http";
import { pulseDay } from "@/lib/pulse/service";
import { memoryStore, setPulseStoreForTests } from "@/lib/pulse/store";
import { GET, POST } from "./route";

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/pulse/admin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost",
        Host: "localhost",
      },
      body: JSON.stringify(body),
    }),
  );
const get = () => GET(new Request("http://localhost/api/pulse/admin"));

const ID = "abcd2345";
beforeEach(async () => {
  gate.admin = true;
  clearPulseLimits();
  const store = memoryStore();
  await store.create(
    {
      id: ID,
      question: "Should every school start later in the morning?",
      description: null,
      options: [
        { id: "o1", label: "Yes" },
        { id: "o2", label: "No" },
      ],
      claim: null,
      sourceUrl: null,
      scope: { kind: "canada" },
      expiresAt: null,
      status: "live",
      createdAt: new Date().toISOString(),
    },
    { creator: "c", net: "n" },
    10,
  );
  setPulseStoreForTests(store);
});
afterEach(() => setPulseStoreForTests(undefined));

describe("Question of the Day administration", () => {
  it("is for administrators only", async () => {
    gate.admin = false;
    expect((await get()).status).toBe(403);
    expect((await post({ day: pulseDay(new Date()), id: ID })).status).toBe(
      403,
    );
  });

  it("features a Pulse for today, lists it, and clears it", async () => {
    const today = pulseDay(new Date());
    expect((await post({ day: today, id: ID })).status).toBe(200);
    const listed = await (await get()).json();
    expect(listed.today).toBe(today);
    expect(listed.featured).toEqual([
      expect.objectContaining({ day: today, id: ID }),
    ]);
    expect(listed.candidates.map((c: { id: string }) => c.id)).toContain(ID);
    expect((await post({ day: today, id: null })).status).toBe(200);
    expect((await (await get()).json()).featured).toEqual([]);
  });

  it("refuses past days, bad days, bad ids and Pulses that don't exist", async () => {
    expect((await post({ day: "2020-01-01", id: ID })).status).toBe(400);
    expect((await post({ day: "tomorrow", id: ID })).status).toBe(400);
    expect((await post({ day: "2031-02-30", id: ID })).status).toBe(400);
    expect((await post({ day: pulseDay(new Date()), id: "x" })).status).toBe(
      400,
    );
    expect(
      (await post({ day: pulseDay(new Date()), id: "zzzzzzzz" })).status,
    ).toBe(404);
  });

  it("still moderates: a status change without a day is unchanged", async () => {
    expect((await post({ id: ID, status: "review" })).status).toBe(200);
    expect((await post({ id: ID, status: "nonsense" })).status).toBe(400);
  });
});

describe("Proposed questions", () => {
  it("lists drafts as unpublished, and publishes one only when an administrator asks", async () => {
    const before = await (await get()).json();
    const draft = before.drafts.find(
      (d: { id: string }) => d.id === "know-your-neighbours",
    );
    expect(draft.published).toBeNull();
    expect(before.usage).toMatchObject({ days: 30 });

    gate.admin = false;
    expect((await post({ draft: "know-your-neighbours" })).status).toBe(403);
    gate.admin = true;

    const res = await post({ draft: "know-your-neighbours" });
    expect(res.status).toBe(200);
    const { id } = await res.json();
    const after = await (await get()).json();
    expect(
      after.drafts.find((d: { id: string }) => d.id === "know-your-neighbours")
        .published,
    ).toBe(id);
    // Publishing twice is refused, not duplicated.
    expect(
      await (await post({ draft: "know-your-neighbours" })).json(),
    ).toMatchObject({
      error: "taken",
      id,
    });
  });

  it("holds a high-stakes draft until the administrator confirms the review", async () => {
    const res = await post({ draft: "flu-shot-this-season" });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "unconfirmed" });
    expect(
      (await post({ draft: "flu-shot-this-season", confirmed: true })).status,
    ).toBe(200);
  });

  it("refuses a draft that doesn't exist", async () => {
    expect((await post({ draft: "made-up" })).status).toBe(404);
  });
});
