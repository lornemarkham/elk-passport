"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PlanPhoto } from "@/components/hockey/VenueCard";
import { useUsableImages } from "@/components/conference/usableImages";
import type { ExplorePlace } from "@/domain/conference-explore/explore";
import type { ExploreView } from "@/lib/conference-explore/places";

/**
 * A few photographed places near the venue, on the home page: the coffee,
 * the lunch, the walk. Loaded after the page, so a slow Atlas costs nothing
 * but this row.
 */
export function ExplorePicks({ conferenceId }: { conferenceId: string }) {
  const [picks, setPicks] = useState<ExplorePlace[] | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/conferences/${conferenceId}/explore`)
      .then((r) => r.json())
      .then((j) => {
        const v = j.explore as ExploreView | undefined;
        if (!live || !v) return;
        // More than are shown: only places whose photograph works make the row.
        const take = (s: keyof ExploreView["shelves"], n: number) =>
          v.shelves[s].filter((p) => p.photo).slice(0, n);
        setPicks([
          ...take("waterfront", 2),
          ...take("sights", 3),
          ...take("restaurants", 5),
          ...take("coffee", 2),
          ...take("drinks", 3),
        ]);
      })
      .catch(() => live && setPicks([]));
    return () => {
      live = false;
    };
  }, [conferenceId]);
  const usable = useUsableImages((picks ?? []).map((p) => p.photo?.url));
  const shown = usable
    ? (picks ?? [])
        .filter((p) => p.photo && usable.has(p.photo.url))
        .slice(0, 5)
    : null;
  if ((picks && !picks.length) || (shown && !shown.length)) return null;
  return (
    <ul
      className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:grid-rows-2 sm:overflow-visible sm:px-0"
      data-testid="explore-picks"
    >
      {(shown ?? []).map((p, i) => (
        <li
          key={p.id}
          className={`group bg-cf-sand relative w-[240px] shrink-0 snap-start overflow-hidden rounded-2xl sm:w-auto ${
            i === 0 ? "sm:col-span-2 sm:row-span-2" : ""
          }`}
        >
          <Link
            href={`/conferences/${conferenceId}/discover`}
            className="block h-full"
          >
            <div
              className={`relative h-full ${i === 0 ? "aspect-[4/3] sm:aspect-auto sm:min-h-[340px]" : "aspect-[4/3]"}`}
            >
              <PlanPhoto
                url={p.photo?.url}
                className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
                fallback={<span className="bg-cf-sand absolute inset-0" />}
              />
              <span className="absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(16,17,19,0.78)_100%)]" />
              <span className="absolute inset-x-0 bottom-0 p-4 text-white">
                <span
                  className={`cf-serif block leading-tight ${i === 0 ? "text-[22px] sm:text-[26px]" : "text-[16px]"}`}
                >
                  {p.name}
                </span>
                <span className="mt-1 block text-[12px] text-white/75">
                  {p.subtype
                    ? `${p.subtype[0]!.toUpperCase()}${p.subtype.slice(1)} · `
                    : ""}
                  {p.walkMinutes}+ min walk
                </span>
              </span>
            </div>
          </Link>
        </li>
      ))}
      {!shown
        ? [0, 1, 2].map((i) => (
            <li
              key={i}
              className={`bg-cf-sand aspect-[4/3] w-[240px] shrink-0 animate-pulse rounded-2xl sm:w-auto ${i === 0 ? "sm:col-span-2 sm:row-span-2 sm:aspect-auto" : ""}`}
            />
          ))
        : null}
    </ul>
  );
}
