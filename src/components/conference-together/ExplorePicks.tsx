"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PlanPhoto } from "@/components/hockey/VenueCard";
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
        const take = (s: keyof ExploreView["shelves"], n: number) =>
          v.shelves[s].filter((p) => p.photo).slice(0, n);
        setPicks([
          ...take("coffee", 1),
          ...take("restaurants", 2),
          ...take("waterfront", 1),
          ...take("sights", 1),
          ...take("drinks", 1),
        ]);
      })
      .catch(() => live && setPicks([]));
    return () => {
      live = false;
    };
  }, [conferenceId]);
  if (picks && !picks.length) return null;
  return (
    <div className="-mx-5 overflow-x-auto px-5" data-testid="explore-picks">
      <ul className="flex gap-3">
        {(picks ?? []).map((p) => (
          <li
            key={p.id}
            className="w-[220px] shrink-0 overflow-hidden rounded-2xl border border-black/10"
          >
            <Link
              href={`/conferences/${conferenceId}/discover`}
              className="block"
            >
              <div className="aspect-[4/3] bg-black/5">
                <PlanPhoto
                  url={p.photo?.url}
                  className="h-full w-full object-cover"
                  fallback={
                    <span className="flex h-full items-center justify-center text-[32px]">
                      📍
                    </span>
                  }
                />
              </div>
              <span className="block truncate px-3 pt-2 text-[15px] font-bold">
                {p.name}
              </span>
              <span className="block px-3 pb-3 text-[13px] text-black/55">
                {p.subtype ?? ""} · {p.walkMinutes}+ min walk
              </span>
            </Link>
          </li>
        ))}
        {!picks
          ? [0, 1, 2].map((i) => (
              <li
                key={i}
                className="h-[230px] w-[220px] shrink-0 animate-pulse rounded-2xl bg-black/5"
              />
            ))
          : null}
      </ul>
    </div>
  );
}
