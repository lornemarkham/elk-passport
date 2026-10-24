"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Footprints } from "lucide-react";
import { PlanPhoto } from "@/components/hockey/VenueCard";
import { useUsableImages } from "@/components/conference/usableImages";
import type { DayEntry } from "@/domain/conference/agenda";
import { freeTime, walkBudget } from "@/domain/conference/moments";
import type { ExplorePlace } from "@/domain/conference-explore/explore";
import type { ExploreView } from "@/lib/conference-explore/places";

/**
 * **"You have 29 minutes. Need a coffee before the wrap-up?"** — only when
 * the published agenda actually leaves a gap, and only places Explore
 * measured within a walk that fits it, there and back (`walkBudget`). After
 * the day's last line: "Vancouver's still awake," with drinks and dinner a
 * short walk away. Real Atlas places, real straight-line walks; nothing
 * about opening hours is claimed, because Atlas doesn't hold them.
 */
export function FreeTimePicks({
  conferenceId,
  entries,
  timeZone,
  now,
  city = "Vancouver",
}: {
  conferenceId: string;
  entries: readonly DayEntry[];
  timeZone: string;
  now: Date;
  city?: string;
}) {
  const free = freeTime(entries, timeZone, now);
  const [view, setView] = useState<ExploreView | null>(null);
  const wanted = free !== null;
  useEffect(() => {
    if (!wanted || view) return;
    let live = true;
    fetch(`/api/conferences/${conferenceId}/explore`)
      .then((r) => r.json())
      .then((j) => live && setView((j.explore as ExploreView) ?? null))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [conferenceId, wanted, view]);

  const budget = free?.kind === "gap" ? walkBudget(free.minutes) : 15;
  const pool: ExplorePlace[] =
    !free || !view || budget === null
      ? []
      : free.kind === "gap"
        ? view.shelves.coffee
        : [...view.shelves.drinks, ...view.shelves.restaurants];
  const fits = pool
    .filter((p) => p.walkMinutes <= (budget ?? 0))
    .sort(
      (a, b) =>
        Number(!!b.photo) - Number(!!a.photo) || a.walkMinutes - b.walkMinutes,
    )
    .slice(0, 3);
  const usable = useUsableImages(fits.map((p) => p.photo?.url));

  if (!free || budget === null || (view && !fits.length)) return null;
  return (
    <section
      className="border-cf-line rounded-3xl border bg-white p-5"
      data-testid="free-time"
    >
      <p className="cf-eyebrow text-cf-sage">
        {free.kind === "gap"
          ? `You have ${free.minutes} minutes`
          : "After the sessions"}
      </p>
      <p className="cf-serif text-cf-ink mt-1 text-[20px] leading-snug">
        {free.kind === "gap"
          ? `Need a coffee before ${free.until.title}?`
          : `${city}'s still awake.`}
      </p>
      <p className="text-cf-slate mt-1 text-[13px]">
        {free.kind === "gap"
          ? `Within a ${budget}-minute walk, so you're back in time.`
          : "A short walk from the venue."}
      </p>
      <ul className="mt-4 space-y-2">
        {(view ? fits : [0, 1]).map((p) =>
          typeof p === "number" ? (
            <li key={p} className="bg-cf-sand h-14 animate-pulse rounded-xl" />
          ) : (
            <li key={p.id}>
              <Link
                href={
                  p.from === "atlas"
                    ? `/passport/${encodeURIComponent(p.id)}`
                    : `/conferences/${conferenceId}/discover`
                }
                className="hover:bg-cf-paper -mx-2 flex min-h-14 items-center gap-3 rounded-xl px-2 py-1.5"
              >
                <span className="bg-cf-sand relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                  {p.photo && usable?.has(p.photo.url) ? (
                    <PlanPhoto
                      url={p.photo.url}
                      className="absolute inset-0 h-full w-full object-cover"
                      fallback={null}
                    />
                  ) : (
                    <span className="cf-serif text-cf-slate absolute inset-0 grid place-items-center text-[18px]">
                      {p.name[0]}
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-cf-ink block truncate text-[15px] font-semibold">
                    {p.name}
                  </span>
                  <span className="text-cf-slate flex items-center gap-1 text-[12px]">
                    <Footprints
                      aria-hidden="true"
                      className="h-3 w-3"
                      strokeWidth={1.8}
                    />
                    {p.walkMinutes}+ min walk
                    {p.subtype ? ` · ${p.subtype}` : ""}
                  </span>
                </span>
              </Link>
            </li>
          ),
        )}
      </ul>
      <Link
        href={`/conferences/${conferenceId}/discover`}
        className="text-cf-ink mt-3 inline-flex min-h-10 items-center text-[13px] font-semibold underline-offset-4 hover:underline"
      >
        More in Explore →
      </Link>
    </section>
  );
}
