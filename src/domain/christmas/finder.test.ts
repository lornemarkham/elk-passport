import { describe, expect, it } from "vitest";
import type { Experience } from "@/domain/experience/types";
import { townById } from "@/domain/discovery/towns";
import { discoverHref, findsIn, readAsk, type Ask } from "./discover";
import {
  availability,
  comingUp,
  finderData,
  hostFor,
  inThemes,
  newYearInView,
  nextDay,
  shownIn,
  standout,
  viewOf,
} from "./finder";

/**
 * **One Beautiful Experience** (owner brief M1128): several categories at
 * once, availability known before a category is offered, and a host's
 * answer — never a dead end — when nothing matches. Each block is one of the
 * owner's observations from the customer review.
 */

const TODAY = "2026-11-25"; // a Wednesday
const NOW = new Date("2026-11-25T20:00:00Z");

function exp(over: Partial<Experience>): Experience {
  return {
    id: over.id ?? over.title ?? "x",
    kind: "Place",
    slug: "x",
    title: "Somewhere",
    shortDescription: "",
    detailReady: false,
    moods: [],
    activities: [],
    seasons: [],
    timeOfDay: [],
    weather: [],
    companions: [],
    energyLevel: 1,
    priceLevel: 0,
    duration: { minMinutes: 0, maxMinutes: 0 },
    regionIds: [],
    familyFriendly: false,
    petFriendly: false,
    requiresReservation: false,
    isActive: true,
    ...over,
  };
}

/** Placed by Atlas at a point `kmEast` of a town centre. */
function at(town: string, kmEast: number, over: Partial<Experience>) {
  const t = townById(town)!;
  const dLng = kmEast / (111.32 * Math.cos((t.latitude * Math.PI) / 180));
  return exp({
    geography: {
      state: "observed",
      coordinates: [t.longitude + dLng, t.latitude],
      coordinatesBasis: "observed",
      area: { id: t.area.toLowerCase(), name: t.area },
    },
    ...over,
  });
}

const on = (start: string, end: string): Partial<Experience> => ({
  kind: "Event",
  startTime: start,
  endTime: end,
  timePrecision: "minute",
  occurrence: { reading: "occurrence", actionable: true },
});

const picture = {
  heroMedia: { type: "image" as const, src: "/x.jpg", alt: "" },
};

const corpus = [
  at("vernon", 1, {
    id: "market",
    title: "Downtown Christmas Market",
    ...on("2026-11-29T18:00:00Z", "2026-11-30T01:00:00Z"),
  }),
  at("vernon", 2, {
    id: "market-dec",
    title: "Holiday Artisan Christmas Market",
    ...on("2026-12-06T18:00:00Z", "2026-12-07T01:00:00Z"),
  }),
  at("vernon", 1, {
    id: "festival",
    title: "Frostival Winter Festival",
    ...on("2026-11-26T23:00:00Z", "2026-11-27T05:00:00Z"),
    ...picture,
  }),
  at("vernon", 3, {
    id: "cookies",
    title: "Christmas Cookie Decorating Workshop",
    ...on("2026-11-26T01:00:00Z", "2026-11-26T03:00:00Z"),
  }),
  at("vernon", 4, {
    id: "nye",
    title: "New Years Eve Countdown",
    ...on("2027-01-01T03:00:00Z", "2027-01-01T08:00:00Z"),
  }),
  at("vernon", 45, {
    id: "far-market",
    title: "Kelowna Christmas Market",
    ...on("2026-11-26T18:00:00Z", "2026-11-27T01:00:00Z"),
  }),
];

const finds = findsIn(corpus, TODAY);
const ask = (q: Record<string, string>): Ask =>
  readAsk({ at: "vernon", ...q }, { today: TODAY });

describe("categories are several at once, OR between them", () => {
  it("shows markets and festivals together, and neither alone hides the other", () => {
    const data = finderData(finds, ask({}), { today: TODAY, now: NOW });
    const both = viewOf(data, ["markets", "festivals"], {}, TODAY);
    const titles = [both.spotlight, ...both.weekend, ...both.around]
      .filter(Boolean)
      .map((f) => f!.experience.id);
    expect(titles).toEqual(
      expect.arrayContaining(["market", "market-dec", "festival"]),
    );
    expect(titles).not.toContain("cookies");
  });

  it("reads several categories from an old link's comma list", () => {
    expect(ask({ theme: "markets,lights,food" }).themes).toEqual([
      "markets",
      "lights",
      "food",
    ]);
  });
});

