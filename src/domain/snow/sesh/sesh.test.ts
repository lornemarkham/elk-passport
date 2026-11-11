import { describe, expect, it } from "vitest";
import { apply, check, parseAction, type Action } from "./actions";
import { REAL_FEATURES } from "./catalogue";
import { DEMO_FEATURES, DEMO_YOU, crowdVotes, demoWorld } from "./demo";
import { chairliftFeed } from "./feed";
import type { Clip, Rider, Viewer, World } from "./model";
import { EMPTY_WORLD } from "./model";
import { earnedPatches } from "./patches";
import {
  VOTING_MS,
  canChallenge,
  canChirp,
  canVote,
  challengeState,
  champion,
  history,
  leaderboard,
  visibleTo,
} from "./rules";
import { checkCaption, checkChirp, checkName } from "./safety";
import { hillDay, hillSeason, hillWeek } from "./time";

const T0 = Date.parse("2026-11-10T20:00:00Z"); // noon on the hill
const feature = { ...DEMO_FEATURES[1] }; // a rail
const rider = (id: string, extra: Partial<Rider> = {}): Rider => ({
  id,
  name: id,
  homeMountain: "silverstar",
  sport: "snowboard",
  division: "intermediate",
  ageGroup: "adult",
  since: new Date(T0 - 1e9).toISOString(),
  ...extra,
});
const clip = (
  id: string,
  riderId: string,
  at = T0 - 3_600_000,
  extra: Partial<Clip> = {},
): Clip => ({
  id,
  featureId: feature.id,
  riderId,
  sport: "snowboard",
  division: "intermediate",
  category: "best-style",
  caption: "",
  at: new Date(at).toISOString(),
  media: { kind: "illustration", seed: 1 },
  status: "published",
  ...extra,
});
const as = (riderId: string, extra: Partial<Viewer> = {}): Viewer => ({
  riderId,
  signedIn: true,
  ageGroup: "adult",
  ...extra,
});

function base(): World {
  return {
    ...EMPTY_WORLD,
    features: [feature],
    riders: [
      rider("a"),
      rider("b"),
      rider("c"),
      rider("d"),
      rider("kid", { ageGroup: "youth" }),
    ],
    clips: [clip("ca", "a"), clip("ckid", "kid")],
  };
}

let seq = 0;
const newId = () => `id${++seq}`;

function play(w: World, v: Viewer, a: Action, now = T0) {
  const r = apply(w, v, a, now, newId);
  if (!r.ok) throw new Error(r.reason);
  return r;
}

const answer = (to: string): Action => ({
  type: "post",
  featureId: feature.id,
  sport: "snowboard",
  division: "intermediate",
  category: "best-style",
  caption: "Your move",
  media: { kind: "illustration", seed: 2 },
  rights: true,
  openTerrain: true,
  answerTo: to,
});

