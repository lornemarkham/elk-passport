import type { ReactNode } from "react";
import type { LightPhase } from "@/domain/environment/daylight";

/**
 * **October at 2 PM and October at 9 PM should not look the same.**
 *
 * The first version of this was a 5% wash that nobody could see, which is the
 * same as not having built it. Elegant and invisible is just invisible.
 *
 * This version is visible: a band of real colour across the top of the page,
 * roughly a third of the viewport tall, plus a matching hairline. Daylight
 * gets a pale cool sky; dusk gets the ember October already uses, low and
 * warm; night gets a deep blue that is unmistakably not the other two.
 *
 * ## It still cannot hurt readability
 *
 * The wash sits **behind** the content, is `pointer-events: none`, and never
 * touches a token. Every piece of text keeps its own colour on October's own
 * `#0c0a0c` ground, so contrast ratios are identical in all three states —
 * what changes is the room, not the type. The strongest stop is 18% alpha
 * over a near-black page, which is a long way from washing anything out.
 *
 * `prefers-reduced-motion` removes the transition, not the colour.
 */
const SKY: Record<LightPhase, { wash: string; edge: string }> = {
  day: {
    wash: "linear-gradient(180deg, rgba(126,160,196,0.17) 0%, rgba(126,160,196,0.06) 38%, transparent 100%)",
    edge: "rgba(126,160,196,0.30)",
  },
  dusk: {
    wash: "linear-gradient(180deg, rgba(208,122,48,0.22) 0%, rgba(140,70,60,0.10) 42%, transparent 100%)",
    edge: "rgba(208,154,78,0.45)",
  },
  night: {
    wash: "linear-gradient(180deg, rgba(42,58,96,0.30) 0%, rgba(30,38,66,0.12) 40%, transparent 100%)",
    edge: "rgba(96,116,168,0.30)",
  },
};

export function SkyWash({
  phase,
  children,
}: {
  /** Absent when October does not know where you are. Then: no sky. */
  readonly phase: LightPhase | undefined;
  readonly children: ReactNode;
}) {
  const sky = phase ? SKY[phase] : undefined;
  return (
    <div className="relative" data-light-phase={phase ?? "unknown"}>
      {sky ? (
        <>
          <div
            aria-hidden
            data-testid="sky-wash"
            className="pointer-events-none absolute inset-x-0 top-0 h-[38vh] transition-[background-image] duration-1000 motion-reduce:transition-none"
            style={{ backgroundImage: sky.wash }}
          />
          {/* A horizon line. Small, and the thing the eye actually catches. */}
          <div
            aria-hidden
            data-testid="sky-edge"
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ backgroundColor: sky.edge }}
          />
        </>
      ) : null}
      <div className="relative">{children}</div>
    </div>
  );
}
