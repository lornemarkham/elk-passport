import { describe, expect, it } from "vitest";
import type { Experience } from "@/domain/experience/types";
import { classifySubject } from "./subjectKind";

/**
 * **What kind of thing is this, and how do we know?**
 *
 * The `basis` is as important as the kind. Atlas classifies roughly 15% of
 * dated subjects through a venue; the rest is Passport reading words, and the
 * two must stay distinguishable so the limitation can be reported honestly
 * rather than hidden behind a confident answer.
 */
const subject = (over: Partial<Experience>): Experience =>
  ({
    id: "e1",
    kind: "Event",
    slug: "s",
    title: "A thing",
    shortDescription: "",
    detailReady: true,
    energyLevel: 2,
    priceLevel: 1,
    duration: { minMinutes: 60, maxMinutes: 120 },
    moods: [],
    activities: [],
    seasons: [],
    timeOfDay: [],
    weather: [],
    companions: [],
    regionIds: [],
    familyFriendly: true,
    petFriendly: false,
    requiresReservation: false,
    isActive: true,
    ...over,
  }) as Experience;

describe("the venue is the strongest evidence Atlas holds", () => {
  it("reads a comedy lounge as indoors", () => {
    const got = classifySubject(
      subject({ subtype: "Comedy" }),
      "comedy lounge",
    );
    expect(got).toEqual({ kind: "indoor", basis: "venue" });
  });

  it("reads a historic site as outdoors", () => {
    const got = classifySubject(
      subject({ title: "Autumn Fair" }),
      "historic site",
    );
    expect(got.kind).toBe("outdoor-day");
    expect(got.basis).toBe("venue");
  });

  it("reads an observatory as a sky venue", () => {
    expect(classifySubject(subject({}), "observatory").kind).toBe("astronomy");
  });

  it("learns nothing from the subtype 'venue', which 27 subjects have", () => {
    const got = classifySubject(subject({ title: "Something" }), "venue");
    expect(got).toEqual({ kind: "unknown", basis: "none" });
  });
});

describe("the real subjects this was built for", () => {
  it("knows Field of Screams happens after dark", () => {
    // Its venue is a "historic site" and its title holds no word for night —
    // the plural in "Screams" is what the first version of the stem missed.
    const got = classifySubject(
      subject({ title: "Field of Screams" }),
      "historic site",
    );
    expect(got.kind).toBe("outdoor-night");
  });

  it("knows the Draconids are a sky event with no venue at all", () => {
    const got = classifySubject(
      subject({
        title: "Draconid meteor shower 2026",
        subtype: "Meteor Shower",
      }),
    );
    expect(got).toEqual({ kind: "astronomy", basis: "subtype" });
  });

  it("knows a pumpkin patch is a daytime outdoor thing", () => {
    expect(classifySubject(subject({ subtype: "pumpkin patch" })).kind).toBe(
      "outdoor-day",
    );
  });

  it("knows a hockey game is indoors", () => {
    const got = classifySubject(
      subject({
        title: "Kelowna Rockets vs Kamloops Blazers",
        subtype: "Sports Event",
      }),
      "venue",
    );
    expect(got.kind).toBe("indoor");
  });
});

describe("what it refuses", () => {
  it("answers unknown rather than guessing", () => {
    expect(classifySubject(subject({ title: "Evening Haunt" })).kind).not.toBe(
      "indoor",
    );
    expect(
      classifySubject(subject({ title: "An Untitled Gathering" })),
    ).toEqual({
      kind: "unknown",
      basis: "none",
    });
  });

  it("lets indoor win a tie, because a wrong 'outdoor' sends somebody out in a coat", () => {
    const got = classifySubject(subject({ subtype: "Concert" }), undefined);
    expect(got.kind).toBe("indoor");
  });

  it("prefers the venue over the subject's own word", () => {
    // A "Market" held in a convention centre is indoors.
    const got = classifySubject(
      subject({ subtype: "Market" }),
      "convention centre",
    );
    expect(got).toEqual({ kind: "indoor", basis: "venue" });
  });

  it("uses a stated clock before any word", () => {
    const evening = classifySubject(
      subject({
        subtype: "pumpkin patch",
        startTime: "2026-10-09T03:00:00.000Z",
        timePrecision: "minute",
      }),
    );
    expect(evening.kind).toBe("outdoor-night");
  });
});
