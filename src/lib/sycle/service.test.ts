import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SycleConfig } from "./config";
import { demo } from "./providers/demo";
import { memoryStore, store } from "./store";
import { forgetMe, lookUp, readBoard, saveMine, setInterest } from "./service";
import { blocked, codeMatches, issue, recordFailure, verify } from "./access";

const config = (over: Partial<SycleConfig> = {}): SycleConfig => ({
  accessCode: "vancouver",
  secret: "s".repeat(32),
  expiresAt: new Date("2099-01-01T00:00:00Z"),
  provider: demo,
  ...over,
});

const g = globalThis as unknown as {
  __sycleStore?: ReturnType<typeof memoryStore>;
};
beforeEach(() => {
  g.__sycleStore = memoryStore();
});

const today = () => new Date().toISOString().slice(0, 10);

async function join(
  id: string,
  number: string,
  visibility: "named" | "anonymous" | "off",
  name?: string,
) {
  const found = await lookUp(config(), number, today());
  if (!found.ok) throw new Error("lookup failed");
  return saveMine(config(), id, {
    flightKey: found.flights[0]!.key,
    flightNumber: number,
    date: today(),
    visibility,
    displayName: name,
  });
}

describe("the board, end to end over the demo provider", () => {
  it("looks up, confirms, and shows a named colleague to another", async () => {
    expect((await join("ana", "XX12", "named", "Ana")).ok).toBe(true);
    const view = await readBoard(config(), "ben");
    expect(view.board.arrivals).toHaveLength(1);
    expect(view.board.arrivals[0]!.name).toBe("Ana");
    expect(view.board.arrivals[0]!.demo).toBe(true);
  });

  it("refuses a flight the server did not itself look up", async () => {
    const r = await saveMine(config(), "ana", {
      flightKey: "FORGED|x|LHR",
      flightNumber: "XX12",
      date: today(),
      visibility: "named",
      displayName: "Ana",
    });
    expect(r.ok).toBe(false);
  });

  it("refuses to show somebody by name without a name", async () => {
    expect((await join("ana", "XX12", "named")).ok).toBe(false);
  });

  it("says plainly when lookup is not connected rather than inventing flights", async () => {
    expect(await lookUp(config({ provider: null }), "AC855", today())).toEqual({
      ok: false,
      reason: "not-connected",
    });
  });

  it("forgets a person completely, including their adventures", async () => {
    await join("ana", "XX12", "named", "Ana");
    await setInterest("ana", "subject-1", true);
    await forgetMe("ana");
    const view = await readBoard(config(), "ben");
    expect(view.board.arrivals).toHaveLength(0);
    expect(view.interest.size).toBe(0);
    expect(await store().participants()).toHaveLength(0);
  });

  it("erases every participant once the event data expires", async () => {
    await join("ana", "XX12", "named", "Ana");
    const view = await readBoard(
      config({ expiresAt: new Date(Date.now() - 1) }),
      "ana",
    );
    expect(view.board.arrivals).toHaveLength(0);
    expect(await store().participants()).toHaveLength(0);
  });

  it("keeps the last known record when a refresh fails", async () => {
    await join("ana", "XX18", "named", "Ana");
    const failing = config({
      provider: {
        name: "demo",
        lookup: vi.fn().mockRejectedValue(new Error("down")),
      },
    });
    const later = new Date(Date.now() + 3 * 24 * 3600_000);
    const view = await readBoard(failing, "ana", later);
    expect(view.board.arrivals).toHaveLength(1);
  });
});

describe("access", () => {
  it("signs and verifies a participant cookie, and rejects tampering", () => {
    const { id, value } = issue("k".repeat(32));
    expect(verify("k".repeat(32), value)).toBe(id);
    expect(verify("k".repeat(32), value.replace(/^./, "z"))).toBeNull();
    expect(verify("other".repeat(8), value)).toBeNull();
    expect(verify("k".repeat(32), undefined)).toBeNull();
  });

  it("brakes only wrong codes, so one shared address can still let everyone in", () => {
    expect(blocked("10.0.0.1", 0)).toBe(false);
    for (let i = 0; i < 10; i++) recordFailure("10.0.0.1", 0);
    expect(blocked("10.0.0.1", 1)).toBe(true);
    expect(blocked("10.0.0.2", 1)).toBe(false);
    expect(blocked("10.0.0.1", 16 * 60_000)).toBe(false);
  });

  it("forgives case and spaces in the code, nothing else", () => {
    expect(codeMatches("Sycle Vancouver", "  sycle vancouver ")).toBe(true);
    expect(codeMatches("Sycle Vancouver", "sycle vancouve")).toBe(false);
    expect(codeMatches("x", 42)).toBe(false);
  });
});
