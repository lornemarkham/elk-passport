import { describe, expect, it } from "vitest";
import { draftFrom, mergeReading, statedDates } from "./extract";
import {
  blockers,
  duplicatesOf,
  EMPTY_NETWORK,
  leadTimeDays,
  leadTimeReport,
  matchesSaid,
  published,
  publicView,
  whenOf,
  watchList,
  type Listing,
  type Network,
} from "./model";
import {
  decide,
  edit,
  flag,
  invite,
  queue,
  Refused,
  submit,
  withSeed,
  type Actor,
} from "./review";
import { SEED } from "./seed";

const NOW = new Date("2026-11-09T21:00:00Z");
const visitor: Actor = { role: "visitor", who: "visitor" };
const admin: Actor = { role: "admin", who: "lorne@example.com" };
const amb = {
  email: "jess@example.com",
  name: "Jess",
  area: "Vernon",
  trusted: false,
  invitedBy: "lorne@example.com",
  invitedAt: NOW.toISOString(),
  active: true,
};
const ambassador: Actor = {
  role: "ambassador",
  who: amb.email,
  ambassador: amb,
};
const trusted: Actor = {
  role: "ambassador",
  who: amb.email,
  ambassador: { ...amb, trusted: true },
};

const POSTER =
  "Spring Hare Scramble at Becker Lake, Lumby — hosted by the Vernon Off Road Motorcycle Club. May 16-17. Register at zone4.ca/vormc. Info vormc.com";

describe("reading a submission", () => {
  it("copies what the text states into fields", () => {
    const d = draftFrom(POSTER, NOW);
    expect(d.kind).toBe("event");
    expect(d.title).toBe("Spring Hare Scramble at Becker Lake, Lumby");
    expect(d.town).toBe("Lumby");
    expect(d.organizer).toBe("Vernon Off Road Motorcycle Club");
    expect(d.interests).toContain("dirt biking");
    expect(d.starts).toBe("2027-05-16");
    expect(d.ends).toBe("2027-05-17");
    expect(d.registrationUrl).toBe("https://zone4.ca/vormc");
    expect(d.organizerUrl).toBe("https://vormc.com");
  });

  it("invents no date: vague words are not dates", () => {
    expect(
      statedDates("Every spring, usually the May long weekend", NOW),
    ).toEqual([]);
    expect(
      draftFrom("Jam at the Longhorn, last Sunday of the month", NOW).starts,
    ).toBeUndefined();
  });

  it("reads a recurring club as a club with a schedule, not a dated event", () => {
    const d = draftFrom(
      "Drop-in badminton club, Mondays 7-9pm at Coldstream Elementary, Coldstream",
      NOW,
    );
    expect(d.kind).toBe("club");
    expect(d.schedule).toMatch(/Mondays 7-9pm/i);
    expect(d.interests).toEqual(["badminton"]);
  });

  it("throws away an AI's value that the text does not contain", () => {
    const text = "Night race for dirt bikes in Vernon, everybody welcome";
    const merged = mergeReading(
      draftFrom(text, NOW),
      {
        starts: "2027-06-12",
        organizer: "Premier Off-Road Club",
        organizerUrl: "https://porc.ca",
        kind: "event",
      },
      text,
    );
    expect(merged.starts).toBeUndefined();
    expect(merged.organizer).toBeUndefined();
    expect(merged.organizerUrl).toBeUndefined();
    expect(merged.kind).toBe("event");
  });
});

function submitted(
  input: Parameters<typeof submit>[1],
  who: Actor = visitor,
  n: Network = EMPTY_NETWORK,
) {
  return submit(n, input, who, NOW, "ab");
}

const pigInput = {
  ...draftFrom(POSTER, NOW),
  provenance: "Poster at the Lumby gas station",
};

