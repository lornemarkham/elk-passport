import { describe, expect, it } from "vitest";
import {
  parseAdventurePatch,
  parseHockeyFacts,
  parseInviteRequest,
  parseItem,
  parseItemPatch,
  parseNewAdventure,
  parseResponse,
  TOKEN_PATTERN,
} from "./rules";

describe("starting an adventure", () => {
  it("needs a declared kind and a name; dates and place are optional", () => {
    const parsed = parseNewAdventure({
      kind: "hockey-night",
      title: "  Night A  ",
    });
    expect(parsed).toEqual({
      ok: true,
      value: {
        kind: "hockey-night",
        title: "Night A",
        startsOn: null,
        endsOn: null,
        timeZone: null,
        destinationLabel: null,
        destinationTownId: null,
      },
    });
  });

  it("refuses a kind this deployment does not declare", () => {
    expect(parseNewAdventure({ kind: "heist", title: "x" }).ok).toBe(false);
    expect(parseNewAdventure({ title: "x" }).ok).toBe(false);
  });

  it("refuses an empty or overlong name", () => {
    expect(parseNewAdventure({ kind: "day", title: "   " }).ok).toBe(false);
    expect(parseNewAdventure({ kind: "day", title: "x".repeat(121) }).ok).toBe(
      false,
    );
  });

  it("checks days are real and in order", () => {
    expect(
      parseNewAdventure({ kind: "day", title: "x", startsOn: "2026-02-30" }).ok,
    ).toBe(false);
    expect(
      parseNewAdventure({ kind: "day", title: "x", endsOn: "2026-10-01" }).ok,
    ).toBe(false);
    expect(
      parseNewAdventure({
        kind: "day",
        title: "x",
        startsOn: "2026-10-02",
        endsOn: "2026-10-01",
      }).ok,
    ).toBe(false);
    expect(
      parseNewAdventure({
        kind: "weekend",
        title: "x",
        startsOn: "2026-10-24",
        endsOn: "2026-10-25",
      }).ok,
    ).toBe(true);
  });

  it("only accepts town ids shaped like Discovery's", () => {
    expect(
      parseNewAdventure({
        kind: "day",
        title: "x",
        destinationTownId: "Van Couver",
      }).ok,
    ).toBe(false);
    expect(
      parseNewAdventure({
        kind: "day",
        title: "x",
        destinationTownId: "vancouver",
      }).ok,
    ).toBe(true);
  });
});

describe("changing an adventure", () => {
  it("changes only what was sent, and never the kind", () => {
    expect(parseAdventurePatch({ title: "New", kind: "day" })).toEqual({
      ok: true,
      value: { title: "New" },
    });
    expect(parseAdventurePatch({ startsOn: null })).toEqual({
      ok: true,
      value: { startsOn: null },
    });
    expect(parseAdventurePatch({ kind: "day" }).ok).toBe(false);
  });
});

describe("invite links", () => {
  it("are single-use unless the owner asks otherwise", () => {
    expect(parseInviteRequest({})).toEqual({
      ok: true,
      value: { label: null, maxUses: 1, expiresInDays: null },
    });
    expect(
      parseInviteRequest({ maxUses: null }).ok &&
        parseInviteRequest({ maxUses: null }),
    ).toMatchObject({
      value: { maxUses: null },
    });
    expect(
      parseInviteRequest({ maxUses: 5, expiresInDays: 2, label: "crew" }),
    ).toEqual({
      ok: true,
      value: { label: "crew", maxUses: 5, expiresInDays: 2 },
    });
  });

  it("refuse silly limits", () => {
    expect(parseInviteRequest({ maxUses: 0 }).ok).toBe(false);
    expect(parseInviteRequest({ maxUses: 101 }).ok).toBe(false);
    expect(parseInviteRequest({ maxUses: 1.5 }).ok).toBe(false);
    expect(parseInviteRequest({ expiresInDays: 0 }).ok).toBe(false);
    expect(parseInviteRequest({ expiresInDays: 400 }).ok).toBe(false);
  });

  it("tokens look like 32 random bytes in base64url", () => {
    expect(TOKEN_PATTERN.test("a".repeat(43))).toBe(true);
    expect(TOKEN_PATTERN.test("short")).toBe(false);
    expect(TOKEN_PATTERN.test(`${"a".repeat(42)}/`)).toBe(false);
  });
});

describe("plan items", () => {
  it("need a place, a name or a note", () => {
    expect(parseItem({}).ok).toBe(false);
    expect(parseItem({ note: "Doors at 5" }).ok).toBe(true);
    expect(parseItem({ atlasRef: "ent_123" }).ok).toBe(true);
  });

  it("only take Atlas ids shaped like Atlas ids", () => {
    expect(parseItem({ atlasRef: "../../etc" }).ok).toBe(false);
    expect(parseItem({ atlasRef: "<script>" }).ok).toBe(false);
  });

  it("are proposed unless asked to be confirmed (Postgres decides who may)", () => {
    expect(parseItem({ label: "x" })).toMatchObject({
      value: { status: "proposed" },
    });
    expect(parseItem({ label: "x", status: "confirmed" })).toMatchObject({
      value: { status: "confirmed" },
    });
    expect(parseItem({ label: "x", status: "booked" }).ok).toBe(false);
  });

  it("patches carry only what changes", () => {
    expect(parseItemPatch({ status: "confirmed" })).toEqual({
      ok: true,
      value: { status: "confirmed" },
    });
    expect(parseItemPatch({}).ok).toBe(false);
    expect(parseItemPatch({ onDay: "nope" }).ok).toBe(false);
  });
});

describe("answers", () => {
  it("are in, maybe, out, or taken back", () => {
    expect(parseResponse({ response: "in" })).toEqual({
      ok: true,
      value: "in",
    });
    expect(parseResponse({ response: null })).toEqual({
      ok: true,
      value: null,
    });
    expect(parseResponse({ response: "definitely" }).ok).toBe(false);
  });
});

describe("hockey facts", () => {
  it("are all optional, and the arena may be an Atlas id or the group's words", () => {
    expect(parseHockeyFacts({ arenaLabel: "Rogers Arena" })).toEqual({
      ok: true,
      value: {
        puckDrop: null,
        homeTeam: null,
        awayTeam: null,
        arenaAtlasRef: null,
        arenaLabel: "Rogers Arena",
      },
    });
    expect(parseHockeyFacts({ puckDrop: "not a time" }).ok).toBe(false);
    expect(parseHockeyFacts({ arenaAtlasRef: "has space" }).ok).toBe(false);
  });
});
