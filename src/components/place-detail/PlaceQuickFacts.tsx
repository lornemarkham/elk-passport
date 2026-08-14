import { MapPin, Tag } from "lucide-react";
import { SectionShell } from "./SectionShell";
import type { PlaceSectionProps } from "./types";

/**
 * The truly-compact, glance-strip facts — identity and location, the
 * kind of thing that's unlikely to ever grow into its own rich section
 * the way accessibility or hours might. Deliberately does not repeat
 * hours/fees/accessibility here, even though they're "facts" too — those
 * get their own sections below precisely because they're the ones
 * expected to grow richer over time (a single hours string today, a real
 * seasonal schedule later); duplicating a short version here would just
 * be two places to keep in sync.
 */
export function PlaceQuickFacts({ place }: PlaceSectionProps) {
  const coordinates =
    place.geometry?.type === "Point" ? place.geometry.coordinates : undefined;

  const facts: { label: string; value: string }[] = [];
  if (place.placeType) facts.push({ label: "Type", value: place.placeType });
  if (coordinates) {
    const [lon, lat] = coordinates;
    facts.push({
      label: "Coordinates",
      value: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    });
  }

  if (facts.length === 0) return null;

  return (
    <SectionShell title="Quick Facts">
      <dl className="flex flex-wrap gap-x-8 gap-y-3">
        {facts.map((fact) => (
          <div key={fact.label} className="flex items-center gap-2">
            {fact.label === "Coordinates" ? (
              <MapPin className="text-muted-foreground h-4 w-4" />
            ) : (
              <Tag className="text-muted-foreground h-4 w-4" />
            )}
            <div>
              <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                {fact.label}
              </dt>
              <dd className="text-sm font-medium">{fact.value}</dd>
            </div>
          </div>
        ))}
      </dl>
    </SectionShell>
  );
}
