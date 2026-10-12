"use client";

import { useEffect, useRef } from "react";
import { useMedia } from "./useMedia";

/**
 * **Underneath the interface.**
 *
 * Two things live out here, both of them below the content and neither of them
 * ever acknowledged by it.
 *
 * ## The numbers
 *
 * 10, 12 and 31 sit near the edges of the viewport at about three percent
 * opacity and drift at roughly a pixel every two seconds. That is slow enough
 * to be invisible while you are watching and obvious if you look away and look
 * back — which is the entire effect being aimed for. They are not decoration
 * and they never animate *at* you.
 *
 * ## The light
 *
 * On a pointer device a very large, very dim warm mass follows the cursor at a
 * long lag, behind everything. It is wrong on purpose: it lights nothing, it
 * arrives late, and it is subtle enough that the honest reaction is *did that
 * move?* rather than *look, a spotlight*. Touch devices never get it — a
 * finger is not a light source, and faking one on a phone is the tell.
 */

const MARKS = [
  { n: "10", x: 6, y: 18, drift: [1, 0.6] },
  { n: "31", x: 88, y: 72, drift: [-0.7, -1] },
  { n: "12", x: 14, y: 81, drift: [0.5, -0.8] },
  { n: "10", x: 79, y: 12, drift: [-1, 0.9] },
] as const;

export function Ambient({ reduced }: { readonly reduced: boolean }) {
  const glow = useRef<HTMLDivElement | null>(null);
  const fine = useMedia("(pointer: fine)");

  useEffect(() => {
    if (!fine || reduced) return;
    const el = glow.current;
    if (!el) return;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let cx = x;
    let cy = y;
    let raf = 0;
    const move = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
    };
    const frame = () => {
      // A long lag. The light is always arriving from somewhere it has been.
      cx += (x - cx) * 0.014;
      cy += (y - cy) * 0.014;
      el.style.transform = `translate3d(${cx - 340}px, ${cy - 340}px, 0)`;
      raf = requestAnimationFrame(frame);
    };
    window.addEventListener("pointermove", move, { passive: true });
    raf = requestAnimationFrame(frame);
    return () => {
      window.removeEventListener("pointermove", move);
      cancelAnimationFrame(raf);
    };
  }, [fine, reduced]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <style>{`
        @keyframes fb-drift-a { from { transform: translate(0,0) } to { transform: translate(38px, 22px) } }
        @keyframes fb-drift-b { from { transform: translate(0,0) } to { transform: translate(-26px, -34px) } }
        @keyframes fb-drift-c { from { transform: translate(0,0) } to { transform: translate(19px, -30px) } }
        @keyframes fb-drift-d { from { transform: translate(0,0) } to { transform: translate(-34px, 31px) } }
        @media (prefers-reduced-motion: reduce) { .fb-mark { animation: none !important } }
      `}</style>

      {fine && !reduced ? (
        <div
          ref={glow}
          className="absolute top-0 left-0 h-[680px] w-[680px] rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, rgba(255,186,110,0.055), rgba(255,150,60,0.018) 55%, transparent 72%)",
          }}
        />
      ) : null}

      {MARKS.map((m, i) => (
        <span
          key={i}
          className="fb-mark font-heading absolute text-[19vmin] leading-none text-[#e9e6da] select-none"
          style={{
            left: `${m.x}%`,
            top: `${m.y}%`,
            opacity: 0.032,
            animation: `fb-drift-${"abcd"[i]} ${74 + i * 11}s ease-in-out infinite alternate`,
          }}
        >
          {m.n}
        </span>
      ))}
    </div>
  );
}
