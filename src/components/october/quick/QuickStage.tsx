"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Beat } from "@/domain/october/draconids";
import { KeepOnCard } from "@/components/october/save/KeepOnCard";
import type { Keepable } from "@/components/october/save/keeping";
import { StarField } from "./StarField";

/**
 * **Fifteen seconds that make somebody want to go outside.**
 *
 * One beat on screen at a time, advanced by tapping anywhere — the gesture a
 * phone already teaches. Each beat is a line, occasionally a quieter second
 * line, and the Atlas fact that backs it. Never a paragraph: if a beat needs a
 * paragraph it is reference material and belongs on the detail page, which is
 * one tap away at the end and never removed.
 *
 * ## Why tap-anywhere rather than a carousel
 *
 * A carousel has arrows, and arrows are a thing to aim at. This is meant to be
 * read with a thumb while standing up. The whole surface advances, the left
 * edge goes back, arrow keys work for a keyboard, and Escape leaves — so
 * nothing about it is only reachable by pointing accurately.
 */
export interface YourNight {
  /** The town this is about. Absent when October does not know. */
  readonly place?: string;
  /** "6:22 PM". Always available — it is arithmetic. */
  readonly darkAt?: string;
  /** 0–1 of the moon lit on the best night. */
  readonly moonLit?: number;
  /** October's read of the sky, where a forecast reaches that night. */
  readonly sky?: { readonly line: string; readonly facts?: string };
  /** Attribution for the sky line, where there is one. */
  readonly source?: string;
  /** True when the sky line came from the dev harness. */
  readonly simulated?: boolean;
}

