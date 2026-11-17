import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { answer, findsIn } from "./discover";
import { IDEAS } from "./ideas";
import { readRequest } from "./request";
import {
  WAYS,
  askFor,
  choiceHref,
  datesFor,
  ideasFor,
  plansFor,
  questionsFor,
  readChoice,
  strongest,
  surprise,
  wantsFinds,
  wayById,
  wayHref,
} from "./ways";

/** Tuesday. */
const TODAY = "2026-11-17";

describe("the six ways", () => {
  it("are the owner's six, in the owner's order", () => {
    expect(WAYS.map((w) => w.label)).toEqual([
      "Christmas Lights",
      "Christmas Date",
      "Family Fun",
      "Friends & Fun",
      "Cozy Christmas",
      "Events & Markets",
    ]);
  });

  it("send the lights to the map itself, and the rest to their own page", () => {
    expect(wayHref("lights", "kelowna", true)).toBe(
      "/christmas/lights?at=kelowna",
    );
    // The map knows only its own towns; elsewhere it opens on its default.
    expect(wayHref("lights", "vancouver", false)).toBe("/christmas/lights");
    expect(wayHref("date", "vernon")).toBe("/christmas/for/date?at=vernon");
  });

  it("never ask more than three questions, all optional", () => {
    for (const way of WAYS) {
      expect(questionsFor(way).length).toBeLessThanOrEqual(3);
      // Something is shown before any question is answered.
      const nothing = readChoice(way, {});
      expect(
        plansFor(way, nothing).length +
          ideasFor(way, nothing).length +
          Number(wantsFinds(way, nothing)) +
          Number(way.id === "lights"),
      ).toBeGreaterThan(0);
    }
  });
});

describe("a choice is the address", () => {
  const family = wayById("family");

  it("reads only answers the way offers", () => {
    expect(
      readChoice(family, { age: "under5", when: "nope", stay: "in" }),
    ).toEqual({ age: "under5" });
  });

  it("changes one answer, and tapping it again clears it", () => {
    const choice = { age: "under5" as const };
    expect(
      choiceHref(family, choice, "vernon", { id: "when", value: "weekend" }),
    ).toBe("/christmas/for/family?at=vernon&age=under5&when=weekend");
    expect(
      choiceHref(family, choice, "vernon", { id: "age", value: "under5" }),
    ).toBe("/christmas/for/family?at=vernon");
  });
});

describe("dates", () => {
  it("means this coming weekend on a weekday, and what's left of it at the weekend", () => {
    expect(datesFor("weekend", TODAY)).toEqual({
      from: "2026-11-21",
      to: "2026-11-22",
    });
    expect(datesFor("weekend", "2026-11-21")).toEqual({
      from: "2026-11-21",
      to: "2026-11-22",
    });
    expect(datesFor("weekend", "2026-11-22")).toEqual({
      from: "2026-11-22",
      to: "2026-11-22",
    });
    expect(datesFor("tonight", TODAY)).toEqual({ from: TODAY, to: TODAY });
    expect(datesFor("any", TODAY)).toEqual({});
  });
});

describe("the ask a choice amounts to", () => {
  it("carries the youngest's age to Atlas, and how far", () => {
    const ask = askFor(
      wayById("family"),
      { age: "under5", far: "near" },
      "vernon",
      TODAY,
    );
    expect(ask).toMatchObject({
      at: "vernon",
      km: 25,
      ages: [3],
      party: "family",
    });
    expect(ask.themes).toContain("santa");
  });

  it("narrows events to the kind tapped", () => {
    expect(
      askFor(wayById("events"), { kind: "markets" }, "vernon", TODAY).themes,
    ).toEqual(["markets"]);
  });

  it("asks Atlas nothing for a night in", () => {
    expect(wantsFinds(wayById("date"), { stay: "in" })).toBe(false);
    expect(wantsFinds(wayById("cozy"), {})).toBe(false);
  });
});

