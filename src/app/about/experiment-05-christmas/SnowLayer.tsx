"use client";

import { useMemo } from "react";

const FLAKE_COUNT = 45;

/** Deterministic per-flake positions, seeded from the flake's own index — not `Math.random()` per render, the same SSR-safety discipline every positioned/ambient element in this project follows (see `october-passport/AmbientLayer.tsx`'s `seed()`). */
function seed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  return h;
}

/**
 * Real, generated snowfall — ported from the original standalone
 * `christmas-passport.html` prototype's vanilla-JS snow layer into a
 * proper deterministic React version. Purely decorative, always-on,
 * `pointer-events-none`.
 */
export function SnowLayer() {
  const flakes = useMemo(
    () =>
      Array.from({ length: FLAKE_COUNT }, (_, i) => ({
        left: seed(`left-${i}`) % 100,
        duration: 10 + (seed(`dur-${i}`) % 12),
        delay: seed(`delay-${i}`) % 15,
        size: 0.5 + (seed(`size-${i}`) % 60) / 100,
        drift: (seed(`drift-${i}`) % 120) - 60,
      })),
    [],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      <style>{`
        @keyframes christmas-snow-fall {
          to { transform: translateY(110vh) translateX(var(--drift, 0px)); }
        }
      `}</style>
      {flakes.map((flake, i) => (
        <span
          key={i}
          className="absolute -top-[5vh] text-white opacity-75"
          style={
            {
              left: `${flake.left}vw`,
              fontSize: `${flake.size}rem`,
              "--drift": `${flake.drift}px`,
              animation: `christmas-snow-fall ${flake.duration}s linear ${flake.delay}s infinite`,
            } as React.CSSProperties
          }
        >
          ❄
        </span>
      ))}
    </div>
  );
}