export function QuickStage({
  beats,
  thing,
  signedIn,
  initiallySaved,
  detailHref,
  yourNight,
}: {
  readonly beats: readonly Beat[];
  readonly thing: Keepable;
  readonly signedIn: boolean;
  readonly initiallySaved: boolean;
  readonly detailHref: string;
  readonly yourNight: YourNight;
}) {
  const [at, setAt] = useState(0);
  const last = beats.length - 1;
  const stage = useRef<HTMLDivElement | null>(null);

  const go = useCallback(
    (delta: number) => setAt((n) => Math.min(last, Math.max(0, n + delta))),
    [last],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === " ") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const beat = beats[at]!;
  const onYours = beat.art === "yours";
  // The radiant moves to where the diagram puts it, so meteors on that beat
  // genuinely come out of the point being described.
  const radiant = beat.art === "radiant" ? { x: 0.5, y: 0.38 } : undefined;

  return (
    <div
      ref={stage}
      data-testid="quick-stage"
      className="relative min-h-screen overflow-hidden bg-[#06070c] text-[#e9e6da] select-none"
      onClick={(event) => {
        // The left eighth goes back; everything else goes on. Controls at the
        // bottom stop propagation themselves.
        const box = stage.current?.getBoundingClientRect();
        if (!box) return;
        go(event.clientX - box.left < box.width / 8 ? -1 : 1);
      }}
    >
      <StarField radiant={radiant} moonWash={yourNight.moonLit ?? 0} />

      {/* Progress. Seven marks, so the length of the thing is honest. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex gap-1 p-3">
        {beats.map((b, i) => (
          <span
            key={b.id}
            data-testid="beat-mark"
            data-on={i <= at ? "true" : "false"}
            className={`h-0.5 flex-1 rounded-full transition-colors duration-500 ${
              i <= at ? "bg-[#e9e6da]/70" : "bg-[#e9e6da]/15"
            }`}
          />
        ))}
      </div>

      <Link
        href="/october/discover"
        onClick={(event) => event.stopPropagation()}
        className="absolute top-5 right-4 z-20 min-h-11 text-xs text-[#e9e6da]/40 underline-offset-4 hover:text-[#e9e6da]/80"
      >
        Close
      </Link>

      {/* Scrollable, because the last beat carries the save and the link to
          the details and those must be reachable on a short phone. The sky
          behind it stays put. */}
      <div className="relative z-10 mx-auto flex max-h-screen min-h-screen max-w-lg flex-col justify-center overflow-y-auto px-6 py-16">
        {beat.art === "radiant" ? <Radiant /> : null}

        <div key={beat.id} className="animate-[fadeUp_600ms_ease-out]">
          <p
            data-testid="beat-line"
            className="font-heading text-3xl leading-tight tracking-tight text-[#f3efe4] sm:text-4xl"
          >
            {beat.line}
          </p>
          {beat.under ? (
            <p className="mt-3 text-base leading-relaxed text-[#e9e6da]/60">
              {beat.under}
            </p>
          ) : null}

          {/* Atlas's own words, marked as Atlas's. The framing above is
              Passport's voice; this is evidence. */}
          {beat.fact ? (
            <div
              data-testid="beat-fact"
              className="mt-6 border-l-2 border-[#d09a4e]/40 pl-4"
            >
              <p className="text-[10px] tracking-[0.14em] text-[#e9e6da]/35 uppercase">
                {beat.fact.label}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-[#e9e6da]/80">
                {beat.fact.value}
              </p>
            </div>
          ) : null}

          {onYours ? <YourNightPanel night={yourNight} /> : null}
        </div>

        {/* The end: keep it, or go and research it. Both, never one. */}
        {onYours ? (
          <div
            className="mt-10 flex flex-wrap items-center gap-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2 rounded-full border border-[#e9e6da]/15 py-1 pr-4 pl-1">
              <KeepOnCard
                thing={thing}
                initiallySaved={initiallySaved}
                signedIn={signedIn}
                returnTo="/quick/draconids"
              />
              <span className="text-sm text-[#e9e6da]/70">
                Put it in my October
              </span>
            </div>
            <Link
              href={detailHref}
              data-testid="quick-to-details"
              className="min-h-11 text-sm text-[#e9e6da]/45 underline-offset-4 hover:text-[#e9e6da]/80 hover:underline"
            >
              All the details →
            </Link>
          </div>
        ) : (
          <p className="mt-10 text-xs tracking-wider text-[#e9e6da]/25 uppercase">
            Tap to go on
          </p>
        )}
      </div>

      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        @media (prefers-reduced-motion: reduce){.animate-\\[fadeUp_600ms_ease-out\\]{animation:none}}`}</style>
    </div>
  );
}

/**
 * **What your night actually looks like**, which is the only beat that is
 * about the person rather than the shower.
 *
 * Darkness is always here because it is arithmetic. The sky is here only when
 * a forecast reaches the night, and when it is poor it says so — the point of
 * the whole sequence collapses if this beat flatters the weather.
 */
function YourNightPanel({ night }: { readonly night: YourNight }) {
  const moon =
    night.moonLit === undefined
      ? undefined
      : night.moonLit < 0.2
        ? "Almost no moon"
        : night.moonLit > 0.75
          ? "A bright moon, which will wash out all but the best of them"
          : "A half-lit moon";

  return (
    <div data-testid="your-night" className="mt-6 flex flex-col gap-2">
      {night.place ? (
        <p className="text-sm text-[#e9e6da]/45">{night.place}</p>
      ) : (
        <p className="text-sm text-[#e9e6da]/45">
          <Link
            href="/october/area"
            onClick={(event) => event.stopPropagation()}
            className="text-[#d09a4e] underline-offset-4 hover:underline"
          >
            Tell October where you are
          </Link>{" "}
          for the rest of this.
        </p>
      )}

      {night.darkAt ? (
        <p data-testid="your-dark" className="text-lg text-[#f3efe4]">
          Dark by {night.darkAt}.
        </p>
      ) : null}

      {moon ? <p className="text-base text-[#e9e6da]/75">{moon}.</p> : null}

      {night.sky ? (
        <p data-testid="your-sky" className="text-base text-[#d09a4e]">
          {night.sky.line}
          {night.sky.facts ? (
            <span className="block text-sm text-[#e9e6da]/40">
              {night.sky.facts}
            </span>
          ) : null}
        </p>
      ) : (
        <p className="text-sm text-[#e9e6da]/35">
          No forecast reaches that night yet. Check back closer to it.
        </p>
      )}

      {night.source ? (
        <p
          className={`text-[11px] ${
            night.simulated
              ? "font-medium tracking-wider text-[#ff6b6b] uppercase"
              : "text-[#e9e6da]/25"
          }`}
        >
          {night.source}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The radiant, drawn as what it is: a point things appear to come out of.
 *
 * **Not a star chart.** Drawing Draco accurately would be a claim about where
 * stars are, and Atlas holds no such claim — it says the radiant is "near the
 * constellation Draco the Dragon" and that is all this illustrates.
 */
function Radiant() {
  return (
    <svg
      viewBox="0 0 200 104"
      aria-hidden
      // Capped so the beat's own words still fit above the fold on a phone;
      // the diagram is support for the line, not the point of the screen.
      className="mx-auto mb-6 w-full max-w-[220px]"
    >
      {Array.from({ length: 9 }).map((_, i) => {
        const angle = (i / 9) * Math.PI * 2 + 0.25;
        const inner = 12;
        const outer = 34 + (i % 3) * 10;
        return (
          <line
            key={i}
            x1={88 + Math.cos(angle) * inner}
            y1={52 + Math.sin(angle) * inner}
            x2={88 + Math.cos(angle) * outer}
            y2={52 + Math.sin(angle) * outer}
            stroke="#e9e6da"
            strokeOpacity={0.3}
            strokeWidth={1}
            strokeLinecap="round"
          />
        );
      })}
      <circle cx={88} cy={52} r={3} fill="#d09a4e" />
      {/* Beside the point rather than under it — under it is where the rays
          are, and a label crossed out by a line reads as a mistake. */}
      <line
        x1={97}
        y1={46}
        x2={136}
        y2={26}
        stroke="#d09a4e"
        strokeOpacity={0.5}
        strokeWidth={1}
      />
      <text
        x={140}
        y={29}
        fontSize={10}
        letterSpacing={2.5}
        fill="#d09a4e"
        opacity={0.85}
      >
        DRACO
      </text>
    </svg>
  );
}
