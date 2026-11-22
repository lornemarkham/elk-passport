import { describe, expect, it } from "vitest";
import { EMPTY, visible, type LightsDoc, type PinView } from "./model";
import {
  addDetails,
  approve,
  approveChange,
  declineChange,
  parseDetails,
  parseSubmission,
  remove,
  requestRemoval,
  restore,
  submit,
} from "./actions";

/**
 * **Field test: "Your lights"** (2026-11-22). A submitter may correct what
 * they pinned, but a display the public has seen never changes on their word:
 * the change waits for an administrator beside the pin, the public keeps the
 * approved words, and no edit moves the pin on the map.
 */

const NOW = new Date("2026-12-05T02:00:00Z");
const LATER = new Date("2026-12-06T02:00:00Z");
const ALICE = "v_alice";
const BOB = "v_bob";
const REVIEWER = "elf@example.test";
const anyone = { key: null, reviewer: false };
const alice = { key: ALICE, reviewer: false };
const admin = { key: "v_admin", reviewer: true };

const AT = { lat: 50.2601, lng: -119.2702 };

function published(): LightsDoc {
  const { doc } = submit(
    EMPTY,
    parseSubmission({
      kind: "public-display",
      name: "Lights on Elm",
      description: "Animated reindeer",
      lat: AT.lat,
      lng: AT.lng,
      residential: false,
      features: ["family"],
      hours: "Dusk to 9 pm",
    }),
    ALICE,
    "pin-p",
    NOW,
  );
  return approve(doc, "pin-p", REVIEWER, NOW);
}

const one = (doc: LightsDoc, v: { key: string | null; reviewer: boolean }) =>
  visible(doc, v, NOW)[0] as PinView;

