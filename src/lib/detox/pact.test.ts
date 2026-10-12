import { describe, expect, it } from "vitest";
import {
  CHALLENGES,
  HAND,
  PHONE_PLACES,
  STAKES,
  challengeById,
  deal,
  defaultPact,
  redeal,
  stakeSentence,
} from "./pact";

/**
 * **The pact is a game, so it has to deal fairly and say nothing untrue.**
 *
 * Pinned: a deal is reproducible from its seed (the server and the browser
 * must agree on the first hand), a hand never repeats a card, "deal again"
 * actually changes the hand, and no card claims something about a place —
 * the per-stop challenges in `build.ts` are the ones allowed to do that, and
 * only from what Atlas states.
 */
describe("deal", () => {
  it("is the same hand for the same seed", () => {
    expect(deal(7).map((c) => c.id)).toEqual(deal(7).map((c) => c.id));
  });

  it("deals HAND distinct cards from the deck", () => {
    for (let seed = 0; seed < 50; seed++) {
      const hand = deal(seed);
      expect(hand).toHaveLength(HAND);
      expect(new Set(hand.map((c) => c.id)).size).toBe(HAND);
      for (const card of hand) expect(CHALLENGES).toContain(card);
    }
  });

  it("reaches every card across seeds — no card is dead weight", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 200; seed++)
      for (const card of deal(seed)) seen.add(card.id);
    expect(seen.size).toBe(CHALLENGES.length);
  });

  it("never deals more than the deck holds", () => {
    expect(deal(3, 99)).toHaveLength(CHALLENGES.length);
  });
});

describe("redeal", () => {
  it("moves to the next seed and keeps the rest of the pact", () => {
    const pact = { ...defaultPact(), phone: "home", stake: "dishes" };
    const next = redeal(pact);
    expect(next.seed).toBe(pact.seed + 1);
    expect(next.phone).toBe("home");
    expect(next.stake).toBe("dishes");
    expect(next.challenges).toEqual(deal(pact.seed + 1).map((c) => c.id));
  });

  it("changes the hand within a couple of presses", () => {
    const first = defaultPact();
    const later = redeal(redeal(first));
    expect(later.challenges).not.toEqual(first.challenges);
  });
});

describe("the copy", () => {
  it("has unique ids everywhere, so storage can refer to them", () => {
    for (const list of [CHALLENGES, STAKES, PHONE_PLACES]) {
      const ids = list.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("finishes the stake sentence, and falls back rather than failing", () => {
    expect(stakeSentence("dishes")).toBe(
      "Whoever reaches for a phone first does tonight's dishes.",
    );
    expect(stakeSentence("nonsense")).toBe(stakeSentence(STAKES[0]!.id));
  });

  it("does not lecture: no wellness vocabulary, no screen-time talk", () => {
    const all = [
      ...CHALLENGES.map((c) => c.line),
      ...STAKES.map((s) => s.owes),
      ...PHONE_PLACES.flatMap((p) => [p.label, p.line]),
    ].join(" ");
    expect(all).not.toMatch(
      /detox|mindful|wellness|screen ?time|addict|dopamine|should/i,
    );
  });

  it("finds challenges by id", () => {
    expect(challengeById("draw-it")?.line).toMatch(/Draw it/);
    expect(challengeById(undefined)).toBeUndefined();
  });
});
