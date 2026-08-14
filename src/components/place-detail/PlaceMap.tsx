import { SectionShell } from "./SectionShell";
import type { PlaceSectionProps } from "./types";

/**
 * Deliberately the simplest thing that works: an embedded OpenStreetMap
 * iframe, no map library, no API key, no client-side JS. `app/` has no
 * map dependency today (checked before building this — Leaflet/Mapbox
 * would be a real new dependency for one static pin, not justified yet).
 * If a real interactive map is ever needed, this is the one place that
 * changes — nothing else on the page depends on how the map is rendered.
 */
export function PlaceMap({ place }: PlaceSectionProps) {
  if (place.geometry?.type !== "Point") return null;
  const [lon, lat] = place.geometry.coordinates;

  const delta = 0.01;
  const bbox = [lon - delta, lat - delta, lon + delta, lat + delta].join(",");
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&marker=${lat},${lon}&layer=mapnik`;

  return (
    <SectionShell title="Map">
      <iframe
        src={src}
        title={`Map showing ${place.name}`}
        className="h-72 w-full rounded-md border"
        loading="lazy"
      />
    </SectionShell>
  );
}
