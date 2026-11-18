import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearPulseLimits } from "@/lib/pulse/http";
import {
  memoryStore,
  setPulseStoreForTests,
  type PulseStore,
} from "@/lib/pulse/store";
import { POST } from "./route";

const ID = "abcd2345";
let store: PulseStore;
const send = (body: unknown, origin = "http://localhost", id = ID) =>
  POST(
    new Request(`http://localhost/api/pulse/${id}/event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        Host: "localhost",
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );

beforeEach(async () => {
  clearPulseLimits();
  store = memoryStore();
  await store.create(
    {
      id: ID,
      kind: "rank",
      question: "Rank these for movie night",
      description: null,
      options: [
        { id: "o1", label: "Dune" },
        { id: "o2", label: "Up" },
        { id: "o3", label: "Heat" },
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

describe("usage events", () => {
  it("counts a share against the Pulse's kind, and nothing else", async () => {
    expect(await (await send({ event: "share" })).json()).toEqual({
      counted: true,
    });
    const u = await store.usage(1);
    expect(u.daily[0]?.events).toEqual({ share: 1 });
  });

  it("refuses unknown events, other sites, and Pulses that don't exist", async () => {
    expect((await send({ event: "pageview" })).status).toBe(400);
    expect(
      (await send({ event: "share" }, "https://evil.example")).status,
    ).toBe(403);
    expect(
      await (await send({ event: "share" }, undefined, "zzzzzzzz")).json(),
    ).toEqual({
      counted: false,
    });
  });

  it("stops one address from inflating the numbers", async () => {
    const codes = [];
    for (let i = 0; i < 22; i++)
      codes.push((await send({ event: "share" })).status);
    expect(codes.filter((c) => c === 429).length).toBeGreaterThan(0);
  });
});
