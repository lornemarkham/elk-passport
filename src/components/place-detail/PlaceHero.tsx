import { MapPin, Navigation } from "lucide-react";
import type { Place } from "@/lib/data/types";
import { SaveButton } from "./SaveButton";
import { computeFitSignals, deriveMoodLine } from "./content";
import { heroImage } from "./placeMedia";
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
export function PlaceHero({ place, operatedBy, media }: PlaceSectionProps) {
  // Only an image Atlas can vouch for as this Place (see `placeMedia.ts`).
  const hero = heroImage(place, media);
  // A street address beats a decimal coordinate for a reader, and Big White's
  // Place holds none while the Organization that operates it holds
  // "5315 Big White Road". Only ever a fallback: the Place's own address wins,
  // and coordinates remain the last resort rather than the second one.
  const operatorAddress = operatedBy?.find((o) => o.address?.trim())?.address;

  // **Coordinates are for the map, not for reading** (mission 845): Knox
  // Mountain Park said "49.915, -119.459" under its name on a phone and had
  // no way to get there. The coordinates now make the Directions link, and
  // the line under the name only ever says an address.
  const locationSummary = place.address ?? operatorAddress;
  const directions = directionsTo(place.name, locationSummary, place.geometry);

  const moodLine = deriveMoodLine(
    computeFitSignals(place.activities, place.facilities),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-muted relative aspect-[21/9] w-full overflow-hidden rounded-xl">
        {hero ? (
          // eslint-disable-next-line @next/next/no-img-element -- external source image, no next/image domain config for arbitrary sources
          <img
            src={hero}
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
        <div className="flex items-center gap-2">
          {directions && (
            <a
              href={directions}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="place-directions"
              className="border-border hover:bg-muted inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium"
            >
              <Navigation className="h-4 w-4" aria-hidden />
              Directions
            </a>
          )}
          <SaveButton placeId={place.id} />
        </div>
      </div>
    </div>
  );
}

/**
 * A map app's directions to this place: to its stated point where Atlas holds
 * one, otherwise to its name and address. Neither, and there is no honest
 * link to make.
 */
export function directionsTo(
  name: string,
  address: string | undefined,
  geometry: Place["geometry"],
): string | undefined {
  const base = "https://www.google.com/maps/dir/?api=1&destination=";
  if (geometry?.type === "Point") {
    const [lng, lat] = geometry.coordinates;
    return `${base}${lat},${lng}`;
  }
  if (address) return `${base}${encodeURIComponent(`${name}, ${address}`)}`;
  return undefined;
}
