import { SectionShell } from "./SectionShell";
import type { PlaceSectionProps } from "./types";

/**
 * Facilities Atlas has confirmed are present — same "confirmed-present,
 * never exhaustive, never evidence of absence" discipline as Activities,
 * because it's the same discipline `Place.facilities` itself was built
 * with (Phase 4.3).
 *
 * Titled "Good To Know" (Phase 7.2) — traveler language, not database
 * language.
 */
export function PlaceFacilities({ place }: PlaceSectionProps) {
  const facilities = place.facilities?.filter((f) => f.trim());
  if (!facilities || facilities.length === 0) return null;

  return (
    <SectionShell title="Good To Know">
      <ul className="flex flex-wrap gap-2">
        {facilities.map((facility) => (
          <li
            key={facility}
            className="border-border bg-muted/40 rounded-full border px-3 py-1.5 text-sm"
          >
            {facility}
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
