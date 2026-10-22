import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ROGERS_ARENA_GATES } from "./arena";
import {
  CONCESSIONS,
  LEVELS,
  RING,
  SPOTS,
  distanceWords,
  levelOfSection,
  nearest,
  sectionsApart,
  spotById,
  whereWords,
} from "./concourse";
import {
  GATE_ANCHORS,
  VIEW,
  anchorFraction,
  gatePoint,
  placeSpots,
  sectionShapes,
} from "./bowl";
import {
  CART_MENU,
  PRICE_REPORTS,
  STAND_MENUS,
  cheapestReportedBeer,
} from "./menus";
import { GUEST_FACTS } from "./guest-facts";
import {
  ArenaActionSchema,
  PLACE_ID,
  QUESTS,
  agoWords,
  arenaWindow,
  freshness,
  levelOfPlace,
  lowestReport,
  placeOf,
  questKind,
  windowState,
  type Quest,
} from "./arena-mode";

describe("the concourse, as the arena's map draws it", () => {
  it("numbers each public level as the map does", () => {
    expect(RING["100"]).toHaveLength(22);
    expect(RING["100"][0]).toBe("101");
    expect(RING["100"].at(-1)).toBe("122");
    expect(RING["300"]).toHaveLength(30);
    expect(levelOfSection("309")).toBe("300");
    expect(levelOfSection("205")).toBeUndefined();
  });

  it("puts every spot beside sections that exist on its own level", () => {
    for (const s of SPOTS) {
      expect(s.by.length, s.id).toBeGreaterThan(0);
      for (const b of s.by) expect(RING[s.level], s.id).toContain(b);
    }
  });

  it("gives every spot a unique id the database will accept", () => {
    const ids = SPOTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(PLACE_ID);
  });

  it("names concessions only from the map's legend", () => {
    for (const s of SPOTS.filter(
      (x) => x.kind === "food" || x.kind === "drink",
    )) {
      expect(Object.values(CONCESSIONS)).toContain(s.name);
    }
  });

  it("draws every brand of the legend somewhere", () => {
    const drawn = new Set(SPOTS.map((s) => s.code));
    for (const code of Object.keys(CONCESSIONS))
      expect(drawn, code).toContain(code);
  });

  it("counts sections the short way round, and refuses across levels", () => {
    expect(sectionsApart("122", "101")).toBe(1);
    expect(sectionsApart("330", "301")).toBe(1);
    expect(sectionsApart("101", "112")).toBe(11);
    expect(sectionsApart("309", "309")).toBe(0);
    expect(sectionsApart("309", "109")).toBeUndefined();
  });

  it("finds the nearest hot dogs to a seat by section number", () => {
    const near = nearest("303", (s) => s.code === "J", 2);
    expect(near[0].spot.by).toContain("304");
    expect(near[0].apart).toBe(1);
    expect(nearest("999", () => true)).toEqual([]);
  });

  it("says distance only in sections, and only on the same level", () => {
    const j = spotById("300:J:304")!;
    expect(distanceWords("304", j)).toBe("Right by your section");
    expect(distanceWords("301", j)).toBe("3 sections along");
    expect(distanceWords("110", j)).toBe("On Level 300");
    expect(distanceWords(undefined, j)).toBeUndefined();
    expect(whereWords(j)).toBe("beside section 304");
  });

  it("marks what the map shades as shaded", () => {
    const shaded = SPOTS.filter(
      (s) =>
        s.zone === "rbcLanding" && (s.kind === "food" || s.kind === "drink"),
    );
    expect(shaded.length).toBeGreaterThan(0);
    for (const s of shaded) expect(s.note).toMatch(/shaded/);
  });
});

