import { describe, expect, it } from "vitest";
import {
  calendarFile,
  preparations,
  countdown,
  daysUntil,
  mergeMemories,
  NOTE_LIMIT,
  parseMemories,
  parseMemoryInput,
  PHOTO_LIMIT,
  recapLine,
  recapOf,
  shareText,
  shifted,
  withMemory,
  withoutMemory,
  type Memory,
} from "./companion";

const note = (id: string, itemId: string | null, text = "hi"): Memory => ({
  id,
  kind: "note",
  at: "2026-11-08T10:00:00Z",
  itemId,
  text,
  photo: null,
});

describe("countdown", () => {
  it("counts whole calendar days, across a month end", () => {
    expect(daysUntil("2026-12-02", "2026-11-30")).toBe(2);
  });
  it("says Tomorrow, then a number, then nothing once it has arrived", () => {
    expect(countdown("2026-11-08", "2026-11-07")?.big).toBe("Tomorrow");
    expect(countdown("2026-11-12", "2026-11-07")).toMatchObject({
      big: "5",
      small: "days to go",
    });
    expect(countdown("2026-11-07", "2026-11-07")).toBeNull();
    expect(countdown(null, "2026-11-07")).toBeNull();
  });
});

describe("device memories", () => {
  it("drops anything malformed instead of throwing", () => {
    expect(parseMemories("not json")).toEqual([]);
    expect(parseMemories('{"a":1}')).toEqual([]);
    expect(
      parseMemories(
        JSON.stringify([
          { id: "1", kind: "photo", at: "x" },
          { id: "2", kind: "note", at: "x", text: "  " },
          { id: "3", kind: "weird", at: "x" },
          { id: "4", kind: "note", at: "x", text: "good" },
        ]),
      ).map((m) => m.id),
    ).toEqual(["4"]);
  });

  it("toggles a favourite per stop", () => {
    const fav: Memory = {
      id: "f1",
      kind: "favourite",
      at: "x",
      itemId: "s1",
      text: null,
      photo: null,
    };
    const on = withMemory([], fav);
    expect(on).toHaveLength(1);
    expect(withMemory(on, { ...fav, id: "f2" })).toHaveLength(0);
  });

  it("removes one by id", () => {
    expect(withoutMemory([note("a", null), note("b", null)], "a")).toEqual([
      note("b", null),
    ]);
  });
});

describe("running late", () => {
  it("pushes stated clock times and leaves unstated ones unstated", () => {
    expect(shifted(540, 30)).toBe(570);
    expect(shifted(undefined, 30)).toBeUndefined();
  });
});

describe("recap", () => {
  const stops = [
    { id: "s1", name: "Coffee" },
    { id: "s2", name: "Waterfall" },
  ];
  it("gathers a day by stop and keeps loose notes apart", () => {
    const r = recapOf(
      stops,
      ["s1"],
      [],
      [
        note("n1", "s2", "wet shoes"),
        note("n2", null, "great light"),
        {
          id: "f",
          kind: "favourite",
          at: "x",
          itemId: "s2",
          text: null,
          photo: null,
        },
      ],
      true,
    );
    expect(r.doneCount).toBe(1);
    expect(r.favourites.map((s) => s.name)).toEqual(["Waterfall"]);
    expect(r.stops[1]!.notes[0]!.text).toBe("wet shoes");
    expect(r.loose.map((m) => m.id)).toEqual(["n2"]);
  });

  it("does not claim what did not happen", () => {
    expect(recapLine(recapOf(stops, [], [], [], false), 2)).toBe(
      "2 stops planned. Tell us how it really went.",
    );
    const r = recapOf(
      stops,
      ["s1"],
      ["s2"],
      [
        {
          id: "p",
          kind: "photo",
          at: "x",
          itemId: "s1",
          text: null,
          photo: "data:image/jpeg;base64,AA",
        },
      ],
      true,
    );
    expect(recapLine(r, 2)).toBe("1 of 2 done · 1 skipped · 1 photo");
  });
});

describe("share text", () => {
  it("is titles and places only, capped", () => {
    const text = shareText(
      "Saturday by the lake",
      "Sat, Nov 14",
      Array.from({ length: 10 }, (_, i) => `Stop ${i + 1}`),
    );
    expect(text).toContain("Saturday by the lake — Sat, Nov 14");
    expect(text).toContain("…and 2 more");
    expect(text.split("\n").at(-1)).toBe("Planned with Go Have a Day");
  });
});

describe("preparations", () => {
  const base = { because: "", minutes: 60, notes: [] as string[] };
  it("says only what the stop's own detail says", () => {
    const prep = preparations([
      { name: "Winery", detail: { ...base, notes: ["Reservations advised."] } },
      { name: "Falls", detail: { ...base, rain: "exposed" as const } },
      { name: "Mystery", detail: undefined },
      { name: "Museum", detail: { ...base, cost: "$12", hours: "10–4" } },
    ]);
    expect(prep.map((p) => `${p.kind}:${p.stop}`)).toEqual([
      "booking:Winery",
      "weather:Falls",
      "cost:Museum",
      "hours:Museum",
    ]);
  });
  it("offers nothing for a day with no recorded detail", () => {
    expect(preparations([{ name: "A", detail: undefined }])).toEqual([]);
  });
});

describe("calendarFile", () => {
  it("is an all-day event ending the next day, with the title made safe", () => {
    const ics = calendarFile("Lake, day;\nout", "2026-11-30", "abc");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261130");
    expect(ics).toContain("DTEND;VALUE=DATE:20261201");
    expect(ics).toContain("SUMMARY:Lake  day  out");
  });
});

describe("memories kept against the account", () => {
  const id = "0b8f6c1e-3c1a-4f55-9a9e-6d2c1f7a0b11";
  const jpeg = "data:image/jpeg;base64,/9j/4AAQ";

  it("accepts a note, a photo and a favourite, and trims the words", () => {
    const note = parseMemoryInput({
      id,
      kind: "note",
      text: "  Best waffle  ",
    });
    expect(note).toMatchObject({ ok: true, value: { text: "Best waffle" } });
    expect(
      parseMemoryInput({ id, kind: "photo", photo: jpeg, itemId: "abc_1" }),
    ).toMatchObject({ ok: true, value: { photo: jpeg, itemId: "abc_1" } });
    expect(parseMemoryInput({ id, kind: "favourite" })).toMatchObject({
      ok: true,
    });
  });

  it("believes nothing it is sent", () => {
    for (const bad of [
      null,
      { kind: "note", text: "x" },
      { id: "not-a-uuid", kind: "note", text: "x" },
      { id, kind: "diary", text: "x" },
      { id, kind: "note", text: "   " },
      { id, kind: "note", text: "x".repeat(NOTE_LIMIT + 1) },
      { id, kind: "photo", photo: "data:image/png;base64,AAAA" },
      { id, kind: "photo", photo: `${jpeg}${"A".repeat(PHOTO_LIMIT)}` },
      { id, kind: "note", text: "x", itemId: "../etc" },
    ])
      expect(parseMemoryInput(bad).ok).toBe(false);
  });

  it("merges the phone's copy and the account's by id, oldest first", () => {
    const m = (i: string, at: string) => ({
      id: i,
      kind: "note" as const,
      at,
      itemId: null,
      text: i,
      photo: null,
    });
    const merged = mergeMemories(
      [m("a", "2026-11-10T10:00:00Z"), m("c", "2026-11-10T12:00:00Z")],
      [m("b", "2026-11-10T11:00:00Z"), m("a", "2026-11-10T10:00:00Z")],
    );
    expect(merged.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
});
