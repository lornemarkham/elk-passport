"use client";

import { useHere } from "@/lib/location/useHere";
import { distanceKm } from "@/lib/environment/geo";

/**
 * **The one fact on the plan the server cannot know.**
 *
 * The reader's position lives in the browser for one visit and is written to
 * nothing (ADR 002, and `useHere`'s own doc comment). Navigating from Discovery
 * to a plan is a new page, so the position is genuinely gone — and the plan
 * must say that rather than quietly dropping the heading.
 *
 * So the server renders *"you have not shared where you are"* and this offers
 * to ask again. The arithmetic happens here, in the browser, against
 * coordinates Atlas already published: no coordinate of the reader's is sent
 * anywhere, and the only thing that reaches the server is the existing
 * forecast request `useHere` already makes.
 *
 * **Straight-line, and said so.** Passport has no routing service, so a drive
 * time is a capability it does not have. Inventing one for a parent deciding
 * whether somewhere is thirty minutes away is the exact failure this slice is
 * meant not to commit.
 */
export function TravelFromHere({
  coordinates,
}: {
  /** Atlas's own point, `[longitude, latitude]`, or absent. */
  readonly coordinates?: readonly [number, number];
}) {
  const { at, ask } = useHere();

  if (!coordinates) {
    return (
      <p className="text-[14px] leading-relaxed text-black/45">
        Atlas has not placed this on a map, so no distance can be measured.
      </p>
    );
  }

  if (!at) {
    return (
      <p className="text-[14px] leading-relaxed text-black/45">
        You have not shared where you are, so there is nothing to measure from.
        {ask && (
          <>
            {" "}
            <button
              type="button"
              data-testid="day-locate"
              onClick={ask}
              style={{ color: "var(--ghad-accent)" }}
              className="font-semibold underline underline-offset-4"
            >
              share where you are
            </button>
          </>
        )}
      </p>
    );
  }

  const km = distanceKm(at, {
    latitude: coordinates[1],
    longitude: coordinates[0],
  });
  return (
    <p data-testid="day-distance" className="text-[15px] text-[#111]">
      {km < 1 ? "Under 1 km" : `${Math.round(km)} km`} in a straight line.{" "}
      <span className="text-black/45">
        Passport has no routing, so this is not a drive time.
      </span>
    </p>
  );
}