describe("availability is known before a category is offered", () => {
  it("does not offer markets for tomorrow when none are confirmed, and says the next day", () => {
    const data = finderData(finds, ask({ when: "tomorrow" }), {
      today: TODAY,
      now: NOW,
    });
    const { open, closed } = availability(data);
    expect(open.map((a) => a.id)).toContain("festivals");
    const markets = closed.find((a) => a.id === "markets")!;
    expect(markets.count).toBe(0);
    expect(markets.next).toBe("2026-11-29");
  });

  it("counts by place, days and distance — the 45 km market is not near at 30 km", () => {
    const data = finderData(finds, ask({}), { today: TODAY, now: NOW });
    expect(data.counts.markets).toBe(2);
  });
});

describe("a dead end becomes a host's suggestions", () => {
  const tomorrow = ask({ when: "tomorrow", theme: "markets" });
  const data = finderData(finds, tomorrow, { today: TODAY, now: NOW });
  const view = viewOf(data, tomorrow.themes, tomorrow, TODAY);
  const host = hostFor(data, tomorrow.themes, tomorrow, TODAY);

  it("says nothing matched, without changing the date or the distance", () => {
    expect(view.empty).toBe(true);
    expect(tomorrow.from).toBe("2026-11-26");
    expect(tomorrow.km).toBe(30);
  });
  it("offers the next confirmed market days", () => {
    expect(
      host.next.map((n) => [n.day, n.finds.map((f) => f.experience.id)]),
    ).toEqual([
      ["2026-11-29", ["market"]],
      ["2026-12-06", ["market-dec"]],
    ]);
  });
  it("offers what else is on that day, nearby", () => {
    expect(host.sameDay.map((f) => f.experience.id)).toContain("festival");
  });
  it("offers the same thing a little further, said as further", () => {
    expect(host.further.map((f) => f.experience.id)).toEqual(["far-market"]);
    expect(host.further[0]!.km).toBeGreaterThan(30);
  });
});

describe("New Year's Eve when it belongs, not on every screen", () => {
  it("keeps a New Year's listing out of everything in November", () => {
    const data = finderData(finds, ask({}), { today: TODAY, now: NOW });
    expect(data.newYear).toBe(false);
    const all = viewOf(data, [], {}, TODAY);
    expect(
      [...all.weekend, ...all.around].map((f) => f.experience.id),
    ).not.toContain("nye");
    expect(availability(data).open.map((a) => a.id)).not.toContain("newyear");
  });
  it("brings it in when the days asked are New Year's Eve, or after Boxing Day, or by name", () => {
    expect(
      newYearInView(
        { from: "2026-12-31", to: "2026-12-31", themes: [] },
        TODAY,
      ),
    ).toBe(true);
    expect(newYearInView({ themes: [] }, "2026-12-27")).toBe(true);
    expect(newYearInView({ themes: ["newyear"] }, TODAY)).toBe(true);
    expect(
      newYearInView(
        { from: "2026-11-26", to: "2026-11-26", themes: [] },
        TODAY,
      ),
    ).toBe(false);
  });
  it("never hides it from somebody who chose it", () => {
    const nye = finds.find((f) => f.experience.id === "nye")!;
    expect(inThemes(nye, ["newyear"], false)).toBe(true);
    expect(inThemes(nye, [], false)).toBe(false);
  });
});

describe("nearest is not automatically best", () => {
  it("leads with a pictured standout over a nearer workshop", () => {
    const data = finderData(finds, ask({}), { today: TODAY, now: NOW });
    const view = viewOf(data, [], {}, TODAY);
    expect(view.spotlight?.experience.id).toBe("festival");
    const cookies = finds.find((f) => f.experience.id === "cookies")!;
    expect(standout(cookies)).toBe(false);
  });
});

describe("helpers", () => {
  it("nextDay is a running listing's next day, or its own start", () => {
    const market = finds.find((f) => f.experience.id === "market")!;
    expect(nextDay(market, "2026-11-26")).toBe("2026-11-29");
  });
  it("discovery lives on the landing page", () => {
    expect(discoverHref({ at: "vernon", themes: ["markets"] })).toBe(
      "/christmas?at=vernon&theme=markets#discover",
    );
  });
});

describe("coming up says each find once, by when (M1154)", () => {
  const data = finderData(finds, ask({}), { today: TODAY, now: NOW });
  const c = comingUp(data, TODAY);
  const idsOf = (l: readonly { experience: { id: string } }[]) =>
    l.map((f) => f.experience.id);

  it("puts today, tomorrow, the weekend and the fortnight in their own rows", () => {
    expect(idsOf(c.today)).toEqual(["cookies"]);
    expect(idsOf(c.tomorrow)).toEqual(["festival"]);
    expect(idsOf(c.weekend)).toEqual(["market"]);
    expect(idsOf(c.soon)).toEqual(["market-dec"]);
  });

  it("never repeats a find, and Explore leaves out what it showed", () => {
    const all = shownIn(c);
    expect(new Set(all).size).toBe(all.length);
    expect(all).not.toContain("far-market");
    expect(all).not.toContain("nye");
  });
});