describe("review", () => {
  it("a visitor's submission waits in the queue", () => {
    const r = submitted(pigInput);
    expect(r.listing.status).toBe("submitted");
    expect(r.published).toBe(false);
    expect(queue(r.network).map((l) => l.id)).toEqual([r.listing.id]);
    expect(published(r.network, NOW)).toEqual([]);
  });

  it("refuses to publish an unchecked date or registration link, saying which", () => {
    const r = submitted(pigInput);
    expect(blockers(r.listing)).toEqual([
      "Check the date against a source, or remove it.",
      "Check the registration link, or remove it.",
    ]);
    expect(() =>
      decide(r.network, r.listing.id, "publish", admin, NOW),
    ).toThrow(Refused);
  });

  it("publishes once a person checked the date against a page", () => {
    const r = submitted(pigInput);
    const e = edit(
      r.network,
      r.listing.id,
      {
        dateSource: "https://vormc.com/events",
        dateChecked: true,
        registrationChecked: true,
        verification: "source-checked",
      },
      admin,
      NOW,
    );
    expect(e.listing.dates?.verifiedAt).toBe(NOW.toISOString());
    expect(e.listing.lastVerifiedAt).toBe(NOW.toISOString());
    const d = decide(e.network, r.listing.id, "publish", admin, NOW);
    const shown = published(d.network, NOW);
    expect(shown).toHaveLength(1);
    expect(shown[0]!.when).toEqual({
      state: "upcoming",
      starts: "2027-05-16",
      ends: "2027-05-17",
      source: "https://vormc.com/events",
    });
    expect(shown[0]!.registrationUrl).toBe("https://zone4.ca/vormc");
    // and the success metric: heard of it 187 days before race day
    expect(leadTimeDays(d.listing)).toBe(187);
    expect(leadTimeReport(d.network)[0]!.days).toBe(187);
  });

  it("changing a checked date un-checks it", () => {
    const r = submitted(pigInput);
    const e = edit(
      r.network,
      r.listing.id,
      { dateSource: "https://vormc.com/events", dateChecked: true },
      admin,
      NOW,
    );
    const moved = edit(
      e.network,
      r.listing.id,
      { starts: "2027-05-23" },
      admin,
      NOW,
    );
    expect(moved.listing.dates?.verifiedAt).toBeUndefined();
  });

  it("an untrusted ambassador cannot review; needs-info and decline need a reason", () => {
    const r = submitted(pigInput);
    expect(() =>
      decide(r.network, r.listing.id, "decline", ambassador, NOW, "dup"),
    ).toThrow(/reviewer/);
    expect(() =>
      decide(r.network, r.listing.id, "decline", admin, NOW),
    ).toThrow(/Say why/);
    expect(
      decide(
        r.network,
        r.listing.id,
        "needs-info",
        admin,
        NOW,
        "Which weekend?",
      ).listing.status,
    ).toBe("needs-info");
  });

  it("a trusted ambassador's complete listing is published straight away; an incomplete one waits", () => {
    const complete = submitted(
      {
        kind: "club",
        title: "Vernon Ukulele Circle",
        town: "Vernon",
        interests: ["music"],
        organizerUrl: "https://example.org/uke",
        provenance: "I play there",
      },
      trusted,
    );
    expect(complete.published).toBe(true);
    expect(complete.listing.status).toBe("published");
    const dated = submitted(pigInput, trusted);
    expect(dated.published).toBe(false);
  });

  it("a members-only activity needs the organizer's permission recorded first", () => {
    const r = submitted(
      {
        kind: "club",
        title: "Private Riders",
        town: "Vernon",
        interests: ["motorcycles"],
        organizerUrl: "https://example.org/r",
        provenance: "a member",
        access: "members",
      },
      admin,
    );
    expect(r.listing.status).toBe("submitted");
    expect(blockers(r.listing)).toContain(
      "This is members-only or private: record the organizer's permission first.",
    );
    const ok = edit(
      r.network,
      r.listing.id,
      { permissionBy: "Club president, by phone" },
      admin,
      NOW,
    );
    expect(blockers(ok.listing)).toEqual([]);
  });

  it("a second submission of the same thing joins the first instead of duplicating it", () => {
    const first = submitted(pigInput);
    const again = submitted(
      {
        title: "Spring hare scramble",
        town: "Somewhere",
        organizerUrl: "http://www.vormc.com/",
      },
      visitor,
      first.network,
    );
    expect(again.duplicateOf).toBe(first.listing.id);
    expect(again.network.listings).toHaveLength(1);
    expect(again.listing.notes.at(-1)!.kind).toBe("correction");
    expect(
      duplicatesOf(
        { title: "The Squealing Pig", place: { town: "Vernon" } },
        SEED,
      ).map((l) => l.id),
    ).toEqual(["squealing-pig"]);
  });

  it("a report on a published listing puts it back in front of a reviewer, changing no fact", () => {
    const n = withSeed(EMPTY_NETWORK, SEED);
    const r = flag(
      n,
      "vernon-jazz-jam",
      "report",
      "They moved to the second Wednesday",
      "visitor",
      NOW,
    );
    expect(r.listing.status).toBe("published");
    expect(r.listing.schedule).toBe(
      n.listings.find((l) => l.id === "vernon-jazz-jam")!.schedule,
    );
    expect(queue(r.network).map((l) => l.id)).toContain("vernon-jazz-jam");
    const claimed = flag(
      r.network,
      "night-pig",
      "claim",
      "I run this race — call 250 555 0100",
      "visitor",
      NOW,
    );
    expect(queue(claimed.network).map((l) => l.id)).toContain("night-pig");
  });

  it("only an administrator invites ambassadors", () => {
    expect(() =>
      invite(EMPTY_NETWORK, { email: "a@b.ca", name: "A" }, ambassador, NOW),
    ).toThrow(/administrator/);
    const n = invite(
      EMPTY_NETWORK,
      { email: "Jess@Example.com", name: "Jess", trusted: true },
      admin,
      NOW,
    );
    expect(n.ambassadors[0]).toMatchObject({
      email: "jess@example.com",
      trusted: true,
      area: "North Okanagan",
    });
  });
});

