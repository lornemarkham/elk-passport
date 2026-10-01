import type { ReactNode } from "react";
import type { HypeLevel } from "@/domain/october/hype";

/**
 * **Hype levels 1–3, wrapped around a card that stays an ordinary card.**
 *
 * The structure never changes: same grid cell, same photograph, same title,
 * same save control. What changes is how alive it is — which is the whole
 * point of the middle of the Hypometer. A level that restructured the card
 * would just be a bigger card, and a bigger card is prominence, not
 * personality.
 *
 * ```
 * 1  NUDGE   a warm edge and a faint inner light. You would not point at it.
 * 2  HYPED   that edge breathes, and the card sits slightly forward.
 * 3  HOT     plus its photograph drifts, and a slow light crosses it.
 * ```
 *
 * ## Not "more orange and a brighter border"
 *
 * Each step adds a *different* kind of life rather than more of the last one:
 * 1 is static light, 2 is rhythm, 3 is movement in the image itself. The
 * ember is October's existing accent and no level introduces a colour the
 * product does not already use.
 *
 * ## Media is used, never manufactured
 *
 * Level 3 animates the photograph the subject already has. Discovery's feed
 * carries one `heroUrl` per subject and no array, so a carousel here would
 * mean a detail request per card — an N+1 for decoration. Where a subject has
 * no image, level 3 degrades to level 2's treatment rather than inventing
 * something to move.
 *
 * Everything respects `prefers-reduced-motion`: the light stays, the motion
 * stops.
 */
export function HypeCard({
  level,
  hasImage = true,
  children,
}: {
  readonly level: HypeLevel;
  /** Level 3's drift needs a photograph; without one it behaves as level 2. */
  readonly hasImage?: boolean;
  readonly children: ReactNode;
}) {
  if (level <= 0) return <>{children}</>;
  const moving = level >= 3 && hasImage;

  return (
    <div
      data-testid="hype-card"
      data-level={level}
      className={`group/hype relative h-full rounded-xl ${
        level >= 2 ? "hype-breathe" : ""
      } ${moving ? "hype-hot" : ""}`}
    >
      {/* The edge. One ember ring, stronger as the level rises, drawn outside
          the card so nothing inside it has to change. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-px rounded-xl"
        style={{
          boxShadow:
            level >= 3
              ? "0 0 0 1px rgba(208,154,78,0.55), 0 0 28px -4px rgba(208,154,78,0.42), inset 0 0 36px -14px rgba(208,154,78,0.5)"
              : level === 2
                ? "0 0 0 1px rgba(208,154,78,0.38), 0 0 18px -6px rgba(208,154,78,0.3)"
                : "0 0 0 1px rgba(208,154,78,0.2)",
        }}
      />
      {children}
      <style>{`
        .hype-breathe > [aria-hidden] { animation: hypeBreathe 4.2s ease-in-out infinite; }
        @keyframes hypeBreathe { 0%,100%{opacity:.62} 50%{opacity:1} }
        .hype-hot img { animation: hypeDrift 18s ease-in-out infinite; transform-origin: 50% 45%; }
        @keyframes hypeDrift { 0%,100%{transform:scale(1.02)} 50%{transform:scale(1.11) translateY(-1.5%)} }
        .hype-hot::after {
          content:""; position:absolute; inset:0; border-radius:.75rem; pointer-events:none;
          background:linear-gradient(105deg,transparent 42%,rgba(233,230,218,.13) 50%,transparent 58%);
          background-size:260% 100%; animation: hypeSweep 7s ease-in-out infinite;
        }
        @keyframes hypeSweep { 0%{background-position:160% 0} 55%,100%{background-position:-60% 0} }
        @media (prefers-reduced-motion: reduce) {
          .hype-breathe > [aria-hidden], .hype-hot img, .hype-hot::after { animation: none; }
        }
      `}</style>
    </div>
  );
}
