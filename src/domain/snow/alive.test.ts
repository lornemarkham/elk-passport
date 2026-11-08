import { readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { applyAction, newDay, type SnowDay } from "./day";
import { askLine, crewFromAsk, readAsk } from "./ask";
import {
  DEFAULT_TWEAKS,
  changedStops,
  composeDay,
  parseTweaks,
  readChange,
  type Tweaks,
} from "./itinerary";
import { mountainById } from "./mountains";
import { picksNear } from "./nearby";
import {
  checkedWords,
  dateChoices,
  isStaleFact,
  liftHoursOn,
  resortFacts,
  seasonOn,
} from "./resorts";

const TODAY = "2026-11-08"; // a Sunday
const facts = resortFacts("silverstar")!;

describe("resort facts: published, quoted, dated", () => {
  it("every published value carries its quote, an https source and a check date", () => {
    const s = facts.season!;
    for (const f of [
      s.opens,
      s.closes!,
      facts.liftHours!,
      facts.statusWhenChecked!,
    ]) {
      expect(f.quote.length).toBeGreaterThan(5);
      expect(f.source).toMatch(/^https:\/\/(www|shop)\.skisilverstar\.com/);
      expect(f.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(s.caveat).toMatch(/Tentative/);
  });

  it("opening weekend is offered only from a published opening day", () => {
    const withFacts = dateChoices(TODAY, facts);
    // Alpine opening Fri 27 Nov → opening weekend is Sat 28 Nov.
    expect(withFacts[0]).toMatchObject({ key: "opening", date: "2026-11-28" });
    expect(withFacts[0].because).toContain("November 27, 2026");
    const none = dateChoices(TODAY, resortFacts("whistler-blackcomb"));
    expect(none.map((c) => c.key)).toEqual(["this-weekend", "next-weekend"]);
    // Once opening day is past, it stops being offered.
    expect(dateChoices("2026-12-01", facts).map((c) => c.key)).not.toContain(
      "opening",
    );
  });

  it("this weekend on a Sunday is today; next weekend is the coming Saturday", () => {
    const c = dateChoices(TODAY, undefined);
    expect(c[0].date).toBe("2026-11-08");
    expect(c[1].date).toBe("2026-11-14");
    expect(dateChoices("2026-11-11", undefined).map((x) => x.date)).toEqual([
      "2026-11-14",
      "2026-11-21",
    ]);
  });

  it("says whether a date is inside the published season, and how old the fact is", () => {
    expect(seasonOn(facts, "2026-11-20")).toBe("before");
    expect(seasonOn(facts, "2026-11-28")).toBe("open");
    expect(seasonOn(facts, "2027-05-01")).toBe("after");
    expect(seasonOn(undefined, "2026-11-28")).toBe("unknown");
    expect(checkedWords("2026-11-08", TODAY)).toBe("checked today");
    expect(checkedWords("2026-11-05", TODAY)).toBe("checked 3 days ago");
    expect(isStaleFact("2026-11-08", "2026-12-01")).toBe(true);
    expect(liftHoursOn(facts, "2026-12-01")?.value.from).toBe("09:00");
    expect(liftHoursOn(facts, "2027-02-10")).toBeUndefined();
    expect(liftHoursOn(facts, "2026-11-14")).toBeUndefined(); // before opening
  });
});

describe("the ask: one sentence, read by rules", () => {
  const SENTENCE =
    "We're going to SilverStar opening weekend. Four people. Two skiers, one snowboarder and someone who doesn't ski. Make us an awesome day.";

  it("reads the mission's sentence exactly", () => {
    const ask = readAsk(SENTENCE, TODAY);
    expect(ask.mountain?.id).toBe("silverstar");
    expect(ask.date).toMatchObject({ key: "opening", date: "2026-11-28" });
    expect(ask.crew).toEqual({ ski: 2, snowboard: 1, apres: 1 });
    expect(ask.total).toBe(4);
    expect(askLine(ask)).toEqual([
      "SilverStar",
      "Opening weekend",
      "4 people (2 skiing, 1 snowboarding, 1 not skiing)",
    ]);
    // The host skis: three more to add.
    expect(crewFromAsk(ask, "ski")).toEqual(["ski", "snowboard", "apres"]);
  });

  it("never invents an opening weekend a resort hasn't published", () => {
    const ask = readAsk("Whistler opening weekend, 3 skiers", TODAY);
    expect(ask.mountain?.id).toBe("whistler-blackcomb");
    expect(ask.date).toBeUndefined();
    expect(ask.openingUnknown).toBe(true);
  });

  it("reads other ways of saying it", () => {
    expect(readAsk("silver star next weekend", TODAY).date?.date).toBe(
      "2026-11-14",
    );
    expect(
      readAsk("Big White on December 12, a couple of boarders", TODAY),
    ).toMatchObject({
      mountain: { id: "big-white" },
      date: { date: "2026-12-12" },
      crew: { snowboard: 2 },
    });
    expect(readAsk("Sun Peaks 2027-01-09", TODAY).date?.date).toBe(
      "2027-01-09",
    );
    expect(readAsk("we want to go skiing", TODAY).mountain).toBeUndefined();
  });

  it("fills an unsaid rider when a total is bigger than what was described", () => {
    const ask = readAsk("Five of us, two skiers", TODAY);
    expect(crewFromAsk(ask, "ski")).toEqual(["ski", "ski", "ski", "ski"]);
  });
});

// --------------------------------------------------------------- itinerary

const body = JSON.parse(
  gunzipSync(
    readFileSync(
      path.resolve(
        __dirname,
        "../../../docs/product/snow/verification/atlas-silverstar-2026-11-08.json.gz",
      ),
    ),
  ).toString("utf8"),
) as { candidates: DiscoveryCandidate[] };
const picks = picksNear(
  body.candidates.map(candidateToExperience),
  mountainById("silverstar")!,
  { onMountainKm: facts.onMountainKm },
);

const NOW = "2026-11-08T20:00:00.000Z";
function crewDay(): SnowDay {
  let d = newDay({
    id: "d1",
    title: "SilverStar opening",
    now: NOW,
    host: {
      id: "ana",
      name: "Ana",
      discipline: "ski",
      ability: "intermediate",
      ownGear: true,
    },
  });
  const add = (
    id: string,
    name: string,
    discipline: "ski" | "snowboard" | "apres",
  ) => {
    const r = applyAction(
      d,
      {
        type: "addPerson",
        person: { id, name, discipline, ability: "beginner", ownGear: false },
      },
      NOW,
    );
    if (r.ok) d = r.day;
  };
  add("ben", "Ben", "ski");
  add("cy", "Cy", "snowboard");
  add("dee", "Dee", "apres");
  const r = applyAction(
    d,
    { type: "when", date: "2026-11-28", meetTime: "07:30" },
    NOW,
  );
  return r.ok ? r.day : d;
}

const compose = (day: SnowDay, tweaks: Tweaks = DEFAULT_TWEAKS) =>
  composeDay({ day, mountainName: "SilverStar", facts, picks, tweaks });

describe("the suggested day", () => {
  it("builds a whole day from real places and labels what each stop rests on", () => {
    const { stops, notes } = compose(crewDay());
    const ids = stops.map((s) => s.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "meet",
        "lifts",
        "ride-am",
        "others-am",
        "lunch",
        "last-run",
        "apres",
        "home",
      ]),
    );
    const lifts = stops.find((s) => s.id === "lifts")!;
    expect(lifts).toMatchObject({ time: "09:00", basis: "published" });
    expect(stops.find((s) => s.id === "last-run")!.time).toBe("15:30");
    // Dee isn't skiing: a real Atlas thing on the mountain for her.
    const dee = stops.find((s) => s.id === "others-am")!;
    expect(dee.basis).toBe("atlas");
    expect(dee.pick?.onMountain).toBe(true);
    expect(dee.title).toMatch(/^Dee: /);
    // Every Atlas stop is a real entity id from the corpus.
    for (const s of stops.filter((x) => x.basis === "atlas"))
      expect(body.candidates.some((c) => c.id === s.pick!.id)).toBe(true);
    expect(notes.join(" ")).toMatch(/resort's to say/);
  });

  it("never sends a ski-day lunch down the hill", () => {
    const lunch = compose(crewDay()).stops.find((s) => s.id === "lunch")!;
    expect(lunch.gap).toMatch(/no lunch spot on the mountain/);
    expect(lunch.pick).toBeUndefined();
  });

  it("keeps us on the mountain honestly: no lunch there in Atlas, so it says so", () => {
    const day = crewDay();
    const r = readChange("Keep us on the mountain", DEFAULT_TWEAKS, day);
    expect(r.ok).toBe(true);
    const after = compose(day, (r as { tweaks: Tweaks }).tweaks);
    const lunch = after.stops.find((s) => s.id === "lunch")!;
    expect(lunch.gap).toMatch(/no lunch spot on the mountain/);
    expect(lunch.source?.url).toContain("skisilverstar.com");
    const dee = after.stops.find((s) => s.id === "others-am")!;
    expect(dee.pick?.onMountain).toBe(true);
  });

  it("reads each of the mission's changes and touches only what it names", () => {
    const day = crewDay();
    const before = compose(day);
    const earlier = readChange("Move lunch earlier", DEFAULT_TWEAKS, day);
    expect(earlier).toMatchObject({ ok: true, tweaks: { lunchAt: "12:00" } });
    const moved = changedStops(
      before,
      compose(day, (earlier as { tweaks: Tweaks }).tweaks),
    );
    expect(moved.map((s) => s.id)).toEqual(expect.arrayContaining(["lunch"]));
    expect(moved.map((s) => s.id)).not.toContain("apres");

    const apres = readChange(
      "Make après more interesting",
      DEFAULT_TWEAKS,
      day,
    );
    const a2 = compose(day, (apres as { tweaks: Tweaks }).tweaks);
    expect(a2.stops.find((s) => s.id === "apres")!.title).not.toBe(
      before.stops.find((s) => s.id === "apres")!.title,
    );
    expect(changedStops(before, a2).map((s) => s.id)).toEqual(["apres"]);

    const other = readChange(
      "Find something for the non-skier",
      DEFAULT_TWEAKS,
      day,
    );
    expect(other.ok).toBe(true);
    // Atlas has no lunch on SilverStar: the honest answer, not an invention.
    const lunch = readChange(
      "Add somewhere for lunch",
      DEFAULT_TWEAKS,
      day,
      picks,
    );
    expect(lunch).toMatchObject({ ok: false });
    expect(lunch.said).toMatch(/won't make one up/);
    expect(readChange("lunch at 1", DEFAULT_TWEAKS, day)).toMatchObject({
      tweaks: { lunchAt: "13:00" },
    });
  });

  it("never moves a locked decision, and says why", () => {
    let day = crewDay();
    for (const a of [
      {
        type: "propose",
        proposal: {
          id: "p1",
          topic: "apres",
          label: "Long John's Pub",
          by: "ana",
          source: "crew",
        },
      },
      {
        type: "choose",
        topic: "apres",
        proposalId: "p1",
        by: "ana",
        changeId: "c1",
      },
    ] as const) {
      const r = applyAction(day, a, NOW);
      if (r.ok) day = r.day;
    }
    const r = readChange("Make après more interesting", DEFAULT_TWEAKS, day);
    expect(r).toMatchObject({ ok: false });
    expect(r.said).toMatch(/locked in \(Long John's Pub\)/);
    const apres = compose(day).stops.find((s) => s.id === "apres")!;
    expect(apres).toMatchObject({
      basis: "decided",
      title: "Après: Long John's Pub",
    });
  });

  it("says when nobody is marked as not skiing, and what it can't read", () => {
    const solo = newDay({
      id: "s",
      title: "x",
      now: NOW,
      host: {
        id: "a",
        name: "A",
        discipline: "ski",
        ability: "advanced",
        ownGear: true,
      },
    });
    expect(
      readChange("something for the non-skier", DEFAULT_TWEAKS, solo).said,
    ).toMatch(/Nobody in the crew/);
    expect(readChange("make it epic", DEFAULT_TWEAKS, solo)).toMatchObject({
      ok: false,
    });
    expect(readChange("make it epic", DEFAULT_TWEAKS, solo).said).toMatch(
      /rules, not AI/,
    );
  });

  it("parses stored tweaks defensively", () => {
    expect(parseTweaks(null)).toEqual(DEFAULT_TWEAKS);
    expect(
      parseTweaks({ lunchAt: "25:00", stay: "moon", skip: { apres: -1 } }),
    ).toEqual(DEFAULT_TWEAKS);
  });
});
