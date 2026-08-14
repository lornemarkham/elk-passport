import { MapPin } from "lucide-react";
import { SaveButton } from "./SaveButton";
import { computeFitSignals, deriveMoodLine } from "./content";
import type { PlaceSectionProps } from "./types";

/**
 * The one fixed, non-growable block at the top of the page — identity,
 * not content. Everything that can meaningfully grow as Atlas learns more
 * lives in the section registry below this, not here.
 *
 * Phase 7.6: the Hero now answers "what kind of day am I about to have?"
 * with feeling, not facts — a short mood line under the name, the same
 * evidence `PlaceShouldICome` uses (`computeFitSignals`/`deriveMoodLine`
 * in `content.ts`), so the two can never disagree. Renders nothing extra
 * when there's no confident signal — the factual `placeType`/location line
 * underneath still always shows; the mood line is additive, never a
 * placeholder for missing feeling.
 */
export function PlaceHero({ place }: PlaceSectionProps) {
  const locationSummary =
    place.address ??
    (place.geometry?.type === "Point"
      ? `${place.geometry.coordinates[1].toFixed(3)}, ${place.geometry.coordinates[0].toFixed(3)}`
      : undefined);

  const moodLine = deriveMoodLine(
    computeFitSignals(place.activities, place.facilities),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-muted relative aspect-[21/9] w-full overflow-hidden rounded-xl">
        {place.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external source image, no next/image domain config for arbitrary sources
          <img
            src={place.imageUrl}
            alt={place.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="text-muted-foreground flex h-full w-full items-center justify-center">
            <MapPin className="h-10 w-10 opacity-30" />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{place.name}</h1>
          {moodLine && (
            <p className="text-primary mt-1 text-base font-medium italic">
              {moodLine}
            </p>
          )}
          <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {place.placeType && (
              <span className="capitalize">{place.placeType}</span>
            )}
            {locationSummary && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {locationSummary}
              </span>
            )}
          </div>
        </div>
        <SaveButton placeId={place.id} />
      </div>
    </div>
  );
}
