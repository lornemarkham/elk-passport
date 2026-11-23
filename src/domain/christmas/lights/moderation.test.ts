import { describe, expect, it } from "vitest";
import { EMPTY, removalOpen, visible, viewOf, type LightsDoc } from "./model";
import {
  MAX_WAITING,
  addDetails,
  approve,
  decline,
  hide,
  parseContact,
  parseDetails,
  parseSubmission,
  removedNear,
  remove,
  requestRemoval,
  restore,
  submit,
} from "./actions";

const NOW = new Date("2026-12-05T02:00:00Z");
const LATER = new Date("2026-12-06T02:00:00Z");
const ADMIN = "lorne@example.test";
const anyone = { key: null, reviewer: false };
const admin = { key: "v_admin", reviewer: true };

const sub = (over: Record<string, unknown> = {}) =>
  parseSubmission({
    kind: "home",
    name: "The Reindeer House",
    description: "Animated reindeer on the roof",
    lat: 50.2601,
    lng: -119.2702,
    address: "123 Example Road",
    ...over,
  });

const pending = (by = "anon_a", id = "pin-a", over = {}) =>
  submit(EMPTY, sub(over), by, id, NOW, id).doc;

describe("Anonymous submissions", () => {
  it("are pending and invisible to everyone but the administrator", () => {
    const doc = pending();
    expect(visible(doc, anyone, NOW)).toHaveLength(0);
    expect(visible(doc, { key: "v_other", reviewer: false }, NOW)).toHaveLength(
      0,
    );
    expect(visible(doc, admin, NOW).map((p) => p.status)).toEqual(["pending"]);
  });

  it("refuse web links in the words, which is how spam arrives", () => {
    expect(() => sub({ description: "see www.cheap-pills.example" })).toThrow(
      /links/,
    );
    expect(() => sub({ name: "visit http://x.example" })).toThrow(/links/);
  });

  it("have no daily cap: twenty-five real displays in one evening all go in", () => {
    // The owner added ten in one evening and was told "try again tomorrow".
    let doc: LightsDoc = EMPTY;
    for (let i = 0; i < 25; i++)
      doc = submit(
        doc,
        sub({ lat: 50.26 + i * 0.001, name: `Display ${i}` }),
        "anon_x",
        `p${i}`,
        new Date(NOW.getTime() + i * 20_000),
      ).doc;
    expect(doc.pins.filter((p) => p.submittedBy === "anon_x")).toHaveLength(25);
    expect(JSON.stringify(doc)).not.toContain("tomorrow");
  });

  it("ask a burst to pause — a minute, never a day — and let someone else through", () => {
    let doc: LightsDoc = EMPTY;
    for (let i = 0; i < 12; i++)
      doc = submit(
        doc,
        sub({ lat: 50.26 + i * 0.001, name: `Display ${i}` }),
        "anon_x",
        `p${i}`,
        new Date(NOW.getTime() + i * 1000),
      ).doc;
    const soon = new Date(NOW.getTime() + 13_000);
    expect(() => submit(doc, sub(), "anon_x", "p13", soon)).toThrow(/minute/);
    expect(() => submit(doc, sub(), "anon_y", "p14", soon)).not.toThrow();
    // Sixty-one seconds on, the oldest has left the window.
    expect(() =>
      submit(doc, sub(), "anon_x", "p15", new Date(NOW.getTime() + 61_000)),
    ).not.toThrow();
  });

  it("cool off a contributor whose recent pins were declined as spam", () => {
    let doc: LightsDoc = EMPTY;
    for (let i = 0; i < 3; i++) {
      doc = submit(
        doc,
        sub({ lat: 50.26 + i * 0.001, name: `Junk ${i}` }),
        "anon_s",
        `s${i}`,
        new Date(NOW.getTime() + i * 30_000),
      ).doc;
      doc = decline(doc, `s${i}`, ADMIN, NOW, "spam");
    }
    const hourOn = new Date(NOW.getTime() + 3_600_000);
    expect(() => submit(doc, sub(), "anon_s", "s9", hourOn)).toThrow(/paused/);
    // A day on, the pause is over.
    expect(() => submit(doc, sub(), "anon_s", "s9", LATER)).not.toThrow();
    // A decline for another reason is not a strike.
    let fair: LightsDoc = EMPTY;
    for (let i = 0; i < 3; i++) {
      fair = submit(
        fair,
        sub({ lat: 50.26 + i * 0.001, name: `Dark ${i}` }),
        "anon_f",
        `f${i}`,
        new Date(NOW.getTime() + i * 30_000),
      ).doc;
      fair = decline(fair, `f${i}`, ADMIN, NOW, "not-lights");
    }
    expect(() => submit(fair, sub(), "anon_f", "f9", hourOn)).not.toThrow();
  });

  it("stop at a flood: the queue holds only so many", () => {
    let doc: LightsDoc = EMPTY;
    for (let i = 0; i < MAX_WAITING; i++)
      doc = submit(
        doc,
        sub({
          lat: 50.2 + (i % 100) * 0.001,
          lng: -119.2 + Math.floor(i / 100) * 0.01,
        }),
        `anon_${i}`,
        `p${i}`,
        NOW,
      ).doc;
    expect(() => submit(doc, sub(), "anon_new", "late", NOW)).toThrow(
      /waiting for review/,
    );
  });
});

