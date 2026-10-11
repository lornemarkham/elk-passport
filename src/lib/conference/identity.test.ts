import { describe, expect, it } from "vitest";
import { conferenceSetup } from "./config";
import { identityFrom, issueGuest, verifyGuest } from "./identity";
import { failureBrake } from "./rate";

const SECRET = "s".repeat(32);

describe("guest identity", () => {
  it("round-trips a signed cookie and rejects a forged one", () => {
    const { identity, value } = issueGuest(SECRET);
    expect(verifyGuest(SECRET, value)).toBe(identity);
    expect(verifyGuest(SECRET, value.replace(/.$/, "x"))).toBeNull();
    expect(verifyGuest("t".repeat(32), value)).toBeNull();
    expect(verifyGuest(SECRET, "no-dot")).toBeNull();
  });

  it("prefers a Passport account to a guest cookie", () => {
    const { value } = issueGuest(SECRET);
    expect(identityFrom("abc", value, SECRET)).toBe("user:abc");
    expect(identityFrom(null, value, SECRET)).toMatch(/^guest:/);
    expect(identityFrom(null, undefined, SECRET)).toBeNull();
  });
});

describe("configuration", () => {
  it("opens in development with nothing set, guests may organise", () => {
    const s = conferenceSetup({}, true);
    expect(s.open && s.config.allowGuestOrganisers).toBe(true);
  });

  it("stays closed in production until the secret and store are stated", () => {
    expect(conferenceSetup({}, false)).toEqual({
      open: false,
      missing: ["CONFERENCE_SECRET", "CONFERENCE_STORE"],
    });
    const s = conferenceSetup(
      { CONFERENCE_SECRET: SECRET, CONFERENCE_STORE: "memory" },
      false,
    );
    expect(s.open && s.config.allowGuestOrganisers).toBe(false);
  });
});

describe("code brake", () => {
  it("slows an address after ten wrong codes, and only wrong ones count", () => {
    const brake = failureBrake();
    for (let i = 0; i < 9; i++) brake.fail("a", 0);
    expect(brake.blocked("a", 0)).toBe(false);
    brake.fail("a", 0);
    expect(brake.blocked("a", 0)).toBe(true);
    expect(brake.blocked("b", 0)).toBe(false);
    expect(brake.blocked("a", 16 * 60_000)).toBe(false);
  });
});
