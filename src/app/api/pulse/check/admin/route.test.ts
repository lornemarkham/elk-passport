import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const gate = vi.hoisted(() => ({
  admin: false,
  device: null as string | null,
}));
vi.mock("@/lib/admin/requireAdmin", () => ({
  requireAdminApi: async () =>
    gate.admin
      ? { admin: { email: "owner@example.ca" } }
      : { response: NextResponse.json({ error: "no" }, { status: 403 }) },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "pulse_device" && gate.device
        ? { value: gate.device }
        : undefined,
    set: () => {},
  }),
}));

import { CONFIRMATIONS } from "@/lib/pulse/check";
import { createCheck } from "@/lib/pulse/checkService";
import {
  memoryCheckStore,
  setCheckStoreForTests,
} from "@/lib/pulse/checkStore";
import { clearPulseLimits } from "@/lib/pulse/http";
import { newDevice } from "@/lib/pulse/service";
import {
  memoryStore,
  pulseKey,
  setPulseStoreForTests,
} from "@/lib/pulse/store";
import { GET as fileGET } from "../[id]/file/route";
import { GET, POST } from "./route";

const ASKER = newDevice();
let id = "";

const req = (url: string, body?: unknown) =>
  new Request(`http://localhost${url}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost",
      Host: "localhost",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const file = () =>
  fileGET(req(`/api/pulse/check/${id}/file`), {
    params: Promise.resolve({ id }),
  });

beforeEach(async () => {
  gate.admin = false;
  gate.device = null;
  clearPulseLimits();
  const pulses = memoryStore();
  const checks = memoryCheckStore(pulses);
  setPulseStoreForTests(pulses);
  setCheckStoreForTests(checks);
  const jpeg = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.alloc(64),
  ]);
  const r = await createCheck(
    { pulses, checks },
    pulseKey()!,
    {
      claim: {
        text: "Kelowna General Hospital is operating at 147% capacity.",
        form: "screenshot",
      },
      confirm: Object.fromEntries(
        Object.keys(CONFIRMATIONS).map((k) => [k, true]),
      ),
      file: jpeg.toString("base64"),
      openedAt: Date.now() - 60_000,
    },
    { device: ASKER, ip: "ip:1", now: new Date() },
  );
  if (!r.ok) throw new Error(r.message);
  id = r.pulse.id;
});
afterEach(() => {
  setPulseStoreForTests(undefined);
  setCheckStoreForTests(undefined);
});

describe("the private screenshot", () => {
  it("is nothing at all to anyone else", async () => {
    expect((await file()).status).toBe(404);
    gate.device = newDevice();
    expect((await file()).status).toBe(404);
  });

  it("opens for the browser that published it, privately", async () => {
    gate.device = ASKER;
    const res = await file();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toContain("private");
    expect(res.headers.get("content-security-policy")).toContain("sandbox");
  });

  it("opens for an administrator", async () => {
    gate.admin = true;
    expect((await file()).status).toBe(200);
  });
});

describe("Pulse Check moderation", () => {
  it("is for administrators only", async () => {
    expect((await GET(req("/api/pulse/check/admin"))).status).toBe(403);
    expect(
      (
        await POST(
          req("/api/pulse/check/admin", { post: "abcd2345", status: "hidden" }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await POST(
          req("/api/pulse/check/admin", {
            check: id,
            note: "A moderator note here.",
          }),
        )
      ).status,
    ).toBe(403);
  });

  it("adds a moderator's note to the public history", async () => {
    gate.admin = true;
    const res = await POST(
      req("/api/pulse/check/admin", {
        check: id,
        note: "Wording checked against the original post.",
      }),
    );
    expect(res.status).toBe(200);
    const list = await (await GET(req("/api/pulse/check/admin"))).json();
    expect(list.recent[0].corrections).toBe(1);
  });
});
