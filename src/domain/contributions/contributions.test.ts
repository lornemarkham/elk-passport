import { describe, expect, it } from "vitest";
import {
  EMPTY,
  atlasCopy,
  contributorView,
  reviewView,
  type SuggestionsDoc,
} from "./model";
import {
  approve,
  countFor,
  decline,
  editSuggestion,
  lookalike,
  parseEdits,
  parseSubmission,
  parseWebsite,
  setAtlas,
  submit,
} from "./actions";
import { BURST, HOURLY, MAX_WAITING, coolingOff, pace } from "./guard";
import { MILESTONES, progress, reachedBy, thanks } from "./milestones";

const NOW = new Date("2026-12-05T02:00:00Z");
const later = (s: number) => new Date(NOW.getTime() + s * 1000);
const ADMIN = "lorne@example.test";

const sub = (over: Record<string, unknown> = {}) =>
  parseSubmission({
    experience: "christmas",
    category: "restaurant",
    name: "Long John's Pub",
    location: "SilverStar Mountain Resort, village centre",
    town: "SilverStar",
    description: "Live music on Fridays through December",
    when: "Fridays 7–10 pm",
    website: "longjohnspub.example",
    ...over,
  });

describe("Reading a suggestion from a phone", () => {
  it("needs only a name, a category and a location", () => {
    const s = parseSubmission({
      experience: "snow",
      category: "market",
      name: "Lumby Christmas Market",
      location: "Lumby Community Hall",
    });
    expect(s).toMatchObject({
      experience: "snow",
      category: "market",
      name: "Lumby Christmas Market",
      location: { text: "Lumby Community Hall" },
    });
    expect(s.website).toBeUndefined();
  });

  it("refuses a missing name, category or location in words", () => {
    expect(() => sub({ name: "" })).toThrow(/name/);
    expect(() => sub({ category: "zoo" })).toThrow(/kind/);
    expect(() => sub({ location: "", lat: undefined, lng: undefined })).toThrow(
      /where/,
    );
  });

  it("accepts a device position as the location, rounded to a metre", () => {
    const s = parseSubmission({
      experience: "gohaveaday",
      category: "place",
      name: "Hidden beach",
      lat: 50.26012345,
      lng: -119.27098765,
    });
    expect(s.location).toEqual({
      text: "At my location",
      lat: 50.26012,
      lng: -119.27099,
    });
  });

  it("captures the experience it came from and keeps an unknown slug rather than a list", () => {
    expect(sub({ experience: "hockey" }).experience).toBe("hockey");
    expect(sub({ experience: "fishing-derby" }).experience).toBe(
      "fishing-derby",
    );
    expect(sub({ experience: "NOT A SLUG!" }).experience).toBe("gohaveaday");
  });

  it("tidies a website address and refuses one that isn't", () => {
    expect(parseWebsite("longjohnspub.example")).toBe(
      "https://longjohnspub.example/",
    );
    expect(parseWebsite("http://x.example/events?x=1")).toBe(
      "http://x.example/events?x=1",
    );
    expect(parseWebsite("")).toBeUndefined();
    expect(() => parseWebsite("not a website")).toThrow(/website/);
    expect(() => parseWebsite("ftp://x.example")).toThrow(/http/);
  });

  it("asks that links go in the website box when the words are full of them", () => {
    expect(() =>
      sub({ description: "see http://a.example and www.b.example" }),
    ).toThrow(/website box/);
    // One mention in passing is fine: people write "on their website www…".
    expect(() =>
      sub({ description: "details at www.b.example" }),
    ).not.toThrow();
  });
});

