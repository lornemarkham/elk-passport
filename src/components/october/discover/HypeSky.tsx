"use client";

import Link from "next/link";
import { Check, Heart, Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import type { Hype } from "@/domain/october/hype";
import { useKeeping, type Keepable } from "@/components/october/save/keeping";

/**
 * **The one expression Hype has, and it is only for the sky.**
 *
 * Deliberately not a reusable template with the title swapped. This is what
 * October is allowed to do when a meteor shower is about to peak and the
 * forecast says the sky will be open: **the top of Discover stops being a
 * page header and becomes the thing it is talking about.**
 *
 * A haunt would not get this. A pumpkin patch would not get this. If either
 * ever earns an expression it will be a different one — warmth and texture
 * for the farm, something wrong-feeling for the haunt — written for that
 * subject rather than parameterised out of this. `hypeFor` grants them
 * `mention` precisely so that nobody is tempted to reuse a night sky for a
 * corn maze.
 *
 * ## It is a moment, not a slideshow
 *
 * No beats, no Next. One state, which answers all three questions at once:
 * what it is, why now, and whether tonight is any good — and then gets out of
 * the way. The whole thing is about 220px tall and the lanes start under it.
 *
 * ## It stops once you have chosen
 *
 * Saving flips it in place: the generic recommendation language goes, and what
 * is left is the plain fact of the night. October has stopped pitching,
 * because the thing it was pitching has become a plan. That handoff —
 * Hype to Anticipate — is the point of the transition rather than a nicety.
 */
export function HypeSky({
  hype,
  panels = [],
  thing,
  signedIn,
  initiallySaved,
  detailHref,
}: {
  readonly hype: Hype;
  /** Atlas's own facts, shown only if somebody asks for them. */
  readonly panels?: readonly { label: string; value: string }[];
  readonly thing: Keepable;
  readonly signedIn: boolean;
  readonly initiallySaved: boolean;
  readonly detailHref: string;
}) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  // The same store every other save control reads, so the words and the mark
  // cannot disagree and a save made here is a save made anywhere.
  const { saved, state, toggle } = useKeeping(thing, initiallySaved);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let w = 0;
    let h = 0;
    let stars: { x: number; y: number; r: number; a: number }[] = [];
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      w = element.clientWidth;
      h = element.clientHeight;
      element.width = Math.floor(w * ratio);
      element.height = Math.floor(h * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      stars = Array.from({ length: Math.round((w * h) / 1500) }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        // Denser and brighter toward the top, so it reads as sky rather than
        // as confetti behind some words.
        r: Math.random() < 0.82 ? 0.8 : 1.5,
        a: 0.3 + Math.random() * 0.6,
      }));
    };
    resize();
    window.addEventListener("resize", resize);

    let meteors: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      max: number;
    }[] = [];
    let last = performance.now();
    let since = 1.4;
    let frame = 0;

    const tick = (at: number) => {
      const dt = Math.min((at - last) / 1000, 0.05);
      last = at;
      context.clearRect(0, 0, w, h);

      for (const s of stars) {
        context.globalAlpha = s.a * (1 - s.y / (h * 1.6));
        context.fillStyle = "#e9e6da";
        context.beginPath();
        context.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        context.fill();
      }

      if (!reduced) {
        since += dt;
        // Roughly one a second. Measured against the alternative: at one
        // every two seconds a person glancing at the page for three seconds
        // sees nothing move, and a sky that never moves is wallpaper.
        if (since > 0.9) {
          since = 0;
          const angle = Math.PI * 0.72 + (Math.random() - 0.5) * 0.5;
          const speed = 520 + Math.random() * 380;
          meteors.push({
            x: w * (0.45 + Math.random() * 0.6),
            y: -10,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0,
            max: 0.45 + Math.random() * 0.35,
          });
        }
        for (const m of meteors) {
          m.life += dt;
          const px = m.x;
          const py = m.y;
          m.x += m.vx * dt;
          m.y += m.vy * dt;
          const fade = 1 - m.life / m.max;
          if (fade <= 0) continue;
          context.globalAlpha = Math.max(0, fade) * 0.95;
          context.strokeStyle = "#f3efe4";
          context.lineWidth = 1.5;
          context.beginPath();
          context.moveTo(px, py);
          context.lineTo(m.x, m.y);
          context.stroke();
        }
        meteors = meteors.filter((m) => m.life < m.max && m.y < h + 60);
      }

      context.globalAlpha = 1;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <section
      data-testid="hype-sky"
      data-level={hype.level}
      data-saved={saved ? "true" : "false"}
      // **Full bleed, and first.** The previous version was a 267px rounded
      // card sitting in the page flow under the header — tidy, and completely
      // unnoticeable. A takeover has to arrive before the page does: edge to
      // edge, most of the first screen, with "What's on" emerging underneath
      // it rather than above it.
      className="relative flex min-h-[24rem] w-full flex-col justify-start overflow-hidden bg-[#05070e] sm:min-h-[56vh]"
    >
      <canvas
        ref={canvas}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      {/* The ground the words sit on, so the type never fights a meteor. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#0c0a0c] via-[#05070e]/90 to-transparent"
      />

      <div className="relative mx-auto w-full max-w-6xl px-4 pt-8 pb-10 sm:px-6 sm:pt-12 sm:pb-12">
        {saved ? (
          // Hype → Anticipate. The pitch is gone; the plan remains.
          <p
            data-testid="hype-eyebrow"
            className="text-[11px] font-medium tracking-[0.2em] text-[#9fb4d8] uppercase"
          >
            In your October
          </p>
        ) : (
          <p
            data-testid="hype-eyebrow"
            className="text-[11px] font-medium tracking-[0.2em] text-[#9fb4d8] uppercase"
          >
            October is watching this one
          </p>
        )}

        <h2 className="font-heading mt-2 max-w-2xl text-4xl leading-[1.05] tracking-tight text-[#f3efe4] sm:text-6xl">
          {hype.subject.title}
        </h2>

        <p
          data-testid="hype-because"
          className="mt-3 max-w-lg text-lg leading-relaxed text-[#e9e6da]/80"
        >
          {saved ? hype.now : `${hype.now} ${hype.because}`}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          {signedIn ? (
            <button
              type="button"
              data-testid="hype-keep"
              data-saved={saved ? "true" : "false"}
              aria-pressed={saved}
              disabled={state === "saving"}
              onClick={() => void toggle()}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm transition-colors disabled:opacity-60 ${
                saved
                  ? "border-[#9fb4d8]/40 bg-[#9fb4d8]/10 text-[#e9e6da]"
                  : "border-[#e9e6da]/20 text-[#e9e6da]/80 hover:border-[#9fb4d8]/50 hover:text-[#f3efe4]"
              }`}
            >
              {state === "saving" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : saved ? (
                <Check className="h-4 w-4" />
              ) : (
                <Heart className="h-4 w-4" />
              )}
              {saved ? "Saved" : "Put it in my October"}
            </button>
          ) : (
            <a
              href={`/auth?next=${encodeURIComponent("/october/discover")}`}
              data-testid="hype-signed-out"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#e9e6da]/20 px-4 text-sm text-[#e9e6da]/80"
            >
              <Heart className="h-4 w-4" />
              Sign in to keep it
            </a>
          )}
          {state === "failed" ? (
            <span className="text-xs text-[#d09a4e]">didn&apos;t save</span>
          ) : null}
          <Link
            href={detailHref}
            data-testid="hype-details"
            className="min-h-11 text-sm text-[#e9e6da]/45 underline-offset-4 hover:text-[#e9e6da]/80 hover:underline"
          >
            What it actually is →
          </Link>
        </div>

        {/* **Optional, and optional is the design.** The quick experience made
            its panels mandatory — text, Next, text, Next — and that is the
            thing we learned not to do. Here the hero is complete on its own
            and this is a drawer: nobody has to open it, and anybody who wants
            the detail can have it without leaving the page. Every line is a
            fact Atlas holds, labelled with Atlas's own label. */}
        {panels.length > 0 ? (
          <details data-testid="hype-panels" className="group/panels mt-6">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm text-[#9fb4d8] underline-offset-4 hover:underline">
              What you&apos;d actually be looking at
              <span
                aria-hidden
                className="transition-transform group-open/panels:rotate-90"
              >
                ›
              </span>
            </summary>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {panels.map((panel) => (
                <li
                  key={panel.label}
                  data-testid="hype-panel"
                  className="rounded-lg border border-[#9fb4d8]/15 bg-[#0a0e1a]/70 p-3"
                >
                  <p className="text-[10px] tracking-[0.14em] text-[#9fb4d8]/70 uppercase">
                    {panel.label}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-[#e9e6da]/80">
                    {panel.value}
                  </p>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </section>
  );
}
