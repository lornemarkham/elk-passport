"use client";

import { AvatarRow } from "./atoms";
import { relativeTime } from "../core/phase";
import type { LiveExperience } from "../core/engine";
import type { ExperienceDefinition } from "../core/types";

const dayFormat = new Intl.DateTimeFormat("en-CA", {
  weekday: "long",
  month: "short",
  day: "numeric",
});
const timeFormat = new Intl.DateTimeFormat("en-CA", {
  hour: "numeric",
  minute: "2-digit",
});

/**
 * **The poster.**
 *
 * Not a page header. The entire product test — "would someone invited through
 * Slack, who has never heard of Passport, care?" — is decided in the first
 * screenful, before anyone scrolls, and this is the whole first screenful.
 *
 * So it carries exactly four things and nothing else: what this is, when it
 * is, who is coming, and what the page wants from you *right now*. The last
 * one is the phase headline, which is the only part that changes, and it is
 * the reason the page reads as alive rather than as a listing.
 */
export function Poster({
  definition,
  live,
}: {
  definition: ExperienceDefinition;
  live: LiveExperience | null;
}) {
  const anchor = new Date(definition.anchorAt);
  const here = live?.participants.filter((p) => p.present) ?? [];

  return (
    <header className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background: `radial-gradient(120% 100% at 20% 0%, ${definition.palette[0]} 0%, ${definition.palette[1]} 55%, oklch(0.16 0.02 260) 100%)`,
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.5]"
        style={{
          background:
            "linear-gradient(to bottom, transparent 40%, oklch(0.14 0.015 260) 100%)",
        }}
      />

      <div className="mx-auto max-w-2xl px-5 pt-12 pb-8 sm:pt-16">
        <p className="flex items-center gap-2 text-[12.5px] font-medium tracking-[0.14em] text-white/60 uppercase">
          <span className="text-base">{definition.emoji}</span>
          {definition.kicker}
        </p>

        <h1 className="font-heading mt-3 text-[clamp(2.4rem,10vw,4rem)] leading-[0.95] font-bold tracking-tight text-white">
          {definition.title}
        </h1>
        <p className="mt-2.5 text-[19px] leading-snug text-white/80">
          {definition.subtitle}
        </p>

        <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-[16px] font-semibold text-white">
            {dayFormat.format(anchor)} · {timeFormat.format(anchor)}
          </p>
          {live && (
            <p className="text-[15px] text-white/60">
              {relativeTime(anchor, live.now)}
            </p>
          )}
        </div>
        {definition.whereLine && (
          <p className="mt-0.5 text-[14px] text-white/50">
            {definition.whereLine}
          </p>
        )}

        {live && here.length > 0 && (
          <div className="mt-6 flex items-center gap-2.5">
            <AvatarRow people={here} size={30} />
            <span className="text-[13.5px] text-white/60">
              {here.length} in
              {live.participants.length > here.length &&
                ` · ${live.participants.length - here.length} yet to open it`}
            </span>
          </div>
        )}

        {live && (
          <p className="mt-7 border-t border-white/15 pt-5 text-[17px] leading-snug font-medium text-white/90">
            {live.phase.headline}
          </p>
        )}
      </div>
    </header>
  );
}
