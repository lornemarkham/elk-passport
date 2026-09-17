import Link from "next/link";
import { MapPin } from "lucide-react";
import { groupRelatedPlaces } from "./relatedPlaceGrouping";
import type { PlaceSectionProps } from "./types";

/**
 * Phase 7.6 — rebuilt as a real timeline (numbered, connected by a line),
 * not a card grid — a distinct rhythm beat from the cards around it.
 * Still the exact same "before" bucket `groupRelatedPlaces` computes
 * (Phase 8.1's data, Phase 7.5's elevation) — only the presentation
 * changed. Framed honestly as "On Your Way," not "the first 30 minutes at
 * {place}" — Atlas has no data about sequencing or timing once someone
 * actually arrives, only about what's nearby before they do, and the
 * copy stays scoped to exactly that.
 *
 * Returns `null` when there's no real "before" data yet — Phase 7.6's
 * rule, no exceptions: an empty timeline with an apology is worse than no
 * timeline at all.
 */
export function PlaceFirstThing({
  place,
  relationships,
  relatedPlaceDetails,
  relatedPlaces,
}: PlaceSectionProps) {
  const { grouped } = groupRelatedPlaces(
    place,
    relationships,
    relatedPlaceDetails,
    relatedPlaces,
  );
  const before = grouped.before;

  if (before.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
        On Your Way
      </h2>
      <ol className="border-border relative flex flex-col gap-5 border-l pl-6">
        {before.map((card, i) => (
          <li key={card.place.id} className="relative">
            <span className="bg-primary text-primary-foreground absolute top-0 -left-[1.85rem] flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold">
              {i + 1}
            </span>
            <Link
              href={`/places/${card.place.id}`}
              className="group flex flex-col gap-0.5"
            >
              <span className="flex items-center gap-1.5 text-sm font-medium group-hover:underline">
                {card.place.name}
                <MapPin className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
              </span>
              {card.place.description && (
                <span className="text-muted-foreground text-xs">
                  {card.place.description.slice(0, 80)}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