describe("plans are sentences the planner reads back as said", () => {
  it("a date tonight is dinner and the lights, tonight", () => {
    const [first] = plansFor(wayById("date"), { when: "tonight" });
    const r = readRequest(first!.say, TODAY);
    expect(r.day).toBe(TODAY);
    expect(r.needs.filter((n) => n.said).map((n) => n.need)).toEqual([
      "dinner",
      "lights",
    ]);
  });

  it("a family day carries the youngest's age and the weekend", () => {
    const [first] = plansFor(wayById("family"), {
      age: "5to9",
      when: "weekend",
    });
    const r = readRequest(first!.say, TODAY);
    expect(r.ages).toEqual([6]);
    expect(r.day).toBe("2026-11-21");
    expect(r.needs.map((n) => n.need)).toEqual(
      expect.arrayContaining(["santa", "skating", "lights"]),
    );
  });

  it("every plan names at least one part the planner recognises", () => {
    for (const way of WAYS)
      for (const p of plansFor(way, {}))
        expect(
          readRequest(p.say, TODAY).needs.some((n) => n.said),
          p.say,
        ).toBe(true);
  });

  it("staying in is not a plan to go anywhere", () => {
    expect(plansFor(wayById("date"), { stay: "in" })).toEqual([]);
  });
});

describe("ideas are ideas", () => {
  it("never state a time, a price, a date or a number to rely on", () => {
    for (const i of IDEAS)
      expect(`${i.title} ${i.line} ${i.careful ?? ""}`, i.id).not.toMatch(
        /\d|\$|open (now|today)|showing on|available on/i,
      );
  });

  it("never name a streaming service", () => {
    for (const i of IDEAS)
      expect(`${i.title} ${i.line}`).not.toMatch(
        /netflix|prime|disney|crave|apple tv|spotify/i,
      );
  });

  it("say so plainly where a place we don't list is needed", () => {
    for (const id of ["sledding", "outdoor-fire", "movie-night"])
      expect(IDEAS.find((i) => i.id === id)!.careful).toBeTruthy();
  });

  it("an outing idea the planner can place reads as real parts", () => {
    for (const i of IDEAS.filter((x) => x.plan))
      expect(readRequest(i.plan!, TODAY).needs.length, i.id).toBeGreaterThan(0);
  });

  it("cozy is at home first; staying in keeps only home ideas", () => {
    const cozy = ideasFor(wayById("cozy"), {});
    expect(cozy[0]!.stay).toBe("in");
    expect(
      ideasFor(wayById("date"), { stay: "in" }).every((i) => i.stay === "in"),
    ).toBe(true);
    expect(
      ideasFor(wayById("cozy"), { mood: "baking" }).every((i) =>
        i.tags.includes("baking"),
      ),
    ).toBe(true);
  });
});

describe("on Atlas's real corpus (the committed 2026-11-14 read)", () => {
  const file = resolve(
    __dirname,
    "../../../docs/product/christmas/verification/atlas-candidates-2026-11-14.json.gz",
  );
  const parsed = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8"));
  const candidates: DiscoveryCandidate[] = Array.isArray(parsed)
    ? parsed
    : parsed.candidates;
  const finds = findsIn(candidates.map(candidateToExperience), TODAY);

  it("a few strong finds are placed near the town, this season's, surest first", () => {
    const ask = askFor(wayById("events"), {}, "kelowna", TODAY);
    const shown = strongest(answer(finds, ask), 6);
    expect(shown.length).toBeGreaterThan(0);
    for (const f of shown) {
      expect(f.km, f.experience.title).toBeLessThanOrEqual(ask.km);
      expect(f.when.confidence).not.toBe("past");
    }
    const rank = { dated: 0, check: 1, unconfirmed: 2, past: 3 };
    const ranks = shown.map((f) => rank[f.when.confidence]);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it("surprise draws both real finds and ideas, and says which", () => {
    const ask = askFor(wayById("events"), {}, "kelowna", TODAY);
    const local = strongest(answer(finds, ask), 24);
    const kinds = new Set(
      Array.from({ length: 60 }, (_, s) => surprise(local, s).kind),
    );
    expect(kinds).toEqual(new Set(["find", "idea"]));
    expect(surprise(local, 7)).toEqual(surprise(local, 7));
  });
});