describe("The public never learns who submitted or who lives there", () => {
  it("a published view carries no submitter, trail, contact or review block", () => {
    const doc = approve(pending(), "pin-a", ADMIN, NOW);
    const [pub] = visible(doc, anyone, NOW);
    const text = JSON.stringify(pub);
    expect(text).not.toContain("anon_a");
    expect(text).not.toContain("submittedBy");
    expect(text).not.toContain(ADMIN);
    expect(pub).not.toHaveProperty("review");
  });
});

describe("Removal requests — hidden at once, no account, no proof", () => {
  const published = () => approve(pending(), "pin-a", ADMIN, NOW);

  it("hides a published listing from everybody immediately and flags it for the administrator", () => {
    const doc = requestRemoval(
      published(),
      "pin-a",
      "anon_z",
      "This is my house",
      "me@example.test",
      LATER,
    );
    expect(visible(doc, anyone, LATER)).toHaveLength(0);
    const [v] = visible(doc, admin, LATER);
    expect(v?.status).toBe("hidden");
    expect(v?.review?.removalOpen).toBe(true);
    expect(v?.review?.trail.at(-2)?.contact).toBe("me@example.test");
  });

  it("also takes a still-pending submission out of the queue's approve path", () => {
    const doc = requestRemoval(
      pending(),
      "pin-a",
      "anon_z",
      undefined,
      undefined,
      LATER,
    );
    expect(doc.pins[0]?.status).toBe("hidden");
    expect(() => approve(doc, "pin-a", ADMIN, LATER)).toThrow(/hidden/);
    // Restoring a never-approved submission returns it to the queue, never to the map.
    expect(restore(doc, "pin-a", ADMIN, LATER).pins[0]?.status).toBe("pending");
  });

  it("limits one requester to two requests per listing", () => {
    let doc = published();
    doc = requestRemoval(doc, "pin-a", "anon_z", "1", undefined, LATER);
    doc = requestRemoval(doc, "pin-a", "anon_z", "2", undefined, LATER);
    expect(() =>
      requestRemoval(doc, "pin-a", "anon_z", "3", undefined, LATER),
    ).toThrow(/already/);
  });

  it("accepts an email or a phone as contact, and nothing else", () => {
    expect(parseContact("me@example.test")).toBe("me@example.test");
    expect(parseContact("+1 (250) 555-0100")).toBe("+1 (250) 555-0100");
    expect(parseContact("")).toBeUndefined();
    expect(() => parseContact("call me maybe")).toThrow(/contact/);
  });

  it("is resolved by restoring (dispute settled) or deleting", () => {
    const asked = requestRemoval(
      published(),
      "pin-a",
      "anon_z",
      "mine",
      undefined,
      LATER,
    );
    expect(removalOpen(asked.pins[0]!)).toBe(true);
    const back = restore(asked, "pin-a", ADMIN, LATER, "Not the homeowner");
    expect(back.pins[0]?.status).toBe("approved");
    expect(removalOpen(back.pins[0]!)).toBe(false);
    expect(visible(back, anyone, LATER)).toHaveLength(1);
  });
});

