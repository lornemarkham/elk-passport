import { Store } from "lucide-react";
import { SectionShell } from "./SectionShell";
import { atThisPlace } from "./atThisPlace";
import { excerpt } from "./relatedPlaceGrouping";
import type { PlaceSectionProps } from "./types";

/**
 * **"At this place" — the Organizations Atlas asserts are located here.**
 *
 * QC #4 (2026-09-17). Atlas learned `Kalavida Surf Shop --located_at--> Kal
 * Beach` (ADR 067) and Passport rendered nothing: the page read `offers`,
 * `near`, `operates` and events, and an Organization at the *source* end of
 * an edge pointing at this Place had no section. This is that section. It
 * reads `locatedHere` — Atlas's inverse traversal of `located_at`, not a
 * second edge — and renders one card per Organization for the same graph
 * reason on every Place.
 *
 * The wording stays inside what Atlas holds. The heading says *located
 * here*, which is exactly the edge's claim; the offers line lists Activities
 * Atlas holds `offers` edges for and reads "Offers …" — not "rent here", not
 * a price, not hours, none of which the edge asserts. See `atThisPlace.ts`.
 *
 * Returns `null` when Atlas asserts nothing is located here — absence, not
 * an explanation, the rule every section on this page follows.
 */
export function PlaceAtThisPlace({ locatedHere }: PlaceSectionProps) {
  const cards = atThisPlace(locatedHere);
  if (cards.length === 0) return null;

  return (
    <SectionShell title="At this place">
      <ul className="flex flex-col gap-3" data-testid="place-at-this-place">
        {cards.map((card) => (
          <li key={card.id} className="flex gap-3 rounded-lg border p-3">
            <div className="bg-muted flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md">
              {card.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- external source image
                <img
                  src={card.imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <Store className="text-muted-foreground h-5 w-5 opacity-40" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {card.name}
                {card.kindLabel && (
                  <span className="text-muted-foreground ml-2 text-xs font-normal">
                    {card.kindLabel}
                  </span>
                )}
              </p>
              <p className="text-muted-foreground text-xs">Located here.</p>
              {card.description && (
                <p className="text-muted-foreground/80 mt-1 text-xs leading-relaxed">
                  {excerpt(card.description, 140)}
                </p>
              )}
              {card.offers.length > 0 && (
                <p className="mt-1 text-xs">
                  <span className="text-muted-foreground">Offers </span>
                  {card.offers.join(", ")}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
