import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sunsetOf } from "./compose";
import { EVENINGS, eveningNamed } from "./evenings";
import { homeAt, templatePlan, warningsFor } from "./itinerary";
import { TOMORROW } from "./tomorrow";

const sunset = sunsetOf(TOMORROW)!;

describe("the adventures", () => {
  it("are King Eddie Lake, Jess's Crazy Creek, Cold Water and the surprise", () => {
    expect(EVENINGS.map((e) => e.title)).toEqual([
      "King Eddie Lake",
      "Crazy Creek Escape",
      "Cold Water, Warm Fire",
      "Surprise Us",
    ]);
    expect(EVENINGS[1]!.pick).toBe("Jess's Pick");
  });

  it("each opens on a real photograph that ships with the app", () => {
    for (const e of EVENINGS) {
      expect(
        fs.existsSync(path.join(process.cwd(), "public", e.photo.src)),
      ).toBe(true);
      expect(e.photo.license).toMatch(/^CC/);
      expect(e.photo.page).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
    }
  });

  it("lay out in time order, honestly, and home before 11", () => {
    for (const e of EVENINGS.filter((x) => !x.composed))
      for (const ending of e.endings ?? [undefined]) {
        const plan = templatePlan(e, sunset, TOMORROW, ending?.id);
        for (let i = 1; i < plan.length; i++)
          expect(plan[i]!.at).toBeGreaterThanOrEqual(plan[i - 1]!.at);
        expect(plan[0]!.key).toBe("leave");
        expect(warningsFor(plan, sunset, e, TOMORROW)).toEqual([]);
        expect(homeAt(plan)!).toBeLessThan(23 * 60);
      }
  });

  it("an adventure chosen under its old name is still found", () => {
    expect(eveningNamed("Into the Wild")?.id).toBe("king-eddie");
    expect(eveningNamed("Cold Water, Warm Fire")?.id).toBe("cold-water");
  });

  it("never claims a fire, a hunt or a swim is allowed without a check", () => {
    const eddie = eveningNamed("King Eddie Lake")!;
    const labels = eddie.checks.map((c) => c.label);
    expect(labels).toEqual(
      expect.arrayContaining(["Hunting", "Fire", "Cold water", "The road"]),
    );
    expect(eddie.checks.find((c) => c.label === "Hunting")!.line).toMatch(
      /6:33 pm/,
    );
  });
});
