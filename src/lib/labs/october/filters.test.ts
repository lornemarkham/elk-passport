import { describe, expect, it } from "vitest";
import type { Possibility } from "./possibility";
import {
  applyFilters,
  availableOn,
  describe as describeFilters,
  FILTERS,
  type Days,
} from "./filters";

/**
 * **The combination rule is the product.**
 *
 * One filter is a list. Two filters that combine correctly are a tool, and
 * getting the combination wrong is invisible until somebody asks the obvious
 * question — *a scary movie* — and gets back a craft project. These tests pin
 * the two halves of that rule and the two honest "cannot say" states, because
 * all four were wrong at some point while this was being built.
 */

const DAYS: Days = {
  today: "2026-10-01",
  tomorrow: "2026-10-02",
  weekend: ["2026-10-02", "2026-10-03", "2026-10-04"],
};

const make = (over: Partial<Possibility>): Possibility => ({
  id: over.id ?? "x",
  source: over.source ?? "atlas",
  title: over.title ?? "A thing",
  availability: over.availability ?? {
    shape: "fixed",
    label: "THU OCT 1",
    days: ["2026-10-01"],
    tonight: true,
  },
  setting: over.setting ?? "unknown",
  href: "/",
  text: over.text ?? "",
  tags: over.tags ?? [],
  ...over,
});

const film = make({
  id: "film",
  source: "movie",
  title: "Halloween",
  availability: {
    shape: "anytime",
    label: "ANY NIGHT · 1H 31M",
    days: [],
    tonight: true,
  },
  setting: "indoor",
  scare: 3,
  tags: ["stay-in", "watch"],
  text: "halloween a slasher",
});

const kidFilm = make({
  id: "kid-film",
  source: "movie",
  title: "Hocus Pocus",
  availability: {
    shape: "anytime",
    label: "ANY NIGHT",
    days: [],
    tonight: true,
  },
  setting: "indoor",
  scare: 0,
  withKids: true,
  tags: ["stay-in", "watch"],
});

const ghostDoing = make({
  id: "ghosts",
  source: "doing",
  title: "Hang paper ghosts",
  availability: {
    shape: "anytime",
    label: "ANY NIGHT",
    days: [],
    tonight: true,
  },
  setting: "indoor",
  tags: ["stay-in", "make"],
  text: "paper ghosts in a window",
});

const saturdayGig = make({
  id: "gig",
  source: "atlas",
  title: "Honeybear, the Band",
  availability: {
    shape: "fixed",
    label: "SAT OCT 3",
    days: ["2026-10-03"],
    tonight: false,
  },
  setting: "indoor",
  tags: ["go-out", "event"],
});

const haunt = make({
  id: "haunt",
  source: "atlas",
  title: "Black Mountain Haunted House",
  availability: {
    shape: "unstated",
    label: "DATES NOT STATED",
    days: [],
    tonight: false,
  },
  setting: "outdoor-night",
  tags: ["go-out"],
  text: "a haunted house",
});

const unclassified = make({
  id: "unknown",
  source: "atlas",
  title: "Open Mic Comedy Night",
  setting: "unknown",
  tags: ["go-out"],
});

const POOL = [film, kidFilm, ghostDoing, saturdayGig, haunt, unclassified];

const ids = (...on: string[]) =>
  applyFilters(POOL, new Set(on), DAYS).results.map((p) => p.id);

describe("or inside a group, and across groups", () => {
  it("ors two days together", () => {
    expect(ids("tomorrow", "weekend")).toContain("gig");
  });

  it("ands a medium with a mood — a scary movie is a movie", () => {
    // This is the query that forced Family and Scary out of "Feel like".
    // Or-ing them returned every film plus a Doing about paper ghosts.
    expect(ids("watch", "scary")).toEqual(["film"]);
  });

  it("ands a day with a mood", () => {
    expect(ids("weekend", "family")).toEqual(["kid-film"]);
  });

  it("returns everything when nothing is chosen", () => {
    expect(ids()).toHaveLength(POOL.length);
  });

  it("ors within the Looking for group, which is the same group", () => {
    // Family and Scary sit together, so this is a union and not a paradox.
    expect(ids("family", "scary").sort()).toEqual([
      "film",
      "ghosts",
      "haunt",
      "kid-film",
    ]);
  });

  it("returns nothing, rather than something wrong, for an impossible pair", () => {
    // A film is indoors by construction, so Watch and Outdoors cannot both
    // hold. An empty result is the correct answer and the page says so.
    expect(ids("watch", "outdoor")).toEqual([]);
  });
});

describe("always-available things answer every day honestly", () => {
  it("counts a film as available tonight and on Saturday", () => {
    expect(availableOn(film, DAYS.today)).toBe(true);
    expect(availableOn(film, "2026-10-03")).toBe(true);
  });

  it("counts a costume as available until Halloween", () => {
    const costume = make({
      availability: {
        shape: "deadline",
        label: "BEFORE HALLOWEEN",
        days: [],
        tonight: true,
        needsPlanning: true,
      },
    });
    expect(availableOn(costume, "2026-10-20")).toBe(true);
  });

  it("never says yes for something nobody dated", () => {
    expect(availableOn(haunt, DAYS.today)).toBe(false);
    expect(ids("tonight")).not.toContain("haunt");
  });
});

describe("what could not answer the question is offered, not hidden", () => {
  it("sets undated things aside when a day is asked for", () => {
    const { unanswered } = applyFilters(POOL, new Set(["tonight"]), DAYS);
    expect(unanswered.when.map((p) => p.id)).toEqual(["haunt"]);
  });

  it("still applies the other filters to what it sets aside", () => {
    // Asking for Tonight + Make must not offer a haunt as a near-miss.
    const { unanswered } = applyFilters(
      POOL,
      new Set(["tonight", "make"]),
      DAYS,
    );
    expect(unanswered.when).toHaveLength(0);
  });

  it("sets unclassified things aside when indoors or outdoors is asked for", () => {
    const { results, unanswered } = applyFilters(
      POOL,
      new Set(["indoor"]),
      DAYS,
    );
    expect(results.map((p) => p.id)).not.toContain("unknown");
    expect(unanswered.where.map((p) => p.id)).toEqual(["unknown"]);
  });

  it("leaves both buckets empty when neither question was asked", () => {
    const { unanswered } = applyFilters(POOL, new Set(["watch"]), DAYS);
    expect(unanswered.when).toHaveLength(0);
    expect(unanswered.where).toHaveLength(0);
  });
});

describe("a picked date behaves exactly like Tonight", () => {
  it("narrows to that day", () => {
    const withDay = { ...DAYS, picked: "2026-10-03" };
    const { results } = applyFilters(POOL, new Set(), withDay);
    expect(results.map((p) => p.id)).toContain("gig");
    expect(results.map((p) => p.id)).not.toContain("unknown");
  });
});

describe("the filters themselves", () => {
  it("stays a small set — eleven or fewer", () => {
    expect(FILTERS.length).toBeLessThanOrEqual(13);
  });

  it("records why each one is answerable from the evidence", () => {
    for (const f of FILTERS) {
      expect(f.basis.length, f.id).toBeGreaterThan(20);
    }
  });

  it("says plainly what is active", () => {
    expect(describeFilters(new Set(["tonight", "make"]), DAYS, "")).toBe(
      "tonight · make",
    );
    expect(describeFilters(new Set(), DAYS, "pumpkin")).toContain("pumpkin");
    expect(describeFilters(new Set(), DAYS, "")).toBeUndefined();
  });
});
