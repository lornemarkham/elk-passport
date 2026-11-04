import { describe, expect, it } from "vitest";
import { CHALLENGES, checkChallengeText, offeredTo } from "./challenges";
import { groupCeiling, groupLine } from "./ability";
import {
  applyAction,
  leading,
  newDay,
  parseDay,
  undecided,
  type Action,
  type Person,
  type SnowDay,
} from "./day";
import { findMountains, MOUNTAINS } from "./mountains";
import { phaseOf, reminders, countdownToDay, gearFor } from "./prep";
import { awards, standings } from "./scoring";
import { buildRecap, readFragment, recapText, shareFragment } from "./recap";

const NOW = "2026-12-20T10:00:00.000Z";
const host: Person = {
  id: "a",
  name: "Ana",
  discipline: "ski",
  ability: "advanced",
  ownGear: true,
};
const ben: Person = {
  id: "b",
  name: "Ben",
  discipline: "snowboard",
  ability: "beginner",
  ownGear: false,
};

function run(day: SnowDay, ...actions: Action[]): SnowDay {
  return actions.reduce((d, a) => {
    const r = applyAction(d, a, NOW);
    if (!r.ok) throw new Error(r.reason);
    return r.day;
  }, day);
}
const fresh = () =>
  newDay({ id: "d1", title: "Powder Friday", now: NOW, host });
const crew = () => run(fresh(), { type: "addPerson", person: ben });

describe("challenge safety", () => {
  it("never rewards speed, risk or rule-breaking in any catalogue entry", () => {
    for (const c of CHALLENGES) {
      expect(checkChallengeText(c.title), c.id).toEqual({ ok: true });
      expect(checkChallengeText(c.detail.slice(0, 89)), c.id).toEqual({
        ok: true,
      });
      expect(c.safety.length, c.id).toBeGreaterThan(20);
    }
  });
  it.each([
    "Fastest run of the day",
    "Hit the biggest jump",
    "Ride off-piste to the cliff",
    "Beat my speed record",
    "Do shots at the lodge",
    "Ignore the closed trail sign",
    "Send it down the steepest line",
  ])("refuses crew-written %s", (text) => {
    expect(checkChallengeText(text).ok).toBe(false);
  });
  it("accepts a harmless one", () => {
    expect(checkChallengeText("Matching toques at lunch").ok).toBe(true);
  });
  it("offers a first-timer only lesson-sized runs", () => {
    const ids = offeredTo("first-timer").map((c) => c.id);
    expect(ids).toContain("first-turns");
    expect(ids).not.toContain("new-trail");
    expect(ids).not.toContain("chosen-run");
  });
  it("has no challenge that scores on speed, distance or difficulty", () => {
    const text = CHALLENGES.map((c) => `${c.title} ${c.detail}`).join(" ");
    expect(text).not.toMatch(/\b(fastest|speed|vertical|black diamond|steep)/i);
  });
});

describe("ability", () => {
  it("rides at the most careful member's level", () => {
    expect(groupCeiling([host, ben])).toBe("beginner");
    expect(groupLine([host, ben])).toMatch(/beginner level.*green circle/);
  });
  it("ignores après-only guests", () => {
    expect(groupCeiling([host, { ...ben, discipline: "apres" }])).toBe(
      "advanced",
    );
    expect(groupCeiling([{ ...ben, discipline: "apres" }])).toBeUndefined();
  });
});

