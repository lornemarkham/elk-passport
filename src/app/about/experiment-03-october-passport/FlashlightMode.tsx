"use client";

import { useState } from "react";
import { Flashlight } from "lucide-react";
import { FLASHLIGHT_INTRO, FLASHLIGHT_ITEMS } from "./content";

/** Fixed, deterministic positions — not random per render, the same SSR-safety discipline every positioned element in this project follows. Nine spots, spread out so the beam has to actually move to find them all. */
const POSITIONS = [
  { top: "15%", left: "12%" },
  { top: "70%", left: "8%" },
  { top: "25%", left: "50%" },
  { top: "80%", left: "45%" },
  { top: "10%", left: "82%" },
  { top: "55%", left: "78%" },
  { top: "40%", left: "20%" },
  { top: "60%", left: "60%" },
  { top: "85%", left: "88%" },
];

/**
 * Flashlight Mode, redesigned (Phase 7.16) into a real find-game. Same
 * pointer-tracked radial-gradient mask as before, but now nine real
 * emoji are hidden under it, each a real click target the moment the
 * beam reveals it. "Discovery first, story second," per the brief: no
 * fragment text appears until its item is found, and the assembled story
 * strip only renders once at least one has been.
 */
export function FlashlightMode() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [found, setFound] = useState<Set<string>>(new Set());
  const [justFound, setJustFound] = useState<string | null>(null);

  function findItem(id: string, fragment: string) {
    if (found.has(id)) return;
    setFound((prev) => new Set(prev).add(id));
    setJustFound(fragment);
    window.setTimeout(() => setJustFound(null), 2600);
  }

  const foundFragments = FLASHLIGHT_ITEMS.filter((item) => found.has(item.id));

  return (
    <div className="flex flex-col gap-4">
      <div
        className="relative h-[380px] overflow-hidden rounded-2xl border border-current/15 bg-[#0a0704]"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
        onMouseLeave={() => setPos(null)}
        onTouchMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const touch = e.touches[0];
          if (!touch) return;
          setPos({ x: touch.clientX - rect.left, y: touch.clientY - rect.top });
        }}
      >
        <p className="pointer-events-none absolute inset-x-0 top-3 z-10 flex items-center justify-center gap-2 text-center text-xs tracking-widest text-[#f3ead9] uppercase opacity-40">
          <Flashlight className="h-3.5 w-3.5" /> {FLASHLIGHT_INTRO}
        </p>

        {FLASHLIGHT_ITEMS.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onClick={() => findItem(item.id, item.fragment)}
            className={`absolute z-0 text-2xl transition-opacity ${found.has(item.id) ? "opacity-30" : "opacity-90 hover:scale-110"}`}
            style={POSITIONS[i]}
            aria-label={`Find ${item.label}`}
          >
            {item.emoji}
          </button>
        ))}

        {/* The dark mask */}
        <div
          className="pointer-events-none absolute inset-0 z-[5] transition-[background] duration-75"
          style={{
            background: pos
              ? `radial-gradient(circle at ${pos.x}px ${pos.y}px, transparent 0px, transparent 70px, rgba(10,7,4,0.98) 170px)`
              : "rgba(10,7,4,0.98)",
          }}
        />

        {justFound && (
          <p className="pointer-events-none absolute inset-x-0 bottom-4 z-10 px-6 text-center text-sm text-[#f3ead9] italic">
            &ldquo;{justFound}&rdquo;
          </p>
        )}

        <p className="pointer-events-none absolute top-3 right-3 z-10 text-xs text-[#f3ead9] opacity-50">
          {found.size} / {FLASHLIGHT_ITEMS.length} found
        </p>
      </div>

      {foundFragments.length > 0 && (
        <div className="rounded-xl border border-current/10 p-4 text-sm italic opacity-70">
          <p className="mb-1.5 text-xs font-semibold tracking-wide uppercase not-italic opacity-50">
            The story so far
          </p>
          {foundFragments.map((item) => item.fragment).join(" ")}
        </div>
      )}
    </div>
  );
}