describe("challenges and voting", () => {
  it("an answer on the same feature makes a challenge open for 24 hours", () => {
    const r = play(base(), as("b"), answer("ca"));
    const ch = r.world.challenges[0];
    expect(ch.id).toBe(r.created);
    expect(Date.parse(ch.closesAt) - Date.parse(ch.at)).toBe(VOTING_MS);
    expect(challengeState(r.world, ch, T0).open).toBe(true);
  });

  it("one vote per person, final, and not in your own challenge", () => {
    let w = play(base(), as("b"), answer("ca")).world;
    const ch = w.challenges[0].id;
    expect(
      check(w, as("a"), { type: "vote", challengeId: ch, side: "defender" }, T0)
        .ok,
    ).toBe(false);
    expect(
      check(
        w,
        as("b"),
        { type: "vote", challengeId: ch, side: "challenger" },
        T0,
      ).ok,
    ).toBe(false);
    w = play(w, as("c"), {
      type: "vote",
      challengeId: ch,
      side: "challenger",
    }).world;
    expect(canVote(w, as("c"), w.challenges[0], T0)).toEqual({
      ok: false,
      reason: "You've voted. It's locked in.",
    });
    expect(canVote(w, { signedIn: false }, w.challenges[0], T0).ok).toBe(false);
    expect(canVote(w, as("d"), w.challenges[0], T0 + VOTING_MS + 1).ok).toBe(
      false,
    );
  });

  it("more votes win; a tie goes to the defender; no votes is no contest", () => {
    let w = play(base(), as("b"), answer("ca")).world;
    const ch = w.challenges[0];
    const after = T0 + VOTING_MS + 1;
    expect(challengeState(w, ch, after).noContest).toBe(true);
    expect(champion(w, after, feature.id, "day")).toBeUndefined();
    w = play(w, as("c"), {
      type: "vote",
      challengeId: ch.id,
      side: "challenger",
    }).world;
    w = play(w, as("d"), {
      type: "vote",
      challengeId: ch.id,
      side: "defender",
    }).world;
    expect(challengeState(w, ch, after).winnerRiderId).toBe("a");
    w = { ...w, riders: [...w.riders, rider("e")] };
    w = play(w, as("e"), {
      type: "vote",
      challengeId: ch.id,
      side: "challenger",
    }).world;
    const s = challengeState(w, ch, after);
    expect(s.winner).toBe("challenger");
    expect(s.tally).toEqual({ defender: 1, challenger: 2 });
    expect(champion(w, after, feature.id, "day")?.riderId).toBe("b");
    expect(champion(w, after, feature.id, "all")?.riderId).toBe("b");
  });

  it("riders of different age groups don't challenge each other", () => {
    const w = base();
    const kidClip = w.clips.find((c) => c.id === "ckid")!;
    expect(canChallenge(w, as("a"), kidClip, T0).ok).toBe(false);
    expect(
      canChallenge(w, as("kid", { ageGroup: "youth" }), w.clips[0], T0).ok,
    ).toBe(false);
  });

  it("a block stops challenges and chirps both ways", () => {
    const w = play(base(), as("a"), { type: "block", riderId: "b" }).world;
    expect(check(w, as("b"), answer("ca"), T0).ok).toBe(false);
    expect(canChirp(w, as("b"), "clip", "ca").ok).toBe(false);
    expect(visibleTo(w, as("a")).riders.some((r) => r.id === "b")).toBe(false);
  });

  it("an answer must be in the defender's division and on an open feature", () => {
    const w = base();
    expect(
      check(w, as("b"), { ...answer("ca"), division: "advanced" } as Action, T0)
        .ok,
    ).toBe(false);
    const closed = {
      ...w,
      features: [{ ...feature, status: "closed" as const }],
    };
    expect(check(closed, as("b"), answer("ca"), T0).ok).toBe(false);
    const later = { ...w, features: [{ ...feature, opens: "2026-11-26" }] };
    expect(check(later, as("b"), answer("ca"), T0)).toMatchObject({
      ok: false,
    });
  });

  it("posting needs rights and open-terrain confirmation", () => {
    const w = base();
    expect(
      check(w, as("b"), { ...answer("ca"), rights: false } as Action, T0).ok,
    ).toBe(false);
    expect(
      check(w, as("b"), { ...answer("ca"), openTerrain: false } as Action, T0)
        .ok,
    ).toBe(false);
  });
});

describe("younger riders", () => {
  it("a visitor who isn't signed in never sees a youth rider or their clips", () => {
    const v = visibleTo(base(), { signedIn: false });
    expect(v.riders.some((r) => r.ageGroup === "youth")).toBe(false);
    expect(v.clips.some((c) => c.riderId === "kid")).toBe(false);
  });
  it("adults react on a younger rider's clip but don't post words", () => {
    const w = base();
    expect(canChirp(w, as("a"), "clip", "ckid").ok).toBe(false);
    expect(
      check(w, as("a"), { type: "react", clipId: "ckid", kind: "sick" }, T0).ok,
    ).toBe(true);
    expect(
      canChirp(w, as("kid", { ageGroup: "youth" }), "clip", "ckid").ok,
    ).toBe(true);
  });
});

describe("moderation", () => {
  it("three distinct reports hide a clip", () => {
    let w = base();
    const reports: Record<string, string[]> = {};
    const r = (who: string) => {
      const out = apply(
        w,
        as(who),
        {
          type: "report",
          target: { kind: "clip", id: "ca" },
          reason: "Spam or fake",
        },
        T0,
        newId,
        reports,
      );
      if (!out.ok) throw new Error(out.reason);
      w = out.world;
    };
    r("b");
    r("b");
    r("c");
    expect(w.clips.find((c) => c.id === "ca")?.status).toBe("published");
    r("d");
    expect(w.clips.find((c) => c.id === "ca")?.status).toBe("hidden");
    expect(visibleTo(w, as("b")).clips.some((c) => c.id === "ca")).toBe(false);
    expect(
      visibleTo(w, as("b", { moderator: true })).clips.some(
        (c) => c.id === "ca",
      ),
    ).toBe(true);
  });
});

describe("words", () => {
  it("refuses escalation, injury, insults and contact details; allows park talk", () => {
    expect(checkCaption("Frontside 180 on the small jump").ok).toBe(true);
    expect(checkCaption("Highest Level park lap").ok).toBe(true);
    expect(checkCaption("bigger than yours").ok).toBe(false);
    expect(checkCaption("ducked the rope for this").ok).toBe(false);
    expect(checkChirp("broke my wrist lol").ok).toBe(false);
    expect(checkChirp("you're such a loser").ok).toBe(false);
    expect(checkChirp("text me 250-555-1234").ok).toBe(false);
    expect(checkChirp("follow @shredder99").ok).toBe(false);
    expect(checkChirp("Clean! 🧼").ok).toBe(true);
    expect(checkName("Juniper").ok).toBe(true);
    expect(checkName("x").ok).toBe(false);
  });
  it("parseAction refuses junk", () => {
    expect(parseAction(null)).toBeNull();
    expect(
      parseAction({ type: "vote", challengeId: "x", side: "both" }),
    ).toBeNull();
    expect(
      parseAction({ type: "post", featureId: "f", sport: "sled" }),
    ).toBeNull();
    expect(parseAction({ type: "react", clipId: "c", kind: "sick" })).toEqual({
      type: "react",
      clipId: "c",
      kind: "sick",
    });
  });
});

