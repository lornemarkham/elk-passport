import { describe, expect, it } from "vitest";
import type { Experience } from "@/domain/experience/types";
import { closingFor, dontMiss } from "./dontMiss";

/**
 * **The whole value of "don't miss" is how rarely it is said.**
 *
 * Measured on the live corpus: 49 subjects end within seven days of 1 October
 * and 44 of them are one-off events. These tests exist to keep those 44 out —
 * the failure mode is not a wrong answer, it is forty right-ish answers.
 */
const on = (
  days: readonly string[],
  over: Partial<Experience> = {},
): Experience =>
  ({
    id: "e1",
    kind: "Experience",
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
    availability: { basis: "stated", days: [...days] },
    ...over,
  }) as unknown as Experience;

const AT = (day: string) => new Date(`${day}T20:00:00Z`);

describe("what it refuses", () => {
  it("refuses a one-off event, however imminent", () => {
    // 44 of the 49 "ending within a week" subjects look exactly like this.
    expect(
      closingFor(on(["2026-10-09"]), "2026-10-09", false, AT("2026-10-09")),
    ).toBeUndefined();
  });

  it("refuses a short event that has not started", () => {
    // Both days still ahead: nothing has been lost, so nothing is closing.
    expect(
      closingFor(
        on(["2026-10-10", "2026-10-11"]),
        "2026-10-09",
        false,
        AT("2026-10-09"),
      ),
    ).toBeUndefined();
  });

  it("refuses a long run with plenty of chances left", () => {
    // Field of Screams: 38 nights across five weeks. Not a closing window.
    const days = Array.from({ length: 38 }, (_, i) =>
      new Date(Date.UTC(2026, 8, 25 + i)).toISOString().slice(0, 10),
    );
    expect(
      closingFor(on(days), "2026-10-09", true, AT("2026-10-09")),
    ).toBeUndefined();
  });

  it("refuses something that ends later this month", () => {
    const days = ["2026-10-01", "2026-10-20"];
    expect(
      closingFor(on(days), "2026-10-09", false, AT("2026-10-09")),
    ).toBeUndefined();
  });

  it("refuses something already over", () => {
    expect(
      closingFor(
        on(["2026-10-01", "2026-10-02"]),
        "2026-10-09",
        false,
        AT("2026-10-09"),
      ),
    ).toBeUndefined();
  });

  it("refuses a subject with no stated days at all", () => {
    expect(
      closingFor(on([]), "2026-10-09", false, AT("2026-10-09")),
    ).toBeUndefined();
  });
});

describe("what it accepts, and what it says", () => {
  it("knows a final night", () => {
    const got = closingFor(
      on(["2026-10-29", "2026-10-30", "2026-10-31"]),
      "2026-10-31",
      true,
      AT("2026-10-31"),
    )!;
    expect(got.reason).toBe("Final night — tonight.");
    expect(got.daysLeft).toBe(1);
  });

  it("says day for a thing that is not a night thing", () => {
    const got = closingFor(
      on(["2026-10-29", "2026-10-30", "2026-10-31"]),
      "2026-10-31",
      false,
      AT("2026-10-31"),
    )!;
    expect(got.reason).toBe("Final day — tonight.");
  });

  it("knows a final weekend", () => {
    // The Draconids' real shape: five nights, two left, both on the weekend.
    const got = closingFor(
      on([
        "2026-10-06",
        "2026-10-07",
        "2026-10-08",
        "2026-10-09",
        "2026-10-10",
      ]),
      "2026-10-09",
      true,
      AT("2026-10-09"),
    )!;
    expect(got.reason).toBe("Final weekend.");
    expect(got.daysLeft).toBe(2);
    expect(got.daysInRun).toBe(5);
  });

  it("names the last day when it is not tonight", () => {
    const got = closingFor(
      on(["2026-10-25", "2026-10-26", "2026-10-28"]),
      "2026-10-26",
      false,
      AT("2026-10-26"),
    )!;
    expect(got.reason).toMatch(/Last two days — ends Wednesday/);
  });
});

describe("how few it shows", () => {
  const closing = (days: readonly string[], title: string) => ({
    experience: on(days, { title } as Partial<Experience>),
  });

  it("shows at most two, however many qualify", () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      closing(["2026-10-29", "2026-10-30", "2026-10-31"], `Thing ${i}`),
    );
    const picked = dontMiss(many, (x) =>
      closingFor(x.experience, "2026-10-31", false, AT("2026-10-31")),
    );
    expect(picked).toHaveLength(2);
  });

  it("shows nothing when nothing qualifies, rather than its best guess", () => {
    const none = [closing(["2026-10-09"], "A one-off")];
    expect(
      dontMiss(none, (x) =>
        closingFor(x.experience, "2026-10-09", false, AT("2026-10-09")),
      ),
    ).toHaveLength(0);
  });

  it("puts the bigger loss first", () => {
    // A 162-day season ending beats a 5-day shower ending, same day.
    const season = closing(
      Array.from({ length: 162 }, (_, i) =>
        new Date(Date.UTC(2026, 3, 1 + i)).toISOString().slice(0, 10),
      ).concat(["2026-10-30", "2026-10-31"]),
      "Season",
    );
    const shower = closing(
      ["2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31"],
      "Shower",
    );
    const picked = dontMiss([shower, season], (x) =>
      closingFor(x.experience, "2026-10-31", false, AT("2026-10-31")),
    );
    expect(picked[0]!.item).toBe(season);
  });

  it("puts a last day above a last two days", () => {
    const oneLeft = closing(["2026-10-28", "2026-10-31"], "One left");
    const twoLeft = closing(
      ["2026-10-28", "2026-10-31", "2026-11-01"],
      "Two left",
    );
    const picked = dontMiss([twoLeft, oneLeft], (x) =>
      closingFor(x.experience, "2026-10-31", false, AT("2026-10-31")),
    );
    expect(picked[0]!.item).toBe(oneLeft);
  });
});
