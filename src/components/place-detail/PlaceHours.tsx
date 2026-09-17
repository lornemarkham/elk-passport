import { Clock } from "lucide-react";
import { SectionShell } from "./SectionShell";
import type { PlaceSectionProps } from "./types";
import { asOfCaption } from "./asOf";

/**
 * Rendered verbatim, never reformatted — matching the same discipline
 * `Place.hours` itself documents (OSM's `opening_hours` grammar is a real
 * parsing problem, deliberately not solved here or in Atlas). If a future
 * source states hours in a structured, parseable way, this is where a
 * richer weekly schedule would render — no redesign needed to get there,
 * just a richer value arriving in `place.hours`.
 */
export function PlaceHours({ place, temporal }: PlaceSectionProps) {
  if (!place.hours?.trim()) return null;
  const asOf = asOfCaption(temporal, "hours");

  return (
    <SectionShell title="Hours">
      <p className="flex items-center gap-2 text-sm">
        <Clock className="text-muted-foreground h-4 w-4 shrink-0" />
        {place.hours}
        {asOf && <span className="text-muted-foreground text-xs">{asOf}</span>}
      </p>
    </SectionShell>
  );
}