describe("Twenty-five legitimate suggestions in one session", () => {
  it("all go in: there is no daily cap", () => {
    let doc: SuggestionsDoc = EMPTY;
    for (let i = 0; i < 25; i++)
      doc = submit(
        doc,
        sub({ name: `Stop ${i}`, location: `${i} Main Street, Vernon` }),
        "anon_lorne",
        `s${i}`,
        later(i * 30),
      ).doc;
    expect(countFor(doc, ["anon_lorne"])).toEqual({ approved: 0, pending: 25 });
  });

  it("asks a burst to pause for a minute, never for a day", () => {
    let doc: SuggestionsDoc = EMPTY;
    for (let i = 0; i < BURST.max; i++)
      doc = submit(
        doc,
        sub({ name: `Stop ${i}`, location: `${i} Main Street` }),
        "anon_fast",
        `f${i}`,
        later(i),
      ).doc;
    let refused: { status: number; retry?: number; message: string } | null =
      null;
    try {
      submit(doc, sub({ name: "One more" }), "anon_fast", "f99", later(13));
    } catch (e) {
      const r = e as {
        status: number;
        retryAfterSeconds?: number;
        message: string;
      };
      refused = {
        status: r.status,
        retry: r.retryAfterSeconds,
        message: r.message,
      };
    }
    expect(refused?.status).toBe(429);
    expect(refused?.message).toMatch(/minute/);
    expect(refused?.message).not.toMatch(/tomorrow/);
    expect(refused?.retry).toBeGreaterThan(0);
    expect(refused?.retry).toBeLessThanOrEqual(60);
    // Someone else is unaffected; the same person is fine a minute later.
    expect(() =>
      submit(doc, sub({ name: "Theirs" }), "anon_other", "o1", later(13)),
    ).not.toThrow();
    expect(() =>
      submit(doc, sub({ name: "One more" }), "anon_fast", "f99", later(61)),
    ).not.toThrow();
  });

  it("the pace rule alone: twelve a minute and sixty an hour, with a retry time", () => {
    const times = Array.from({ length: HOURLY.max }, (_, i) =>
      later(i * 50).toISOString(),
    );
    const p = pace(times, later(HOURLY.max * 50));
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.retryAfterSeconds).toBeGreaterThan(0);
    expect(pace(times, later(HOURLY.max * 50 + 3600)).ok).toBe(true);
    expect(pace([], NOW).ok).toBe(true);
  });

  it("a double tap is one suggestion: the same person's repeat returns the one waiting", () => {
    const first = submit(EMPTY, sub(), "anon_a", "s1", NOW);
    const again = submit(first.doc, sub(), "anon_a", "s2", later(5));
    expect(again.repeat).toBe(true);
    expect(again.suggestion.id).toBe("s1");
    expect(again.doc.suggestions).toHaveLength(1);
  });

  it("flags a lookalike for the reviewer without refusing it", () => {
    const first = submit(EMPTY, sub(), "anon_a", "s1", NOW);
    const other = submit(
      first.doc,
      sub({ name: "Long Johns Pub!", location: "The village, SilverStar" }),
      "anon_b",
      "s2",
      later(5),
    );
    expect(other.repeat).toBe(false);
    expect(other.suggestion.duplicateOf).toBe("s1");
    expect(
      lookalike(first.doc, sub({ name: "Totally different" })),
    ).toBeUndefined();
    // A pin dropped on top of another, named differently, is a lookalike too.
    const placed = submit(
      EMPTY,
      sub({ name: "Aa", lat: 50.26, lng: -119.27, town: undefined }),
      "anon_a",
      "p1",
      NOW,
    );
    expect(
      lookalike(
        placed.doc,
        sub({ name: "Bb", lat: 50.26001, lng: -119.27001, town: undefined }),
      )?.id,
    ).toBe("p1");
  });

  it("cools off a contributor whose recent suggestions were declined as spam, for a day", () => {
    let doc: SuggestionsDoc = EMPTY;
    for (let i = 0; i < 3; i++) {
      doc = submit(
        doc,
        sub({ name: `Junk ${i}` }),
        "anon_s",
        `j${i}`,
        later(i * 30),
      ).doc;
      doc = decline(doc, `j${i}`, ADMIN, "spam", later(100));
    }
    expect(() =>
      submit(doc, sub({ name: "More" }), "anon_s", "j9", later(200)),
    ).toThrow(/paused/);
    expect(() =>
      submit(
        doc,
        sub({ name: "More" }),
        "anon_s",
        "j9",
        later(100 + 25 * 3600),
      ),
    ).not.toThrow();
    // Declined as a duplicate or "not a fit" is not a strike.
    let fair: SuggestionsDoc = EMPTY;
    for (let i = 0; i < 3; i++) {
      fair = submit(
        fair,
        sub({ name: `Dup ${i}` }),
        "anon_d",
        `d${i}`,
        later(i * 30),
      ).doc;
      fair = decline(fair, `d${i}`, ADMIN, "duplicate", later(100));
    }
    expect(() =>
      submit(fair, sub({ name: "More" }), "anon_d", "d9", later(200)),
    ).not.toThrow();
    expect(
      coolingOff(
        [
          { at: NOW.toISOString(), spam: true },
          { at: NOW.toISOString(), spam: true },
        ],
        later(1),
      ),
    ).toBe(false);
  });

  it("stops at a flood: the queue holds only so many", () => {
    let doc: SuggestionsDoc = EMPTY;
    for (let i = 0; i < MAX_WAITING; i++)
      doc = submit(
        doc,
        sub({ name: `Thing ${i}`, location: `${i} Somewhere` }),
        `anon_${i}`,
        `t${i}`,
        NOW,
      ).doc;
    expect(() =>
      submit(doc, sub({ name: "Late" }), "anon_late", "late", NOW),
    ).toThrow(/waiting for review/);
  });
});