describe("the bowl drawing", () => {
  const cx = VIEW.w / 2;
  const cy = VIEW.h / 2;

  it("draws every section, inside the picture", () => {
    for (const level of LEVELS) {
      const shapes = sectionShapes(level);
      expect(shapes).toHaveLength(RING[level].length);
      for (const s of shapes) {
        expect(s.centre.x).toBeGreaterThan(0);
        expect(s.centre.x).toBeLessThan(VIEW.w);
        expect(s.centre.y).toBeGreaterThan(0);
        expect(s.centre.y).toBeLessThan(VIEW.h);
      }
    }
  });

  it("keeps the map's compass: 101 west, 106 north, 112 east, 117 south", () => {
    const at = (id: string) =>
      sectionShapes("100").find((s) => s.id === id)!.centre;
    expect(at("101").x).toBeLessThan(cx - 60);
    expect(at("101").y).toBeLessThan(cy);
    expect(at("122").y).toBeGreaterThan(cy);
    expect(at("106").y).toBeLessThan(cy - 40);
    expect(at("112").x).toBeGreaterThan(cx + 60);
    expect(at("117").y).toBeGreaterThan(cy + 40);
  });

  it("averages 122 and 101 to due west, not to the far side", () => {
    expect(anchorFraction("100", ["122", "101"])).toBeCloseTo(0, 2);
  });

  it("places every spot inside the picture, none on top of another", () => {
    for (const level of LEVELS) {
      const placed = placeSpots(level, SPOTS);
      expect(placed).toHaveLength(
        SPOTS.filter((s) => s.level === level).length,
      );
      for (const p of placed) {
        expect(p.at.x).toBeGreaterThanOrEqual(0);
        expect(p.at.x).toBeLessThanOrEqual(VIEW.w);
        expect(p.at.y).toBeGreaterThanOrEqual(0);
        expect(p.at.y).toBeLessThanOrEqual(VIEW.h);
      }
      for (let i = 0; i < placed.length; i++)
        for (let j = i + 1; j < placed.length; j++) {
          const d = Math.hypot(
            placed[i].at.x - placed[j].at.x,
            placed[i].at.y - placed[j].at.y,
          );
          expect(
            d,
            `${placed[i].spot.id} vs ${placed[j].spot.id}`,
          ).toBeGreaterThan(3);
        }
    }
  });

  it("never moves a pin more than one section from where the map draws it", () => {
    for (const level of LEVELS) {
      const shapes = sectionShapes(level);
      const ring = RING[level];
      for (const p of placeSpots(level, SPOTS)) {
        if (p.spot.zone) continue;
        const closest = shapes.reduce((a, b) =>
          Math.hypot(a.centre.x - p.at.x, a.centre.y - p.at.y) <=
          Math.hypot(b.centre.x - p.at.x, b.centre.y - p.at.y)
            ? a
            : b,
        );
        const off = Math.min(
          ...p.spot.by.map((b) => {
            const d = Math.abs(ring.indexOf(b) - ring.indexOf(closest.id));
            return Math.min(d, ring.length - d);
          }),
        );
        expect(off, `${p.spot.id} drawn by ${closest.id}`).toBeLessThanOrEqual(
          1,
        );
      }
    }
  });

  it("draws every gate on the level the map draws it, on the right side", () => {
    for (const g of ROGERS_ARENA_GATES)
      expect(GATE_ANCHORS[g.id]?.level).toBe(g.drawnOn);
    expect(gatePoint("10")!.y).toBeLessThan(cy - 60);
    expect(gatePoint("16")!.x).toBeGreaterThan(cx + 100);
    expect(gatePoint("8")!.x).toBeLessThan(cx - 100);
    expect(gatePoint("7")!.y).toBeGreaterThan(cy + 60);
    expect(gatePoint("99")).toBeUndefined();
  });
});

