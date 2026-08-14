import { Star } from "lucide-react";
import type { PlaceSectionProps } from "./types";

/**
 * Phase 7.6 — rebuilt as a featured, image-led moment: the one section on
 * the page that gets the largest visual treatment, deliberately, because
 * "what shouldn't I miss" is the section closest to the page's whole
 * emotional job. Reuses `place.imageUrl` — the one real photo Atlas has —
 * rather than inventing per-highlight imagery Atlas doesn't have; still
 * reads `place.activities` as the exact same source of truth "Perfect
 * For" reads lower on the page, just reframed larger and editorially
 * instead of as a plain tag cloud (the same "one fact, two decision
 * framings" pattern this page has used since Phase 7.5).
 *
 * Returns `null` when there's no real activity list — Phase 7.6's rule:
 * omit, don't apologize.
 *
 * **Milestone 0, 2026-08-12:** stopped rendering the description's first
 * sentence as an intro line. `PlaceOverview` already prints the full
 * description a few sections below, so on the benchmark entity this
 * section was reprinting text the reader had just been shown — the
 * duplication documented in
 * `project-management/big-white-page-gap-analysis.md` §3. The section
 * keeps the one thing that is genuinely its own job (the featured,
 * image-led framing of what not to miss) and now falls silent when
 * Atlas has no activity-level evidence to feature, rather than padding
 * itself with borrowed prose.
 */
export function PlaceDontMiss({ place }: PlaceSectionProps) {
  const activities = place.activities?.filter((a) => a.trim()) ?? [];

  if (activities.length === 0) return null;

  return (
    <section className="flex flex-col gap-5">
      {place.imageUrl && (
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element -- external source image, no next/image domain config for arbitrary sources */}
          <img
            src={place.imageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <p className="absolute bottom-4 left-5 text-lg font-semibold text-white sm:text-xl">
            Don&apos;t leave without...
          </p>
        </div>
      )}

      {!place.imageUrl && (
        <p className="text-lg font-semibold sm:text-xl">
          Don&apos;t leave without...
        </p>
      )}

      {activities.length > 0 && (
        <ul className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {activities.map((activity) => (
            <li
              key={activity}
              className="flex items-center gap-2 text-base font-medium"
            >
              <Star className="text-primary h-4 w-4 shrink-0 fill-current" />
              {activity}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
