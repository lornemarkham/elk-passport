import { describe, expect, it } from "vitest";
import {
  EMPTY_PREFS,
  choose,
  clearDestination,
  clearHome,
  parsePrefs,
  saved,
  searchTowns,
  serialisePrefs,
  setHome,
} from "./prefs";

describe("remembered location", () => {
  it("knows nothing about a first-time visitor", () => {
    expect(saved(EMPTY_PREFS)).toBeUndefined();
    expect(saved(EMPTY_PREFS, "christmas")).toBeUndefined();
  });

  it("opens on the place they last chose, remembering recent ones", () => {
    let p = choose(EMPTY_PREFS, "vernon");
    p = choose(p, "kelowna");
    p = choose(p, "vancouver");
    expect(saved(p)).toEqual({ townId: "vancouver", source: "chosen" });
    expect(p.recent).toEqual(["vancouver", "kelowna", "vernon"]);
    // Choosing again moves it to the front rather than repeating it.
    expect(choose(p, "vernon").recent).toEqual([
      "vernon",
      "vancouver",
      "kelowna",
    ]);
  });

  it("falls back to home when nothing else was chosen", () => {
    const p = setHome(EMPTY_PREFS, "vernon");
    expect(saved(p)).toEqual({ townId: "vernon", source: "home" });
    expect(saved(clearHome(p))).toBeUndefined();
  });

  it("keeps an experience's destination apart from home and the shared place", () => {
    const base = setHome(choose(EMPTY_PREFS, "vernon"), "vernon");
    const p = choose(base, "vancouver", "christmas");
    expect(saved(p, "christmas")).toEqual({
      townId: "vancouver",
      source: "chosen",
    });
    // Every other experience, and home, are untouched.
    expect(saved(p, "snow")?.townId).toBe("vernon");
    expect(saved(p)?.townId).toBe("vernon");
    expect(p.home).toBe("vernon");
    expect(saved(clearDestination(p, "christmas"), "christmas")?.townId).toBe(
      "vernon",
    );
  });

  it("a shared change ends experience-only destinations", () => {
    const p = choose(choose(EMPTY_PREFS, "vernon"), "vancouver", "christmas");
    expect(saved(choose(p, "kelowna"), "christmas")?.townId).toBe("kelowna");
  });

  it("never stores a town Passport does not cover", () => {
    expect(choose(EMPTY_PREFS, "atlantis")).toBe(EMPTY_PREFS);
    expect(setHome(EMPTY_PREFS, "atlantis")).toBe(EMPTY_PREFS);
  });

  it("round-trips, and distrusts anything it reads back", () => {
    const p = setHome(choose(EMPTY_PREFS, "kelowna", "snow"), "vernon");
    expect(parsePrefs(serialisePrefs(p))).toEqual(p);
    expect(parsePrefs("not json")).toBe(EMPTY_PREFS);
    expect(parsePrefs(null)).toBe(EMPTY_PREFS);
    expect(
      parsePrefs(
        JSON.stringify({
          home: "atlantis",
          exploring: 7,
          recent: ["vernon", "nowhere"],
          destinations: { "<script>": "vernon", snow: "nowhere" },
        }),
      ),
    ).toEqual({ recent: ["vernon"], destinations: {} });
  });

  it("stores no coordinates", () => {
    expect(serialisePrefs(choose(EMPTY_PREFS, "vernon"))).not.toMatch(
      /latitude|longitude|49\.|-119/,
    );
  });
});

describe("searching for a city", () => {
  it("finds by name start, ignoring case and the province", () => {
    expect(searchTowns("kel")[0]?.id).toBe("kelowna");
    expect(searchTowns("VERNON, BC")[0]?.id).toBe("vernon");
    expect(searchTowns("van")[0]?.name).toMatch(/^Vancouver/);
  });

  it("finds by alias and by area", () => {
    expect(searchTowns("gastown")[0]?.id).toBe("gastown");
    expect(searchTowns("okanagan").length).toBeGreaterThan(5);
  });

  it("answers nothing to nothing, and nothing to nonsense", () => {
    expect(searchTowns("")).toEqual([]);
    expect(searchTowns("   ")).toEqual([]);
    expect(searchTowns("zzzzqq")).toEqual([]);
  });
});