describe("menus and prices keep their sources", () => {
  it("lists items only for stands on the map, each with a diet", () => {
    for (const [code, menu] of Object.entries(STAND_MENUS)) {
      expect(Object.keys(CONCESSIONS)).toContain(code);
      expect(menu!.items.length).toBeGreaterThan(0);
      for (const i of menu!.items)
        expect(i.diets.length, i.name).toBeGreaterThan(0);
    }
    expect(CART_MENU.items.length).toBeGreaterThan(0);
  });

  it("never presents a price as official, and always says who and when", () => {
    for (const r of PRICE_REPORTS) {
      expect(r.official).toBe(false);
      expect(r.url).toMatch(/^https:\/\//);
      expect(r.published).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const p of r.prices)
        expect(p.price).toBe(`$${(p.cents / 100).toFixed(2)}`);
    }
  });

  it("knows the cheapest published beer and who published it", () => {
    const c = cheapestReportedBeer()!;
    expect(c.price.cents).toBe(1000);
    expect(c.report.by).toBe("Daily Hive");
  });

  it("cites every guest fact", () => {
    for (const f of GUEST_FACTS) expect(f.url).toMatch(/^https:\/\//);
  });
});

describe("check-ins: places, window, freshness", () => {
  const start = "2026-10-26T02:00:00.000Z";

  it("opens three hours before puck drop and closes five after", () => {
    const w = arenaWindow(start);
    expect(windowState(w, new Date("2026-10-25T22:59:00Z"))).toBe("before");
    expect(windowState(w, new Date("2026-10-25T23:00:00Z"))).toBe("open");
    expect(windowState(w, new Date("2026-10-26T06:59:59Z"))).toBe("open");
    expect(windowState(w, new Date("2026-10-26T07:00:00Z"))).toBe("closed");
  });

  it("reads every kind of place, and nothing else", () => {
    expect(placeOf("sec:309")).toMatchObject({
      label: "Section 309",
      level: "300",
    });
    expect(placeOf("sec:999")).toBeUndefined();
    expect(placeOf("gate:10")).toMatchObject({ label: "Gate 10", gate: "10" });
    expect(levelOfPlace(placeOf("gate:10")!)).toBe("100");
    expect(placeOf("gate:9")).toBeUndefined();
    expect(placeOf("300:J:304")).toMatchObject({
      label: "Hot Dogs (J)",
      level: "300",
    });
    expect(placeOf("out:outside")).toMatchObject({ offMap: true });
    expect(placeOf("meetup")).toBeUndefined();
    expect(
      placeOf("meetup", { gate: "16", spot: "by the doors" }),
    ).toMatchObject({ gate: "16" });
    expect(placeOf("meetup", { spot: "the statue" })).toMatchObject({
      offMap: true,
    });
    expect(placeOf("nonsense")).toBeUndefined();
  });

  it("calls a check-in fresh, recent, then stale", () => {
    const now = new Date("2026-10-26T03:00:00Z");
    expect(freshness("2026-10-26T02:55:00Z", now)).toBe("fresh");
    expect(freshness("2026-10-26T02:40:00Z", now)).toBe("recent");
    expect(freshness("2026-10-26T02:20:00Z", now)).toBe("stale");
    expect(agoWords("2026-10-26T02:48:00Z", now)).toBe("12 min ago");
    expect(agoWords("2026-10-26T01:30:00Z", now)).toBe("1 h 30 min ago");
  });

  it("uses the same place pattern as the migration", () => {
    const sql = fs.readFileSync(
      path.join(__dirname, "../../../docs/product/hockey/arena-migration.sql"),
      "utf8",
    );
    expect(sql).toContain(`'${PLACE_ID.source}'`);
  });
});

describe("actions", () => {
  it("accepts what the screen sends", () => {
    expect(
      ArenaActionSchema.safeParse({ type: "checkin", place: "sec:309" })
        .success,
    ).toBe(true);
    expect(
      ArenaActionSchema.safeParse({
        type: "ping",
        kind: "herd",
        place: "gate:10",
      }).success,
    ).toBe(true);
    expect(
      ArenaActionSchema.safeParse({
        type: "questJoin",
        quest: "6f1c1a3e-3f0e-4c1e-9a8e-1f0a2b3c4d5e",
        priceCents: 1000,
      }).success,
    ).toBe(true);
  });

  it("refuses what it shouldn't", () => {
    expect(
      ArenaActionSchema.safeParse({ type: "checkin", place: "<script>" })
        .success,
    ).toBe(false);
    expect(
      ArenaActionSchema.safeParse({
        type: "checkin",
        place: "sec:309",
        status: "x".repeat(81),
      }).success,
    ).toBe(false);
    expect(
      ArenaActionSchema.safeParse({ type: "ping", kind: "taunt" }).success,
    ).toBe(false);
    expect(
      ArenaActionSchema.safeParse({ type: "track", lat: 49.2 }).success,
    ).toBe(false);
    expect(
      ArenaActionSchema.safeParse({
        type: "questJoin",
        quest: "6f1c1a3e-3f0e-4c1e-9a8e-1f0a2b3c4d5e",
        priceCents: 0,
      }).success,
    ).toBe(false);
  });
});

describe("quests", () => {
  it("are the brief's six, each with somewhere sensible to go or something to pick", () => {
    expect(QUESTS.map((q) => q.id)).toEqual([
      "beer-run",
      "cheapest-beer",
      "hot-dog-hero",
      "find-the-herd",
      "missing-legend",
      "merch-mission",
    ]);
    for (const q of QUESTS)
      expect(
        q.destination || q.needsPlace || q.needsSubject,
        q.id,
      ).toBeTruthy();
  });

  it("keep beer quests about beer, not drinking", () => {
    for (const q of QUESTS.filter((x) => /beer/.test(x.id))) {
      expect(q.sensible).toBeTruthy();
      expect(`${q.name} ${q.pitch}`).not.toMatch(
        /chug|shot|most|fastest|drink(ing)? game/i,
      );
    }
  });

  it("send Hot Dog Hero to hot dogs and the merch mission to a store", () => {
    const hero = questKind("hot-dog-hero")!;
    expect(nearest("309", hero.destination!, 1)[0].spot.name).toMatch(
      /Hot Dogs|Steamer/,
    );
    const merch = questKind("merch-mission")!;
    expect(nearest("309", merch.destination!, 1)[0].spot.kind).toBe("store");
  });

  it("finds the lowest price the crew actually reported", () => {
    const q = {
      crew: [
        { user: "a", note: "", place: null, priceCents: 1200, at: "" },
        { user: "b", note: "", place: null, priceCents: null, at: "" },
        { user: "c", note: "", place: null, priceCents: 1050, at: "" },
      ],
    } as unknown as Quest;
    expect(lowestReport(q)?.user).toBe("c");
  });
});