describe("A published display's public words wait for a reviewer", () => {
  it("keeps the approved words public and parks the submitter's change beside them", () => {
    const next = addDetails(
      published(),
      "pin-p",
      ALICE,
      false,
      parseDetails({
        name: "Lights on Elm Street",
        hours: "Dusk to 10 pm",
        description: "Synced to 99.3 FM",
        features: ["music"],
      }),
      NOW,
    );
    const pub = one(next, anyone);
    expect(pub.name).toBe("Lights on Elm");
    expect(pub.hours).toBe("Dusk to 9 pm");
    expect(pub.description).toBe("Animated reindeer");
    expect(pub.features).toEqual(["family"]);

    const mine = one(next, alice);
    expect(mine.name).toBe("Lights on Elm");
    expect(mine.proposed).toEqual(
      expect.objectContaining({
        name: "Lights on Elm Street",
        hours: "Dusk to 10 pm",
        description: "Synced to 99.3 FM",
        features: ["music"],
      }),
    );
  });

  it("shows the reviewer the waiting change, with the trail saying so", () => {
    const next = addDetails(
      published(),
      "pin-p",
      ALICE,
      false,
      parseDetails({ hours: "Dusk to 10 pm" }),
      NOW,
    );
    const review = one(next, admin);
    expect(review.proposed?.hours).toBe("Dusk to 10 pm");
    expect(review.hours).toBe("Dusk to 9 pm");
    expect(
      next.pins[0]!.trail.map((e) => e.kind).filter((k) => k === "proposed"),
    ).toHaveLength(1);
  });

  it("publishes exactly what was asked once a reviewer approves, and clears the waiting copy", () => {
    const waiting = addDetails(
      published(),
      "pin-p",
      ALICE,
      false,
      parseDetails({ name: "Lights on Elm Street", hours: "Dusk to 10 pm" }),
      NOW,
    );
    const done = approveChange(waiting, "pin-p", REVIEWER, LATER);
    const pub = one(done, anyone);
    expect(pub.name).toBe("Lights on Elm Street");
    expect(pub.hours).toBe("Dusk to 10 pm");
    expect(one(done, alice).proposed).toBeUndefined();
    expect(done.pins[0]!.trail.at(-1)?.kind).toBe("change-approved");
  });

  it("keeps the public words when a reviewer declines, with the reason recorded", () => {
    const waiting = addDetails(
      published(),
      "pin-p",
      ALICE,
      false,
      parseDetails({ name: "Something else" }),
      NOW,
    );
    const done = declineChange(
      waiting,
      "pin-p",
      REVIEWER,
      LATER,
      "not this display",
    );
    expect(one(done, anyone).name).toBe("Lights on Elm");
    expect(one(done, alice).proposed).toBeUndefined();
    const last = done.pins[0]!.trail.at(-1)!;
    expect(last.kind).toBe("change-declined");
    expect(last.text).toBe("not this display");
  });

  it("cancels a change that is sent back to the published words", () => {
    const waiting = addDetails(
      published(),
      "pin-p",
      ALICE,
      false,
      parseDetails({ name: "Lights on Elm Street" }),
      NOW,
    );
    const back = addDetails(
      waiting,
      "pin-p",
      ALICE,
      false,
      parseDetails({ name: "Lights on Elm" }),
      LATER,
    );
    expect(one(back, alice).proposed).toBeUndefined();
  });

  it("clears hours when the submitter empties them, but only once a reviewer agrees", () => {
    const waiting = addDetails(
      published(),
      "pin-p",
      ALICE,
      false,
      parseDetails({ hours: "" }),
      NOW,
    );
    expect(one(waiting, anyone).hours).toBe("Dusk to 9 pm");
    const done = approveChange(waiting, "pin-p", REVIEWER, LATER);
    expect(one(done, anyone).hours).toBeUndefined();
  });

  it("does not publish unreviewed words when a once-published display is restored", () => {
    const hidden = requestRemoval(
      published(),
      "pin-p",
      BOB,
      undefined,
      undefined,
      NOW,
    );
    const edited = addDetails(
      hidden,
      "pin-p",
      ALICE,
      false,
      parseDetails({ name: "Lights on Elm Street" }),
      LATER,
    );
    const back = restore(edited, "pin-p", REVIEWER, LATER);
    expect(back.pins[0]!.status).toBe("approved");
    expect(one(back, anyone).name).toBe("Lights on Elm");
    expect(one(back, alice).proposed?.name).toBe("Lights on Elm Street");
  });

  it("lets a reviewer's own edit apply at once, retiring only the waiting words it now matches", () => {
    const waiting = addDetails(
      published(),
      "pin-p",
      ALICE,
      false,
      parseDetails({ name: "Lights on Elm Street", hours: "Dusk to 10 pm" }),
      NOW,
    );
    const edited = addDetails(
      waiting,
      "pin-p",
      REVIEWER,
      true,
      parseDetails({ hours: "Dusk to 10 pm" }),
      LATER,
    );
    expect(one(edited, anyone).hours).toBe("Dusk to 10 pm");
    expect(one(edited, admin).proposed).toEqual(
      expect.objectContaining({ name: "Lights on Elm Street" }),
    );
    expect(one(edited, admin).proposed?.hours).toBeUndefined();
  });

  it("applies a pending display's details at once, because nobody else can see it yet", () => {
    const { doc } = submit(
      EMPTY,
      parseSubmission({
        kind: "home",
        lat: AT.lat,
        lng: AT.lng,
        residential: true,
        features: [],
      }),
      ALICE,
      "pin-n",
      NOW,
    );
    const next = addDetails(
      doc,
      "pin-n",
      ALICE,
      false,
      parseDetails({ name: "Our Home Lights", hours: "Dusk" }),
      NOW,
    );
    expect(next.pins[0]!.proposal).toBeUndefined();
    expect(one(next, alice).name).toBe("Our Home Lights");
    expect(visible(next, anyone, NOW)).toHaveLength(0);
  });

  it("erases any waiting words when the display is deleted", () => {
    const waiting = addDetails(
      published(),
      "pin-p",
      ALICE,
      false,
      parseDetails({ description: "Secret words" }),
      NOW,
    );
    const gone = remove(waiting, "pin-p", ALICE, false, LATER);
    expect(gone.pins[0]!.proposal).toBeUndefined();
    expect(JSON.stringify(gone)).not.toContain("Secret words");
  });

  it("never moves a published pin: no details, change or decline alters its place", () => {
    let doc = published();
    doc = addDetails(
      doc,
      "pin-p",
      ALICE,
      false,
      parseDetails({ name: "Moved?", hours: "Dusk" }),
      NOW,
    );
    doc = approveChange(doc, "pin-p", REVIEWER, LATER);
    doc = addDetails(
      doc,
      "pin-p",
      REVIEWER,
      true,
      parseDetails({ description: "Reviewer words" }),
      LATER,
    );
    expect(doc.pins[0]!.at).toEqual(AT);
  });

  it("refuses an approval when nothing is waiting", () => {
    expect(() => approveChange(published(), "pin-p", REVIEWER, NOW)).toThrow(
      /Nothing is waiting/,
    );
    expect(() => declineChange(published(), "pin-p", REVIEWER, NOW)).toThrow(
      /Nothing is waiting/,
    );
  });
});

describe("Pending submissions stay private from another account", () => {
  const pending = () =>
    submit(
      EMPTY,
      parseSubmission({
        kind: "public-display",
        name: "Private until reviewed",
        lat: AT.lat,
        lng: AT.lng,
        residential: false,
        features: [],
      }),
      ALICE,
      "pin-x",
      NOW,
    ).doc;

  it("is not in another signed-in account's list, nor the public's", () => {
    const doc = pending();
    expect(visible(doc, { key: BOB, reviewer: false }, NOW)).toHaveLength(0);
    expect(visible(doc, anyone, NOW)).toHaveLength(0);
  });

  it("refuses another account's attempt to add details to it", () => {
    expect(() =>
      addDetails(
        pending(),
        "pin-x",
        BOB,
        false,
        parseDetails({ hours: "x" }),
        NOW,
      ),
    ).toThrow(/Only the person who pinned it/);
  });

  it("is still the submitter's and the reviewer's alone", () => {
    const doc = pending();
    expect(visible(doc, alice, NOW)).toHaveLength(1);
    expect(visible(doc, admin, NOW)).toHaveLength(1);
  });
});
