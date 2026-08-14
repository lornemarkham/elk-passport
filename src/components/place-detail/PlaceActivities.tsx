import { SectionShell } from "./SectionShell";
import type { PlaceSectionProps } from "./types";

/**
 * Activities Atlas has confirmed are available here — using Atlas's own
 * names verbatim, no relabeling. A confirmed-present list, never
 * exhaustive: absence of an activity here means "not confirmed," not
 * "not possible" (the same honest limitation `Place.activities` itself
 * documents) — this section just renders what Atlas states, it doesn't
 * add its own claim about completeness.
 *
 * Titled "Perfect For" (Phase 7.2) — traveler language, not database
 * language: the field is still `activities`, this is the one place that
 * ever needs to know the raw name.
 */
export function PlaceActivities({ place }: PlaceSectionProps) {
  const activities = place.activities?.filter((a) => a.trim());
  if (!activities || activities.length === 0) return null;

  return (
    <SectionShell title="Perfect For">
      <ul className="flex flex-wrap gap-2">
        {activities.map((activity) => (
          <li
            key={activity}
            className="border-border bg-muted/40 rounded-full border px-3 py-1.5 text-sm"
          >
            {activity}
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
