import { describe, expect, it } from "vitest";
import { CATALOGUE } from "@/lib/movies/catalogue";
import { MAKING } from "@/lib/making/catalogue";
import {
  possibilityFromDoing,
  possibilityFromFilm,
  type Possibility,
} from "./possibility";
import { byIntent, INTENTS, intentById, stableJitter } from "./intents";
import { mixSources, type Context } from "./fit";

/**
 * **An intention must change the page, and must not shrink it.**
 *
 * Those are the two halves of the claim Experiment B makes. A mood that
 * reorders nothing is a decoration; a mood that removes things is a filter
 * wearing a friendlier label, and a person who changes their mind halfway down
 * has nowhere to change it to.
 */

const ctx: Context = { today: "2026-10-08", weather: {} };

const haunt: Possibility = {
  id: "haunt",
  source: "atlas",
  title: "Black Mountain Haunted House",
  availability: {
    shape: "window",
    label: "OCT 1–31",
    days: ["2026-10-08"],
    tonight: true,
  },
  setting: "outdoor-night",
  href: "/",
  text: "a haunted house, three storeys of it",
  tags: ["go-out", "outdoor-night"],
};

const POOL: readonly Possibility[] = [
  haunt,
  ...CATALOGUE.map(possibilityFromFilm),
  ...MAKING.map(possibilityFromDoing),
];

const top = (id: string, n = 6) =>
  [...POOL].sort(byIntent(intentById(id)!, ctx)).slice(0, n);

describe("choosing how you feel reorders everything", () => {
  it("gives a different first answer for every intention", () => {
    const firsts = INTENTS.map((i) => [...POOL].sort(byIntent(i, ctx))[0].id);
    expect(new Set(firsts).size).toBeGreaterThan(3);
  });

  it("puts making things first when somebody says make something", () => {
    expect(top("make")[0].source).toBe("doing");
  });

  it("puts going out first when somebody says get out of the house", () => {
    expect(top("get-out")[0].source).toBe("atlas");
  });

  it("will not frighten a child who was brought along", () => {
    const withKid = top("with-a-kid", 8);
    expect(withKid.every((p) => (p.scare ?? 0) < 2)).toBe(true);
  });

  it("finds the frightening things when asked to", () => {
    const scared = top("scare-me", 5);
    expect(
      scared.some((p) => (p.scare ?? 0) >= 2 || p.setting === "outdoor-night"),
    ).toBe(true);
  });

  it("keeps short things short", () => {
    // Anything that stated a length and got into the first answers has to be
    // genuinely short. Things that stated none may be there; that is honest.
    const stated = top("an-hour", 6).filter((p) => p.minutes);
    expect(stated.length).toBeGreaterThan(0);
    expect(stated.every((p) => p.minutes! <= 75)).toBe(true);
  });
});

describe("nothing is ever hidden by a mood", () => {
  it("returns the whole pool whichever intention is chosen", () => {
    for (const intent of INTENTS) {
      expect([...POOL].sort(byIntent(intent, ctx))).toHaveLength(POOL.length);
    }
  });

  it("still contains the opposite of what was asked for", () => {
    const ordered = [...POOL].sort(byIntent(intentById("stay-in")!, ctx));
    expect(ordered.map((p) => p.id)).toContain("haunt");
  });
});

describe("surprise is deliberately not the obvious answer", () => {
  it("leads with something the contextual ordering would bury", () => {
    const surprise = [...POOL].sort(byIntent(intentById("surprise")!, ctx));
    const obvious = [...POOL].sort(byIntent(intentById("get-out")!, ctx));
    expect(surprise[0].id).not.toBe(obvious[0].id);
  });
});

describe("the same evening twice looks the same", () => {
  it("jitters by id, never by chance", () => {
    expect(stableJitter("abc", 5)).toBe(stableJitter("abc", 5));
    expect(stableJitter("abc", 5)).toBeLessThan(5);
  });

  it("orders identically on two runs, so the server and browser agree", () => {
    const once = [...POOL].sort(byIntent(intentById("surprise")!, ctx));
    const twice = [...POOL].sort(byIntent(intentById("surprise")!, ctx));
    expect(once.map((p) => p.id)).toEqual(twice.map((p) => p.id));
  });
});

describe("what the labs show, after composition", () => {
  it("never shows four from one catalogue in a row", () => {
    for (const intent of INTENTS) {
      const shown = mixSources([...POOL].sort(byIntent(intent, ctx))).slice(
        0,
        12,
      );
      let run = 0;
      let last = "";
      for (const p of shown) {
        run = p.source === last ? run + 1 : 1;
        last = p.source;
        expect(run, `${intent.id}: ${p.title}`).toBeLessThanOrEqual(3);
      }
    }
  });
});
