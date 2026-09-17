import Link from "next/link";
import { MapPin } from "lucide-react";
import { excerpt, type DestinationCardData } from "./relatedPlaceGrouping";

/**
 * Extracted from `PlaceKeepExploring` (Phase 7.5) — the same card rendering
 * now shared by `PlaceKeepExploring`, `PlaceFirstThing`, and
 * `PlaceAfterwards`, all of which show a slice of the same underlying
 * `groupRelatedPlaces` result. One visual definition of "here's a real
 * place worth going," not three.
 */
export function DestinationCard({
  place,
  caption,
  imageUrl,
}: DestinationCardData) {
  return (
    <Link
      href={`/places/${place.id}`}
      className="group hover:border-primary/40 flex flex-col gap-2 rounded-lg border p-2 transition-colors"
    >
      <div className="bg-muted flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-md">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external source image
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <MapPin className="text-muted-foreground h-6 w-6 opacity-30" />
        )}
      </div>
      <div>
        <p className="truncate text-sm font-semibold group-hover:underline">
          {place.name}
        </p>
        <p className="text-muted-foreground text-xs">{caption}</p>
        {place.description && (
          <p className="text-muted-foreground/80 mt-1 text-xs leading-relaxed">
            {excerpt(place.description)}
          </p>
        )}
      </div>
    </Link>
  );
}
