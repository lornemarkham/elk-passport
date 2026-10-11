import { describe, expect, it } from "vitest";
import {
  DISC_RADIUS,
  UNITS_PER_KM,
  YVR,
  alongGreatCircle,
  greatCircleKm,
  project,
} from "./projection";
import { WORLD_LAND_PATH } from "@/components/sycle/world";

const LHR = { latitude: 51.47, longitude: -0.45 };
const SYD = { latitude: -33.94, longitude: 151.18 };

describe("the world as seen from YVR", () => {
  it("puts Vancouver at the centre", () => {
    const c = project(YVR);
    expect(Math.hypot(c.x, c.y)).toBeLessThan(1e-6);
  });

  it("puts north up and east to the right", () => {
    const north = project({ latitude: 60, longitude: YVR.longitude });
    expect(north.x).toBeCloseTo(0, 6);
    expect(north.y).toBeLessThan(0);
    expect(project({ latitude: 49, longitude: -100 }).x).toBeGreaterThan(0);
  });

  it("keeps true distance from YVR as distance from the centre", () => {
    const p = project(LHR);
    expect(Math.hypot(p.x, p.y) / UNITS_PER_KM).toBeCloseTo(
      greatCircleKm(YVR, LHR),
      0,
    );
    expect(greatCircleKm(YVR, LHR)).toBeGreaterThan(7500);
    expect(greatCircleKm(YVR, LHR)).toBeLessThan(7700);
  });

  it("draws every route into YVR as a straight line to the centre", () => {
    for (const origin of [LHR, SYD]) {
      const o = project(origin);
      for (const t of [0.25, 0.5, 0.75]) {
        const m = project(alongGreatCircle(origin, YVR, t));
        // Cross product of o and m is ~0 ⇔ collinear with the centre.
        expect(
          Math.abs(o.x * m.y - o.y * m.x) /
            (Math.hypot(o.x, o.y) * Math.hypot(m.x, m.y)),
        ).toBeLessThan(1e-6);
      }
    }
  });

  it("ships a coastline baked with the same projection, inside the disc", () => {
    const numbers = WORLD_LAND_PATH.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    expect(numbers.length).toBeGreaterThan(1000);
    for (let i = 0; i < numbers.length; i += 2)
      expect(Math.hypot(numbers[i]!, numbers[i + 1]!)).toBeLessThanOrEqual(
        DISC_RADIUS + 1,
      );
  });
});