describe("what the public sees", () => {
  it("a past event is past, never upcoming, until a new date is checked", () => {
    const pig = SEED.find((l) => l.id === "squealing-pig")!;
    expect(whenOf(pig, NOW)).toEqual({
      state: "past",
      last: "2026-10-10",
      source: "https://www.moto-tally.com/BCORCS/Results.aspx",
    });
  });

  it("an unchecked date is never shown", () => {
    const l: Listing = {
      ...SEED[0]!,
      dates: { starts: "2027-05-15" },
      history: [],
    };
    expect(whenOf(l, NOW)).toEqual({ state: "unconfirmed" });
    expect(
      publicView({ ...l, registration: { url: "https://x.ca/reg" } }, NOW)
        .registrationUrl,
    ).toBeUndefined();
  });

  it("publishes only seeds that pass every check, and none as upcoming", () => {
    const shown = published(withSeed(EMPTY_NETWORK, SEED), NOW);
    expect(shown.map((l) => l.id).sort()).toEqual([
      "night-pig",
      "squealing-pig",
      "vernon-badminton-club",
      "vernon-jazz-jam",
    ]);
    expect(shown.some((l) => l.when.state === "upcoming")).toBe(false);
    for (const l of SEED.filter((s) => s.status === "published"))
      expect(blockers(l)).toEqual([]);
    for (const l of SEED.filter((s) => s.status !== "published"))
      expect(
        blockers(l).length + (l.verification === "unverified" ? 1 : 0),
      ).toBeGreaterThan(0);
  });

  it("finds a listing by interest", () => {
    const n = withSeed(EMPTY_NETWORK, SEED);
    const by = (said: string) =>
      published(n, NOW)
        .filter((l) => matchesSaid(l, [said]))
        .map((l) => l.id);
    expect(by("dirt biking this weekend")).toEqual([
      "night-pig",
      "squealing-pig",
    ]);
    expect(by("motocross")).toEqual(["night-pig", "squealing-pig"]);
    expect(by("badminton")).toEqual(["vernon-badminton-club"]);
    expect(by("a jam session")).toEqual(["vernon-jazz-jam"]);
    expect(by("something fancy for dinner")).toEqual([]);
  });

  it("an outdoor-adventure sentence finds the narrower interests it includes", () => {
    const hike = {
      ...SEED.find((l) => l.id === "vernon-outdoors-club")!,
      interests: ["hiking"],
    };
    expect(matchesSaid(hike, ["outdoor adventure"])).toBe(true);
  });

  it("withSeed adds each seed once and never overwrites an edited one", () => {
    const n = withSeed(EMPTY_NETWORK, SEED);
    const edited = {
      ...n,
      listings: n.listings.map((l) =>
        l.id === "night-pig" ? { ...l, title: "Night Pig 2027" } : l,
      ),
    };
    const again = withSeed(edited, SEED);
    expect(again).toBe(edited);
    expect(again.listings.find((l) => l.id === "night-pig")!.title).toBe(
      "Night Pig 2027",
    );
  });
});

describe("watching for the next one", () => {
  it("lists published events and clubs with no checked date ahead, least recently checked first", () => {
    const n = withSeed(EMPTY_NETWORK, SEED);
    const later = new Date("2026-12-01T12:00:00Z");
    const ids = watchList(n, later).map((w) => w.id);
    expect(ids).toEqual([
      "night-pig",
      "squealing-pig",
      "vernon-badminton-club",
    ]);
    expect(watchList(n, later)[0]!.daysSinceChecked).toBe(21);
    // checking one moves it to the back
    const touched = edit(n, "night-pig", {}, admin, later);
    expect(
      watchList(touched.network, later)
        .map((w) => w.id)
        .at(-1),
    ).toBe("night-pig");
  });
});
