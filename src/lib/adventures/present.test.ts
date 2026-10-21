import { describe, expect, it } from "vitest";
import { momentLabel, responsesLabel, usesLabel, whenLabel } from "./present";

describe("how an adventure reads", () => {
  it("says nothing about when if nobody has said", () => {
    expect(whenLabel(null, null)).toBeNull();
  });

  it("names a day without sliding across time zones", () => {
    expect(whenLabel("2026-10-25", null)).toBe("Sun, Oct 25");
    expect(whenLabel("2026-10-24", "2026-10-27")).toBe(
      "Sat, Oct 24 – Tue, Oct 27",
    );
    expect(whenLabel("2026-10-24", "2026-10-24")).toBe("Sat, Oct 24");
  });

  it("puts a moment in the adventure's own time zone", () => {
    expect(
      momentLabel("2026-10-26T02:00:00.000Z", "America/Vancouver"),
    ).toMatch(/Sun, Oct 25.*7:00.*p\.?m\.?.*PDT/i);
  });

  it("counts answers, and stays quiet when there are none", () => {
    expect(responsesLabel({ in: 2, maybe: 1, out: 0 })).toBe("2 in · 1 maybe");
    expect(responsesLabel({ in: 0, maybe: 0, out: 0 })).toBe("");
  });

  it("says what a link allows", () => {
    expect(usesLabel(1, 0)).toBe("One person");
    expect(usesLabel(1, 1)).toBe("Used");
    expect(usesLabel(null, 3)).toBe("Open link · 3 joined");
    expect(usesLabel(5, 2)).toBe("2 of 5 used");
  });
});
