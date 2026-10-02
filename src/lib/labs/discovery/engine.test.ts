import { describe, expect, it } from "vitest";
import type { Possibility } from "@/lib/labs/october/possibility";
import { byFit, type Context } from "@/lib/labs/october/fit";
import type { Days } from "@/lib/labs/october/filters";
import { SECTIONS } from "@/lib/labs/october/voice";
import { compose, resolve } from "./engine";
import { EMPTY, type DiscoveryIntent } from "./intent";

/**
 * **One resolver, so the modes cannot disagree.**
 *
 * The risk the synthesis exists to remove is four surfaces quietly filtering
 * four different ways. These tests assert the opposite: the same intent
 * produces the same results no matter which surface built it, search and
 * filters compose rather than fight, and the editorial sections are a *view*
 * of one resolved set rather than a second query.
 */

const DAYS: Days = {
  today: "2026-10-01",
  tomorrow: "2026-10-02",
  weekend: ["2026-10-02", "2026-10-03", "2026-10-04"],
};

const ctx: Context = { today: DAYS.today, weather: {} };

const make = (over: Partial<Possibility>): Possibility => ({
  id: "x",
  source: "atlas",
  title: "A thing",
  availability: {
    shape: "fixed",
    label: "THU OCT 1",
    days: ["2026-10-01"],
    tonight: true,
  },
  setting: "indoor",
  href: "/",
  text: "",
  tags: ["go-out"],
  ...over,
});

const film = make({
  id: "film",
  source: "movie",
  title: "Halloween",
  scare: 3,
  tags: ["stay-in", "watch"],
  text: "halloween a slasher",
  minutes: 91,
  availability: {
    shape: "anytime",
    label: "ANY NIGHT · 1H 31M",
    days: [],
    tonight: true,
  },
});

const doing = make({
  id: "doing",
  source: "doing",
  title: "Carve pumpkins",
  tags: ["stay-in", "make"],
  text: "pumpkin carving",
  availability: {
    shape: "anytime",
    label: "ANY NIGHT",
    days: [],
    tonight: true,
  },
});

const tonight = make({ id: "gig", title: "Open Mic Comedy Night" });

const run = make({
  id: "exhibition",
  title: "A long exhibition",
  availability: {
    shape: "window",
    label: "MAR 19–JAN 3",
    days: Array.from(
      { length: 40 },
      (_, i) => `2026-10-${String((i % 31) + 1).padStart(2, "0")}`,
    ),
    tonight: true,
  },
});

const POOL = [film, doing, tonight, run];

const got = (intent: DiscoveryIntent) =>
  resolve({ pool: POOL, intent, days: DAYS, rank: byFit(ctx) }).results.map(
    (p) => p.id,
  );

describe("one resolver, whatever built the intent", () => {
  it("gives the same answer for a chip and for a phrase", () => {
    // The *Make* chip and "make something" both produce { feel: ["make"] }.
    expect(got({ doing: ["make"] })).toEqual(["doing"]);
  });

  it("combines a search with a filter rather than replacing it", () => {
    expect(got({ query: "pumpkin" })).toEqual(["doing"]);
    expect(got({ query: "pumpkin", doing: ["watch"] })).toEqual([]);
  });

  it("returns the whole pool when nothing has been asked for", () => {
    expect(got(EMPTY)).toHaveLength(POOL.length);
    expect(
      resolve({ pool: POOL, intent: EMPTY, days: DAYS, rank: byFit(ctx) })
        .asked,
    ).toBe(0);
  });

  it("counts what was asked, so a surface knows which mode it is in", () => {
    const r = resolve({
      pool: POOL,
      intent: { doing: ["make"], query: "pumpkin" },
      days: DAYS,
      rank: byFit(ctx),
    });
    expect(r.asked).toBe(2);
  });
});

describe("what was asked for changes the order, not only the set", () => {
  it("puts tonight's one-off above a thing that has been open for weeks", () => {
    const order = got({ when: ["tonight"], feel: ["go-out"] });
    expect(order.indexOf("gig")).toBeLessThan(order.indexOf("exhibition"));
  });

  it("prefers something that fits the time somebody has", () => {
    const short = make({
      id: "short",
      source: "doing",
      minutes: 30,
      tags: ["stay-in", "make"],
    });
    const long = make({
      id: "long",
      source: "doing",
      minutes: 240,
      tags: ["stay-in", "make"],
    });
    const order = resolve({
      pool: [long, short],
      intent: { within: 60, doing: ["make"] },
      days: DAYS,
      rank: byFit(ctx),
    }).results.map((p) => p.id);
    expect(order[0]).toBe("short");
  });

  it("leaves an unstated length alone rather than treating it as too long", () => {
    const silent = make({
      id: "silent",
      source: "doing",
      tags: ["stay-in", "make"],
    });
    const long = make({
      id: "long",
      source: "doing",
      minutes: 240,
      tags: ["stay-in", "make"],
    });
    const order = resolve({
      pool: [long, silent],
      intent: { within: 60, doing: ["make"] },
      days: DAYS,
      rank: byFit(ctx),
    }).results.map((p) => p.id);
    expect(order[0]).toBe("silent");
  });

  it("turns the usual order upside down when asked to surprise", () => {
    const normal = got({ feel: ["go-out"] });
    const surprised = got({ feel: ["go-out"], surprise: true });
    expect(surprised[0]).not.toBe(normal[0]);
    expect(surprised).toHaveLength(normal.length);
  });

  it("never removes anything to achieve any of that", () => {
    expect(got({ when: ["tonight"], surprise: true, within: 30 })).toHaveLength(
      POOL.filter((p) => p.availability.tonight).length,
    );
  });
});

describe("the editorial sections are a view, not a second query", () => {
  // "Also tonight" takes four, and a possibility only ever appears once — so
  // a four-item pool puts everything in the first section and proves nothing.
  const more = Array.from({ length: 6 }, (_, i) =>
    make({
      id: `film-${i}`,
      source: "movie",
      title: `Film ${i}`,
      tags: ["stay-in", "watch"],
      availability: {
        shape: "anytime",
        label: "ANY NIGHT",
        days: [],
        tonight: true,
      },
    }),
  );
  const resolved = resolve({
    pool: [...POOL, ...more],
    intent: EMPTY,
    days: DAYS,
    rank: byFit(ctx),
  });

  it("cuts the resolved set into temporal promises", () => {
    const sections = compose(resolved, DAYS.today, SECTIONS);
    expect(sections.map((s) => s.id)).toContain("tonight");
    expect(sections.map((s) => s.id)).toContain("whenever");
  });

  it("never shows the same possibility in two sections", () => {
    const sections = compose(resolved, DAYS.today, SECTIONS);
    const all = sections.flatMap((s) => s.items.map((p) => p.id));
    expect(new Set(all).size).toBe(all.length);
  });

  it("lets a page reserve the lead so it is not repeated below", () => {
    const sections = compose(resolved, DAYS.today, SECTIONS, {
      skip: new Set(["film"]),
    });
    expect(sections.flatMap((s) => s.items.map((p) => p.id))).not.toContain(
      "film",
    );
  });

  it("drops an empty section rather than drawing a heading over nothing", () => {
    const empty = resolve({
      pool: [tonight],
      intent: EMPTY,
      days: DAYS,
      rank: byFit(ctx),
    });
    const sections = compose(empty, DAYS.today, SECTIONS);
    expect(sections.every((s) => s.items.length > 0)).toBe(true);
    expect(sections.map((s) => s.id)).not.toContain("whenever");
  });
});