describe("Delete is permanent, audited, and blocks the place coming back", () => {
  const asked = () =>
    requestRemoval(
      approve(pending(), "pin-a", ADMIN, NOW),
      "pin-a",
      "anon_z",
      "mine",
      "me@example.test",
      LATER,
    );

  it("erases the photo, words, address and any requester contact, keeps the trail", () => {
    const gone = remove(
      asked(),
      "pin-a",
      ADMIN,
      true,
      LATER,
      "Homeowner asked",
    );
    const p = gone.pins[0]!;
    expect(p.status).toBe("removed");
    expect(p.photo).toBeUndefined();
    expect(p.address).toBeUndefined();
    expect(p.description).toBeUndefined();
    expect(p.name).toBe("Removed listing");
    expect(JSON.stringify(p)).not.toContain("me@example.test");
    expect(p.trail.map((e) => e.kind)).toEqual([
      "submitted",
      "approved",
      "removal-request",
      "hidden",
      "removed",
    ]);
    expect(p.trail.at(-1)?.by).toBe(ADMIN);
    expect(visible(gone, admin, LATER)).toHaveLength(0);
  });

  it("refuses the same property again within 60 m, but not another street", () => {
    const gone = remove(asked(), "pin-a", ADMIN, true, LATER);
    expect(removedNear(gone, { lat: 50.26012, lng: -119.27021 })).toBe(true);
    expect(removedNear(gone, { lat: 50.2701, lng: -119.2702 })).toBe(false);
    expect(() =>
      submit(gone, sub({ lat: 50.26015 }), "anon_new", "again", LATER),
    ).toThrow(/household/);
  });
});

describe("Administrator actions are audit-logged", () => {
  it("approve, hide, restore, edit and reject each leave who, when and why", () => {
    let doc = pending();
    doc = approve(doc, "pin-a", ADMIN, NOW);
    doc = hide(doc, "pin-a", ADMIN, NOW, "photo shows a plate");
    doc = restore(doc, "pin-a", ADMIN, NOW, "plate cropped out");
    doc = addDetails(
      doc,
      "pin-a",
      ADMIN,
      true,
      parseDetails({ name: "Reindeer House", kind: "public-display" }),
      NOW,
    );
    const p = doc.pins[0]!;
    expect(p.kind).toBe("public-display");
    expect(p.residential).toBe(false);
    expect(p.trail.map((e) => `${e.kind}:${e.by}`)).toEqual([
      "submitted:anon_a",
      `approved:${ADMIN}`,
      `hidden:${ADMIN}`,
      `restored:${ADMIN}`,
      `details:${ADMIN}`,
    ]);
    expect(p.trail[2]?.text).toBe("photo shows a plate");
    const rejected = decline(
      pending(),
      "pin-a",
      ADMIN,
      NOW,
      "Shows identifiable people",
    );
    expect(rejected.pins[0]?.status).toBe("declined");
    expect(rejected.pins[0]?.trail.at(-1)?.text).toBe(
      "Shows identifiable people",
    );
  });

  it("only a published display can be hidden", () => {
    expect(() => hide(pending(), "pin-a", ADMIN, NOW)).toThrow(/published/);
  });

  it("a submitter's own view never carries the trail", () => {
    const doc = pending("v_alice");
    expect(
      viewOf(doc.pins[0]!, { key: "v_alice", reviewer: false }, NOW),
    ).not.toHaveProperty("review");
  });
});
