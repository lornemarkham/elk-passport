import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * **A room entered from October lets you back out into October.**
 *
 * Both of these rooms are reached from the *From October* section of
 * `/october`, and both used to end at `/discovery` — Passport's general list,
 * outside October's shell, with no way back into the month. Leaving a room was
 * leaving the season.
 *
 * The Video Store had no exit at all: the only way out was the browser's back
 * button, which is an escape rather than a door.
 *
 * These are read off the source rather than rendered, because both components
 * are full-screen scenes built on `AudioContext`, `IntersectionObserver` and a
 * video plate — mounting either to assert one `href` would test jsdom's gaps
 * instead of the link.
 */
const source = (path: string) => readFileSync(path, "utf8");

const WITCHING_HOUR = "src/app/labs/october/witching-hour/WitchingHour.tsx";
const VIDEO_STORE = "src/components/october/store/VhsWall.tsx";

describe("the way out of an October room", () => {
  it("brings Witching Hour's quiet exit back to October", () => {
    const scene = source(WITCHING_HOUR);
    expect(scene).toContain('href="/october"');
    expect(scene).not.toContain('href="/discovery"');
  });

  it("brings the end of the night back to October too", () => {
    // `StayInside`'s own "back to October" calls this, and it is the one exit
    // a person reaches by finishing rather than by giving up.
    expect(source(WITCHING_HOUR)).toContain(
      'window.location.href = "/october"',
    );
    expect(source(WITCHING_HOUR)).not.toContain(
      'window.location.href = "/discovery"',
    );
  });

  it("gives the Video Store a door", () => {
    const store = source(VIDEO_STORE);
    expect(store).toContain('data-testid="leave-store"');
    expect(store).toContain('href="/october"');
  });

  it("says where it goes, in October's own words", () => {
    expect(source(VIDEO_STORE)).toContain("back to October");
    expect(
      source("src/app/labs/october/witching-hour/StayInside.tsx"),
    ).toContain("back to October");
  });
});