describe("planning and voting", () => {
  const propose = (
    day: SnowDay,
    id: string,
    label: string,
    topic: "mountain" | "meeting" | "date",
    by = "a",
  ) => run(day, { type: "propose", proposal: { id, topic, label, by } });

  it("one vote per person per topic moves when they change their mind", () => {
    let d = propose(
      propose(crew(), "m1", "Cypress", "mountain"),
      "m2",
      "Seymour",
      "mountain",
    );
    d = run(
      d,
      { type: "vote", proposalId: "m1", personId: "a", on: true },
      { type: "vote", proposalId: "m1", personId: "b", on: true },
    );
    expect(leading(d, "mountain")?.id).toBe("m1");
    d = run(d, { type: "vote", proposalId: "m2", personId: "b", on: true });
    expect(d.votes.m1).toEqual(["a"]);
    expect(d.votes.m2).toEqual(["b"]);
  });
  it("lists a topic as undecided until someone locks it, then announces a later change once", () => {
    let d = propose(
      propose(crew(), "m1", "Cypress", "meeting"),
      "m2",
      "Lodge deck",
      "meeting",
    );
    expect(undecided(d)).toEqual(["meeting"]);
    d = run(d, {
      type: "choose",
      topic: "meeting",
      proposalId: "m1",
      by: "a",
      changeId: "c1",
    });
    expect(undecided(d)).toEqual([]);
    expect(d.announcements).toHaveLength(0);
    d = run(d, {
      type: "choose",
      topic: "meeting",
      proposalId: "m2",
      by: "a",
      changeId: "c2",
    });
    expect(d.announcements[0]).toMatchObject({
      kind: "change",
      text: "Meeting points changed to Lodge deck.",
    });
  });
  it("choosing a date sets the day's date; withdrawing it unsets the choice", () => {
    let d = propose(crew(), "d1", "2026-12-27", "date");
    d = run(d, {
      type: "choose",
      topic: "date",
      proposalId: "d1",
      by: "a",
      changeId: "c",
    });
    expect(d.date).toBe("2026-12-27");
    d = run(d, { type: "withdraw", id: "d1" });
    expect(d.chosen.date).toBeUndefined();
  });
  it("refuses nonsense in words", () => {
    expect(
      applyAction(crew(), { type: "when", date: "2026-02-31" }, NOW),
    ).toMatchObject({ ok: false });
    expect(
      applyAction(crew(), { type: "addPerson", person: ben }, NOW),
    ).toMatchObject({ ok: false });
    expect(
      applyAction(
        crew(),
        {
          type: "propose",
          proposal: { id: "x", topic: "date", label: "soon", by: "a" },
        },
        NOW,
      ),
    ).toMatchObject({ ok: false });
    expect(
      applyAction(crew(), { type: "removePerson", id: "a" }, NOW),
    ).toMatchObject({ ok: false });
  });
  it("removing a person takes their votes, points and check-ins with them", () => {
    let d = propose(crew(), "m1", "Cypress", "mountain");
    d = run(
      d,
      { type: "vote", proposalId: "m1", personId: "b", on: true },
      { type: "complete", challengeId: "group-photo", personId: "b" },
      { type: "checkIn", personId: "b", spot: "Lodge" },
    );
    d = run(d, { type: "removePerson", id: "b" });
    expect(d.votes.m1).toEqual([]);
    expect(d.completions).toEqual([]);
    expect(d.checkIns).toEqual([]);
  });
});

describe("competition", () => {
  it("scores safe challenges, shows up, photos (capped) and shares ties", () => {
    let d = crew();
    d = run(
      d,
      { type: "complete", challengeId: "group-photo", personId: "a" },
      { type: "complete", challengeId: "group-photo", personId: "b" },
    );
    const s = standings(d);
    expect(s.map((r) => [r.person.name, r.points, r.rank])).toEqual([
      ["Ana", 20, 1],
      ["Ben", 20, 1],
    ]);
    for (let i = 0; i < 5; i++)
      d = run(d, {
        type: "photo",
        photo: {
          id: `p${i}`,
          personId: "a",
          caption: "",
          src: "data:image/png;base64,AA",
          at: NOW,
        },
      });
    expect(standings(d)[0].points).toBe(20 + 9); // photo points capped at 3 photos
  });
  it("ignores unknown challenges and respects the off switch", () => {
    expect(
      applyAction(
        crew(),
        { type: "complete", challengeId: "fastest-run", personId: "a" },
        NOW,
      ),
    ).toMatchObject({ ok: false });
    const off = run(crew(), { type: "challenges", on: false });
    expect(
      applyAction(
        off,
        { type: "complete", challengeId: "group-photo", personId: "a" },
        NOW,
      ),
    ).toMatchObject({ ok: false });
  });
  it("completing twice counts once", () => {
    const a: Action = {
      type: "complete",
      challengeId: "viewpoint",
      personId: "a",
    };
    expect(run(crew(), a, a).completions).toHaveLength(1);
  });
  it("gives awards only to people who earned them", () => {
    expect(awards(crew())).toEqual([]);
    const d = run(
      crew(),
      { type: "complete", challengeId: "apres-cocoa", personId: "b" },
      {
        type: "moment",
        moment: {
          id: "m",
          personId: "a",
          text: "Ben's face on the chair",
          at: NOW,
        },
      },
    );
    const titles = awards(d).map((a) => a.title);
    expect(titles).toContain("Après MVP");
    expect(titles).toContain("Chief Hype Officer");
    expect(titles).not.toContain("Paparazzi");
  });
  it("accepts a safe crew challenge and refuses an unsafe one", () => {
    const ok = applyAction(
      crew(),
      {
        type: "customChallenge",
        id: "c1",
        title: "Best hat at lunch",
        by: "a",
      },
      NOW,
    );
    expect(ok.ok).toBe(true);
    expect(
      applyAction(
        crew(),
        {
          type: "customChallenge",
          id: "c2",
          title: "Fastest run wins",
          by: "a",
        },
        NOW,
      ),
    ).toMatchObject({ ok: false });
  });
});