describe("Review", () => {
  const waiting = () => submit(EMPTY, sub(), "anon_a", "s1", NOW).doc;

  it("approve, decline with a reason, and edit are kept on the trail", () => {
    const ok = approve(waiting(), "s1", ADMIN, later(60));
    expect(ok.suggestions[0]!.status).toBe("approved");
    const no = decline(
      waiting(),
      "s1",
      ADMIN,
      "not-right",
      later(60),
      "a chain",
    );
    expect(no.suggestions[0]).toMatchObject({
      status: "declined",
      declineReason: "not-right",
    });
    expect(no.suggestions[0]!.trail.at(-1)?.text).toBe("not-right: a chain");
    const fixed = editSuggestion(
      waiting(),
      "s1",
      ADMIN,
      parseEdits({
        name: "Long John's Pub & Grill",
        when: "",
        town: "Silver Star",
      }),
      later(60),
    );
    expect(fixed.suggestions[0]).toMatchObject({
      name: "Long John's Pub & Grill",
      location: {
        town: "Silver Star",
        text: "SilverStar Mountain Resort, village centre",
      },
    });
    expect(fixed.suggestions[0]!.when).toBeUndefined();
    expect(fixed.suggestions[0]!.trail.at(-1)?.text).toBe(
      "edited: name, town, when",
    );
  });

  it("the Atlas handoff is recorded on the suggestion", () => {
    const doc = setAtlas(approve(waiting(), "s1", ADMIN, NOW), "s1", ADMIN, {
      state: "queued",
      at: later(5).toISOString(),
      candidateId: "cand-1",
    });
    expect(doc.suggestions[0]!.atlas?.state).toBe("queued");
    expect(doc.suggestions[0]!.trail.at(-1)?.kind).toBe("atlas");
  });

  it("the copy for Atlas carries every fact and the provenance, never the contributor", () => {
    const { text, json } = atlasCopy(waiting().suggestions[0]!);
    expect(text).toContain("Name: Long John's Pub");
    expect(text).toContain("Category: Restaurant or café");
    // The town is not repeated when the words already say it.
    expect(text).toContain(
      "Location: SilverStar Mountain Resort, village centre\n",
    );
    expect(
      atlasCopy({
        ...waiting().suggestions[0]!,
        location: { text: "The village", town: "SilverStar" },
      }).text,
    ).toContain("Location: The village, SilverStar");
    expect(text).toContain("When: Fridays 7–10 pm");
    expect(text).toContain("Website: https://longjohnspub.example/");
    expect(text).toContain(
      "Source: community suggestion via Passport Christmas",
    );
    expect(text).not.toContain("anon_a");
    expect(json).not.toContain("anon_a");
    expect(json).not.toContain("trail");
  });

  it("neither view published to anyone carries the contributor's key", () => {
    const doc = waiting();
    const s = doc.suggestions[0]!;
    expect(JSON.stringify(contributorView(s))).not.toContain("anon_a");
    const r = reviewView(doc, s);
    expect(JSON.stringify(r)).not.toContain("anon_a");
    expect(r.contributorPending).toBe(1);
  });
});

describe("Milestones count approved contributions only", () => {
  it("the five titles at 1, 5, 10, 25 and 50", () => {
    expect(MILESTONES.map((m) => [m.at, m.title])).toEqual([
      [1, "First Discovery"],
      [5, "Local Explorer"],
      [10, "Community Scout"],
      [25, "Discovery Champion"],
      [50, "Local Legend"],
    ]);
  });

  it("pending and declined suggestions earn nothing; an approval moves the count", () => {
    let doc: SuggestionsDoc = EMPTY;
    for (let i = 0; i < 6; i++)
      doc = submit(
        doc,
        sub({ name: `S ${i}`, location: `${i} St` }),
        "anon_a",
        `s${i}`,
        later(i * 30),
      ).doc;
    expect(
      progress(
        ...(Object.values(countFor(doc, ["anon_a"])) as [number, number]),
      ).earned,
    ).toEqual([]);
    for (let i = 0; i < 5; i++) doc = approve(doc, `s${i}`, ADMIN, later(500));
    doc = decline(doc, "s5", ADMIN, "duplicate", later(500));
    const c = countFor(doc, ["anon_a"]);
    expect(c).toEqual({ approved: 5, pending: 0 });
    const p = progress(c.approved, c.pending);
    expect(p.current?.title).toBe("Local Explorer");
    expect(p.next).toEqual({ milestone: MILESTONES[2], remaining: 5 });
    expect(reachedBy(4, 5)?.title).toBe("Local Explorer");
    expect(reachedBy(5, 6)).toBeUndefined();
  });

  it("counts across keys, so one person's suggestions from several experiences add up", () => {
    let doc: SuggestionsDoc = EMPTY;
    doc = submit(
      doc,
      sub({ experience: "christmas", name: "Aa" }),
      "anon_a",
      "a",
      NOW,
    ).doc;
    doc = submit(
      doc,
      sub({ experience: "hockey", name: "Bb" }),
      "v_signed",
      "b",
      later(1),
    ).doc;
    doc = approve(approve(doc, "a", ADMIN, NOW), "b", ADMIN, NOW);
    expect(countFor(doc, ["anon_a", "v_signed"]).approved).toBe(2);
  });

  it("says thanks at once and is honest that the suggestion is pending", () => {
    expect(thanks(progress(0, 1))).toMatch(/in for review/);
    expect(thanks(progress(0, 1))).toMatch(/First Discovery/);
    expect(thanks(progress(3, 1))).toMatch(
      /2 more to 🔭 Community Scout|2 more to/,
    );
    expect(thanks(progress(50, 0))).toMatch(/Local Legend/);
  });
});
