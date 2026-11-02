import { describe, expect, it } from "vitest";
import {
  BAD_IDEAS,
  DARES,
  decodeAnswer,
  decodePlay,
  draw,
  encodeAnswer,
  encodePlay,
  hideUnopened,
  isPlayNote,
  labelOf,
  opened,
  playsOf,
  textFor,
  THIS_OR_THAT,
  waitingOn,
  type PlayBody,
  type Theme,
} from "./plays";

const pick: PlayBody = {
  k: "pick",
  a: "Hot chocolate",
  b: "Apple cider",
  mode: "predict",
  guess: 1,
  t: 1,
};
const item = (
  id: string,
  note: string,
  mine: boolean,
  extra: Partial<{ canChange: boolean; label: string | null }> = {},
) => ({
  id,
  note,
  mine,
  addedBy: mine ? "lorne" : "jess",
  canChange: mine,
  label: null,
  ...extra,
});

describe("a play is an ordinary item's note", () => {
  it("round-trips, and is recognised as a play", () => {
    const note = encodePlay(pick);
    expect(isPlayNote(note)).toBe(true);
    expect(decodePlay(note)).toEqual(pick);
    expect(note.length).toBeLessThanOrEqual(1000);
    const a = encodeAnswer({ to: "p1", pick: 0, t: 2 });
    expect(isPlayNote(a)).toBe(true);
    expect(decodeAnswer(a)).toEqual({ to: "p1", pick: 0, t: 2 });
  });

  it("refuses what isn't one", () => {
    expect(isPlayNote("Bring the thermos")).toBe(false);
    expect(decodePlay("♥play {nope")).toBeNull();
    expect(decodePlay(encodePlay({ k: "pick", a: "x", t: 1 }))).toBeNull();
    expect(decodePlay(encodePlay({ k: "dare", t: 1 }))).toBeNull();
  });

  it("labels fit the core's 120 characters", () => {
    const long = { k: "dare" as const, text: "x".repeat(300), t: 1 };
    expect(labelOf(long).length).toBeLessThanOrEqual(120);
    expect(labelOf(pick)).toBe("This or that: Hot chocolate or Apple cider?");
  });
});

describe("reading plays back", () => {
  const items = [
    item("p1", encodePlay(pick), true),
    item("a1", encodeAnswer({ to: "p1", pick: 0, t: 5 }), false),
    item("a2", encodeAnswer({ to: "p1", pick: 1, t: 9 }), false),
    item(
      "p2",
      encodePlay({ k: "dare", text: "Sing", flavour: "funny", t: 3 }),
      false,
    ),
    item("x", "an ordinary suggestion", false),
  ];

  it("newest first, each with the latest answer from each side", () => {
    const plays = playsOf(items);
    expect(plays.map((p) => p.id)).toEqual(["p2", "p1"]);
    expect(plays[1]!.theirs?.pick).toBe(1);
    expect(plays[1]!.yours).toBeNull();
  });

  it("knows what's waiting on me", () => {
    expect(waitingOn(playsOf(items)).map((p) => p.id)).toEqual(["p2"]);
  });
});

describe("a note opens when it says", () => {
  const sunset = 17 * 60 + 33;
  const note = encodePlay({
    k: "note",
    text: "You're my favourite",
    opens: sunset,
    t: 1,
  });

  it("opens on the day at its time, and any day after", () => {
    expect(opened(sunset, "2026-11-02", "2026-11-02", sunset - 1)).toBe(false);
    expect(opened(sunset, "2026-11-02", "2026-11-02", sunset)).toBe(true);
    expect(opened(sunset, "2026-11-02", "2026-11-01", 23 * 60)).toBe(false);
    expect(opened(sunset, "2026-11-02", "2026-11-03", 0)).toBe(true);
    expect(opened("now", "2026-11-02", "2026-11-01", 0)).toBe(true);
  });

  it("never reaches the other browser before then; the author keeps it", () => {
    const [theirs] = hideUnopened(
      [item("n", note, false)],
      "2026-11-02",
      "2026-11-02",
      12 * 60,
    );
    expect(theirs!.note).not.toContain("favourite");
    const plays = playsOf([theirs!]);
    expect(plays[0]!.hidden).toBe(true);
    expect(plays[0]!.opens).toBe(sunset);
    const [mine] = hideUnopened(
      [item("n", note, true)],
      "2026-11-02",
      "2026-11-02",
      12 * 60,
    );
    expect(mine!.note).toContain("favourite");
    const [later] = hideUnopened(
      [item("n", note, false)],
      "2026-11-02",
      "2026-11-02",
      18 * 60,
    );
    expect(later!.note).toContain("favourite");
  });

  it("an unopened note isn't waiting on anyone yet", () => {
    const hidden = hideUnopened(
      [item("n", note, false)],
      "2026-11-02",
      "2026-11-02",
      0,
    );
    expect(waitingOn(playsOf(hidden))).toEqual([]);
  });
});

describe("words worth texting", () => {
  it("says each kind in the sender's voice", () => {
    expect(textFor(pick)).toMatch(/already guessed yours/);
    expect(
      textFor({ k: "decide", a: "Stay wild", b: "Warm ending", t: 1 }),
    ).toBe("You decide: Stay wild or Warm ending? Your call, I'll go with it.");
    expect(
      textFor({ k: "dare", text: "Sing.", flavour: "photo", t: 1 }),
    ).toMatch(/^Photo dare/);
    expect(
      textFor({ k: "note", text: "x", opens: 600, t: 1 }, "at sunset"),
    ).toBe("I left you a note. It opens at sunset. ❤️");
    expect(
      textFor(
        { k: "note", text: "x", secret: true, opens: 600, t: 1 },
        "at 6:10 pm",
      ),
    ).toMatch(/secret in our plan\. It opens at 6:10 pm/);
  });

  it("decks prefer the night's own themes and never draw another night's", () => {
    const themes = new Set<Theme>(["hunt", "lake", "fire"]);
    for (let i = 0; i < 40; i++) {
      const r = () => i / 40;
      const [, , theme] = draw(THIS_OR_THAT, themes, r);
      if (theme) expect(themes.has(theme)).toBe(true);
      const [, t2] = draw(DARES.adventurous, themes, r);
      if (t2) expect(themes.has(t2)).toBe(true);
      const [, t3] = draw(BAD_IDEAS, themes, r);
      if (t3) expect(themes.has(t3)).toBe(true);
    }
  });
});