describe("time", () => {
  it("counts days, weeks and seasons on the hill", () => {
    expect(hillDay("2026-11-11T06:30:00Z")).toBe("2026-11-10"); // late evening in Vancouver
    expect(hillWeek("2026-11-10T20:00:00Z")).toBe("W2026-11-09");
    expect(hillSeason("2027-02-01T20:00:00Z")).toBe("2026/27");
    expect(hillSeason("2026-07-31T20:00:00Z")).toBe("2025/26");
  });
});

describe("the real catalogue", () => {
  it("every real feature is approved, sourced from the resort, and not a demo", () => {
    expect(REAL_FEATURES.length).toBeGreaterThan(0);
    for (const f of REAL_FEATURES) {
      expect(f.demo).toBeFalsy();
      expect(f.source?.url).toMatch(
        /^https:\/\/www\.(bigwhite|whistlerblackcomb)\.com\//,
      );
      expect(f.source?.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(REAL_FEATURES.some((f) => f.mountainId === "silverstar")).toBe(
      false,
    );
  });
  it("demo features are all fictional and none shares a real id or name", () => {
    for (const f of DEMO_FEATURES) {
      expect(f.demo).toBe(true);
      expect(
        REAL_FEATURES.some((r) => r.id === f.id || r.name === f.name),
      ).toBe(false);
    }
  });
});

describe("demo world", () => {
  const t0 = T0;
  const w = demoWorld(t0);

  it("has 30 fictional riders plus you, all marked demo, and is deterministic", () => {
    expect(w.riders.filter((r) => r.id !== DEMO_YOU)).toHaveLength(30);
    expect(w.riders.every((r) => r.demo)).toBe(true);
    expect(
      new Set(w.riders.map((r) => r.crew).filter(Boolean)).size,
    ).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(demoWorld(t0))).toBe(JSON.stringify(w));
    expect(w.clips.every((c) => c.media.kind === "illustration")).toBe(true);
  });

  it("obeys its own rules: no self-votes, no duplicate votes, same-age challenges", () => {
    const seen = new Set<string>();
    for (const v of w.votes) {
      const k = `${v.challengeId}|${v.voterId}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
      expect(Date.parse(v.at)).toBeLessThan(t0);
    }
    for (const ch of w.challenges) {
      const a = w.clips.find((c) => c.id === ch.defenderClipId)!;
      const b = w.clips.find((c) => c.id === ch.challengerClipId)!;
      const ra = w.riders.find((r) => r.id === a.riderId)!;
      const rb = w.riders.find((r) => r.id === b.riderId)!;
      expect(ra.ageGroup).toBe(rb.ageGroup);
      expect(
        w.votes.some(
          (v) =>
            v.challengeId === ch.id &&
            (v.voterId === ra.id || v.voterId === rb.id),
        ),
      ).toBe(false);
    }
  });

  it("has champions today, open challenges, history and a feed", () => {
    expect(champion(w, t0, "d-ss-comet", "day")).toBeDefined();
    expect(w.challenges.some((c) => Date.parse(c.closesAt) > t0)).toBe(true);
    expect(history(w, t0, "d-ss-comet").length).toBeGreaterThan(0);
    const feed = chairliftFeed(w, as(DEMO_YOU), "silverstar", t0);
    expect(feed.trending.length).toBeGreaterThan(0);
    expect(feed.newChallenges.length).toBeGreaterThan(0);
    expect(feed.elsewhere.length).toBeGreaterThan(0);
  });

  it("you answer Juniper's rail clip, the crowd votes, you're crowned and earn patches", () => {
    const you = as(DEMO_YOU);
    let world = w;
    expect(earnedPatches(world, t0, DEMO_YOU)).toEqual([]);
    const r = play(
      world,
      you,
      { ...answer("dc-bait"), featureId: "d-ss-starlight" },
      t0,
    );
    world = r.world;
    const later = t0 + VOTING_MS + 60_000;
    world = {
      ...world,
      votes: [...world.votes, ...crowdVotes(world, t0, later)],
    };
    const ch = world.challenges.find((c) => c.id === r.created)!;
    const s = challengeState(world, ch, later);
    expect(s.winnerRiderId).toBe(DEMO_YOU);
    expect(
      leaderboard(world, later, { featureId: "d-ss-starlight" }, "day")[0]
        ?.riderId,
    ).toBe(DEMO_YOU);
    const ids = earnedPatches(world, later, DEMO_YOU).map((e) => e.patch.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "first-flight",
        "gauntlet",
        "rail-ace",
        "style-commander",
      ]),
    );
  });
});
