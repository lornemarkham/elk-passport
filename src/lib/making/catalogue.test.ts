import { describe, expect, it } from "vitest";
import { OCTOBER_KINDS, isOctoberKind } from "@/lib/october/types";
import { MAKING, SHELVES, doingById, doingsOnShelf } from "./catalogue";
import { keepableDoing } from "@/components/october/make/keepableDoing";

/**
 * **A Doing is an intention with a durable name.**
 *
 * The id is what My October stores for ever, so the thing these guard is
 * stability: re-slugging a Doing orphans every row that pointed at it, in the
 * same way re-slugging a film would.
 */
describe("Doing is a kind October can hold", () => {
  it("is in the vocabulary", () => {
    expect(OCTOBER_KINDS).toContain("Doing");
    expect(isOctoberKind("Doing")).toBe(true);
  });

  it("did not displace any kind that already worked", () => {
    for (const kind of [
      "Place",
      "Organization",
      "Activity",
      "Event",
      "Experience",
      "Movie",
    ]) {
      expect(isOctoberKind(kind), kind).toBe(true);
    }
  });

  it("still refuses a kind nobody declared", () => {
    expect(isOctoberKind("Task")).toBe(false);
    expect(isOctoberKind("Doings")).toBe(false);
  });
});

describe("the catalogue", () => {
  it("is small and entirely authored", () => {
    expect(MAKING.length).toBeGreaterThanOrEqual(20);
    expect(MAKING.length).toBeLessThanOrEqual(30);
  });

  it("gives every Doing a stable, unique id", () => {
    const ids = MAKING.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it("gives every Doing a reason to exist, not a description", () => {
    for (const doing of MAKING) {
      expect(doing.title.length, doing.id).toBeGreaterThan(0);
      // The line is the argument for doing it. A stub would be shorter.
      expect(doing.line.length, doing.id).toBeGreaterThan(40);
    }
  });

  it("puts everything on a shelf that exists", () => {
    const known = new Set(SHELVES.map((s) => s.id));
    for (const doing of MAKING)
      expect(known.has(doing.shelf), doing.id).toBe(true);
  });

  it("fills every shelf — an empty heading is a broken promise", () => {
    for (const shelf of SHELVES) {
      expect(doingsOnShelf(shelf.id).length, shelf.id).toBeGreaterThan(0);
    }
  });

  it("gives costumes real presence rather than a token entry", () => {
    expect(doingsOnShelf("be-something").length).toBeGreaterThanOrEqual(4);
  });

  it("claims nothing about anybody else", () => {
    for (const doing of MAKING) {
      const said = `${doing.title} ${doing.line} ${doing.how ?? ""}`;
      // Claims *about other people*, not the word "everyone" — "everybody's
      // hands cold" is the people in your kitchen, which is the point.
      expect(said).not.toMatch(
        /popular|trending|most people|thousands|rated|reviews?\b|\d+ ?%/i,
      );
    }
  });

  it("finds a Doing by its id and nothing by a wrong one", () => {
    expect(doingById("carve-pumpkins")?.title).toBe("Carve pumpkins");
    expect(doingById("not-a-doing")).toBeUndefined();
  });
});

describe("how a Doing is stored", () => {
  it("is saved as a Doing with no date", () => {
    const keepable = keepableDoing(doingById("carve-pumpkins")!);
    expect(keepable).toEqual({
      entityId: "carve-pumpkins",
      entityKind: "Doing",
      name: "Carve pumpkins",
      startsAt: null,
    });
  });

  it("derives the row from one place, so two callers cannot disagree", () => {
    for (const doing of MAKING) {
      const a = keepableDoing(doing);
      const b = keepableDoing(doing);
      expect(a).toEqual(b);
      expect(a.entityId).toBe(doing.id);
      expect(a.name).toBe(doing.title);
    }
  });
});

describe("the enriched few that lead this world", () => {
  const enriched = MAKING.filter((d) => d.detail);

  it("is a handful, not the whole catalogue", () => {
    expect(enriched.length).toBeGreaterThanOrEqual(6);
    expect(enriched.length).toBeLessThanOrEqual(9);
    // The rest are still here, as ideas worth saving.
    expect(MAKING.length - enriched.length).toBeGreaterThan(10);
  });

  it("gives each one a hook, what you need, and the trick", () => {
    for (const doing of enriched) {
      const d = doing.detail!;
      expect(d.hook.length, doing.id).toBeGreaterThan(10);
      expect(d.need.length, doing.id).toBeGreaterThan(1);
      expect(d.trick.title.length, doing.id).toBeGreaterThan(5);
      expect(d.trick.body.length, doing.id).toBeGreaterThan(40);
    }
  });

  it("leads at least one of every shelf", () => {
    for (const shelf of SHELVES) {
      const led = doingsOnShelf(shelf.id).some((d) => d.detail);
      expect(led, shelf.id).toBe(true);
    }
  });

  it("keeps the voice, and keeps the sludge out", () => {
    for (const doing of enriched) {
      const said = `${doing.detail!.hook} ${doing.detail!.trick.body} ${(doing.detail!.tryThis ?? []).join(" ")}`;
      expect(said, doing.id).not.toMatch(
        /cherished|memories to last|fun-filled|perfect for the whole family|you'll love|amazing|!{1}/i,
      );
    }
  });

  it("is not an instruction manual", () => {
    // No numbered steps, no printable method. A Doing that needs twelve
    // steps is a craft site, which is the thing this is not.
    for (const doing of enriched) {
      expect(doing.detail!.need.length, doing.id).toBeLessThanOrEqual(6);
      expect(
        (doing.detail!.tryThis ?? []).length,
        doing.id,
      ).toBeLessThanOrEqual(4);
    }
  });
});

describe("imagery is truthful or absent", () => {
  it("credits and licences every image it uses", () => {
    for (const doing of MAKING) {
      if (!doing.image) continue;
      expect(doing.image.credit, doing.id).not.toBe("");
      expect(doing.image.licence, doing.id).toMatch(/CC|Public domain/i);
      expect(doing.image.page, doing.id).toMatch(/^https:\/\//);
      // Alt text says what the picture shows, never that it is the reader's.
      expect(doing.image.alt.length, doing.id).toBeGreaterThan(15);
      expect(doing.image.alt, doing.id).not.toMatch(/\byour\b/i);
    }
  });

  it("leaves a Doing without a picture rather than borrowing a wrong one", () => {
    // Measured: of the eight enriched, three had no openly-licensed image
    // that honestly showed the thing. They ship without one.
    const enrichedWithout = MAKING.filter((d) => d.detail && !d.image);
    expect(enrichedWithout.length).toBeGreaterThan(0);
  });

  it("never reuses one photograph for two different things", () => {
    const srcs = MAKING.map((d) => d.image?.src).filter(Boolean);
    expect(new Set(srcs).size).toBe(srcs.length);
  });
});
