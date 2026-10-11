import { describe, expect, it } from "vitest";
import { formatCode, inviteState, normaliseCode } from "./access";
import { inkOn, safeAccent } from "./branding";
import { countdown, dateRange } from "./countdown";
import { parseDetails, retainUntilFor } from "./details";
import { SYCLE_VANCOUVER_2026 } from "./fixtures";
import { doorsFor, enabledModules, MODULES } from "./modules";
import type { ConferenceDetails, Invite } from "./types";

const sycle = (() => {
  const p = parseDetails(SYCLE_VANCOUVER_2026);
  if (!p.ok) throw new Error("fixture must parse");
  return p.details;
})();

describe("details", () => {
  it("reads Sycle as configuration, filling only safe defaults", () => {
    expect(sycle.branding.accent).toBe("#1f6feb");
    expect(sycle.endsOn).toBeUndefined();
    expect(sycle.modules).toEqual(["discover"]);
  });

  it.each([
    [{ name: "" }, "name"],
    [{ startsOn: "2026-02-30" }, "startsOn"],
    [{ timeZone: "Mars/Olympus" }, "timeZone"],
    [{ branding: { accent: "red; background:url(x)" } }, "branding.accent"],
    [{ modules: ["discover", "casino"] }, "modules.1"],
  ])("rejects %j", (patch, path) => {
    const r = parseDetails({ ...SYCLE_VANCOUVER_2026, ...patch });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.issues.map((i) => i.path)).toContain(path);
  });

  it("turns blank optional text into nothing", () => {
    const r = parseDetails({
      ...SYCLE_VANCOUVER_2026,
      tagline: "  ",
      endsOn: "",
    });
    expect(r.ok && r.details.tagline).toBeUndefined();
    expect(r.ok && r.details.endsOn).toBeUndefined();
  });

  it("keeps data 30 days past the last day", () => {
    expect(retainUntilFor(sycle)).toBe("2026-11-24T00:00:00.000Z");
  });
});

describe("access", () => {
  const invite = (over: Partial<Invite>): Invite => ({
    token: "t",
    conferenceId: "c",
    createdAt: "2026-10-01T00:00:00Z",
    expiresAt: null,
    revokedAt: null,
    maxUses: null,
    uses: 0,
    ...over,
  });
  const now = new Date("2026-10-12T00:00:00Z");

  it("knows why a link is dead", () => {
    expect(inviteState(invite({}), now)).toBe("valid");
    expect(inviteState(invite({ revokedAt: "x" }), now)).toBe("revoked");
    expect(
      inviteState(invite({ expiresAt: "2026-10-11T00:00:00Z" }), now),
    ).toBe("expired");
    expect(inviteState(invite({ maxUses: 2, uses: 2 }), now)).toBe("used-up");
  });

  it("formats codes without the characters people confuse", () => {
    const code = formatCode([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(code).toBe("ABC-DEF-GHJ");
    expect(normaliseCode(" abc def-ghj ")).toBe("ABCDEFGHJ");
  });
});

describe("branding", () => {
  it("never lets anything but a colour reach a style attribute", () => {
    expect(safeAccent("#ABCDEF")).toBe("#abcdef");
    expect(safeAccent("red; x: y")).toBe("#1f6feb");
  });
  it("picks readable ink", () => {
    expect(inkOn("#ffe066")).toBe("#000000");
    expect(inkOn("#0b2545")).toBe("#ffffff");
  });
});

describe("countdown", () => {
  const conf: ConferenceDetails = { ...sycle, endsOn: "2026-10-26" };
  it("counts calendar days where the conference is, not where you are", () => {
    // 09:00 Oct 24 in Sydney is still Oct 23 in Vancouver.
    expect(countdown(conf, new Date("2026-10-23T22:00:00Z"))).toEqual({
      phase: "before",
      days: 1,
    });
    expect(countdown(conf, new Date("2026-10-25T19:00:00Z"))).toEqual({
      phase: "during",
      day: 2,
    });
    expect(countdown(conf, new Date("2026-10-27T19:00:00Z"))).toEqual({
      phase: "after",
    });
  });
  it("writes dates as people say them", () => {
    expect(dateRange(sycle)).toBe("Saturday, October 24, 2026");
    expect(dateRange(conf)).toBe("October 24 – October 26, 2026");
  });
});

describe("modules", () => {
  it("are all owned by a workstream, and only discover is built", () => {
    expect(
      MODULES.filter((m) => m.status === "built").map((m) => m.id),
    ).toEqual(["discover"]);
    expect(MODULES.every((m) => m.workstream.startsWith("passport-"))).toBe(
      true,
    );
  });

  it("show in the organiser's order", () => {
    expect(
      enabledModules({ modules: ["plans", "discover"] }).map((m) => m.id),
    ).toEqual(["plans", "discover"]);
  });

  it("open doors into /go from the conference town, and none from an unknown place", () => {
    const doors = doorsFor(sycle);
    expect(doors).toHaveLength(3);
    expect(
      doors.every(
        (d) =>
          new URL(d.href, "http://x").searchParams.get("at") === "vancouver",
      ),
    ).toBe(true);
    expect(doorsFor({ place: { label: "Atlantis" } })).toEqual([]);
  });
});