describe("prep", () => {
  it("knows the phase of the journey", () => {
    expect(phaseOf(undefined, "2026-12-01")).toBe("planning");
    expect(phaseOf("2026-12-20", "2026-12-01")).toBe("planning");
    expect(phaseOf("2026-12-05", "2026-12-01")).toBe("soon");
    expect(phaseOf("2026-12-01", "2026-12-01")).toBe("day");
    expect(phaseOf("2026-11-30", "2026-12-01")).toBe("after");
  });
  it("reminds about rentals a week out and about the resort's own report on the day", () => {
    const d = crew();
    expect(reminders(d, 9).map((r) => r.id)).toContain("rentals");
    expect(reminders(d, 9).map((r) => r.id)).toContain("lesson");
    const dayOf = reminders(d, 0);
    expect(dayOf.map((r) => r.id)).toContain("conditions");
    expect(dayOf.find((r) => r.id === "conditions")?.text).toMatch(
      /Passport doesn't know/,
    );
  });
  it("gear follows what each person rides", () => {
    expect(gearFor(host).map((g) => g.id)).toContain("skis");
    expect(gearFor(host).map((g) => g.id)).not.toContain("board");
    expect(
      gearFor({ ...ben, discipline: "apres" }).map((g) => g.id),
    ).not.toContain("helmet");
  });
  it("counts down to the meeting time", () => {
    const d = run(crew(), {
      type: "when",
      date: "2026-12-21",
      meetTime: "07:30",
    });
    const c = countdownToDay(new Date("2026-12-20T07:30:00"), d);
    expect([c?.days, c?.hours]).toEqual([1, 0]);
  });
});

describe("mountains", () => {
  it("sorts nearest first from an origin and never carries live facts", () => {
    const rows = findMountains(MOUNTAINS, {
      from: { latitude: 49.2827, longitude: -123.1207 },
    });
    expect(rows[0].id).toBe("grouse");
    expect(Object.keys(MOUNTAINS[0]).sort()).toEqual([
      "id",
      "latitude",
      "longitude",
      "name",
      "region",
      "site",
    ]);
  });
  it("filters by distance and name", () => {
    const from = { latitude: 49.2827, longitude: -123.1207 };
    expect(
      findMountains(MOUNTAINS, { from, withinKm: 40 }).map((m) => m.id),
    ).toEqual(expect.arrayContaining(["cypress", "grouse", "seymour"]));
    expect(findMountains(MOUNTAINS, { query: "whistler" })).toHaveLength(1);
  });
});

describe("recap and sharing", () => {
  it("is honest when nothing was recorded", () => {
    const r = buildRecap(crew());
    expect(r.empty).toBe(true);
    expect(r.standings).toEqual([]);
    expect(recapText(crew())).toMatch(/Next up: the same again\?/);
  });
  it("tells the day from what the crew recorded", () => {
    let d = run(
      crew(),
      { type: "complete", challengeId: "group-photo", personId: "a" },
      {
        type: "moment",
        moment: { id: "m", personId: "b", text: "Ben met a tree", at: NOW },
      },
      { type: "idea", id: "i", text: "Whistler in January", by: "a" },
    );
    const text = recapText(d);
    expect(text).toContain("Standings");
    expect(text).toContain("Ben met a tree");
    expect(text).toContain("Next up: Whistler in January");
    d = run(d, { type: "voteIdea", id: "i", personId: "a", on: true });
    expect(buildRecap(d).ideas[0].votes).toEqual(["a"]);
  });
  it("round-trips a plan through the link fragment, without photos", () => {
    const d = run(
      crew(),
      {
        type: "photo",
        photo: {
          id: "p",
          personId: "a",
          caption: "",
          src: "data:image/png;base64,AA",
          at: NOW,
        },
      },
      { type: "announce", id: "n", by: "a", text: "Meet 8:30 — café ☕" },
    );
    const back = parseDay(readFragment(shareFragment(d)));
    expect(back?.title).toBe("Powder Friday");
    expect(back?.announcements[0].text).toBe("Meet 8:30 — café ☕");
    expect(back?.photos).toEqual([]);
  });
  it("rejects garbage and non-image photo sources", () => {
    expect(parseDay(null)).toBeNull();
    expect(parseDay({ v: 2 })).toBeNull();
    expect(readFragment("%%%")).toBeNull();
    const bad = {
      ...crew(),
      photos: [
        {
          id: "x",
          personId: "a",
          caption: "",
          src: "javascript:alert(1)",
          at: NOW,
        },
      ],
    };
    expect(parseDay(bad)?.photos).toEqual([]);
  });
});

describe("predictions", () => {
  const withCall = () =>
    run(crew(), {
      type: "predict",
      id: "p1",
      text: "We take a group photo at the top.",
      by: "a",
    });

  it("takes a call, refuses unsafe or duplicate ones", () => {
    const d = withCall();
    expect(d.predictions).toHaveLength(1);
    const unsafe = applyAction(
      d,
      { type: "predict", id: "p2", text: "Who goes fastest down", by: "a" },
      NOW,
    );
    expect(unsafe.ok).toBe(false);
    const dup = applyAction(
      d,
      {
        type: "predict",
        id: "p3",
        text: "we take a group photo at the top.",
        by: "b",
      },
      NOW,
    );
    expect(dup.ok).toBe(false);
    const stranger = applyAction(
      d,
      {
        type: "predict",
        id: "p4",
        text: "Hot chocolate before noon",
        by: "zzz",
      },
      NOW,
    );
    expect(stranger.ok).toBe(false);
  });

  it("scores only settled calls, derived from guesses", () => {
    let d = withCall();
    d = run(
      d,
      { type: "guess", id: "p1", personId: "a", says: true },
      { type: "guess", id: "p1", personId: "b", says: false },
    );
    const before = standings(d);
    expect(before.every((s) => s.points === 0)).toBe(true); // open: no points
    d = run(d, { type: "settle", id: "p1", outcome: true });
    const after = Object.fromEntries(
      standings(d).map((s) => [s.person.id, s.points]),
    );
    expect(after.a).toBe(3);
    expect(after.b).toBe(0);
    expect(
      awards(d)
        .find((a) => a.id === "called-it")
        ?.winners.map((p) => p.id),
    ).toEqual(["a"]);
    // Reopening takes the points back; settled calls can't be re-guessed.
    expect(
      applyAction(
        d,
        { type: "guess", id: "p1", personId: "b", says: true },
        NOW,
      ).ok,
    ).toBe(false);
    d = run(d, { type: "settle", id: "p1", outcome: null });
    expect(standings(d).every((s) => s.points === 0)).toBe(true);
  });

  it("shows in the recap and survives parsing", () => {
    let d = withCall();
    d = run(d, { type: "settle", id: "p1", outcome: false });
    expect(buildRecap(d).predictions).toEqual([
      { text: "We take a group photo at the top.", happened: false },
    ]);
    expect(recapText(d)).toContain("❌ We take a group photo at the top.");
    expect(parseDay(JSON.parse(JSON.stringify(d)))?.predictions).toHaveLength(
      1,
    );
    // Older saved days with no predictions still load.
    expect(parseDay({ ...d, predictions: undefined })?.predictions).toEqual([]);
  });
});
