import { SectionShell } from "./SectionShell";
import type { PlaceSectionProps } from "./types";

/**
 * Atlas's best current description, rendered as-is. This section should
 * automatically improve as Atlas's own description gets richer (more
 * sources corroborating, better extraction, a future AI summary) — there
 * is nothing here to redesign when that happens, just a better string
 * arriving in `place.description`.
 */
export function PlaceOverview({ place }: PlaceSectionProps) {
  if (!place.description?.trim()) return null;

  return (
    <SectionShell title="Overview">
      <p className="text-foreground/90 max-w-3xl text-base leading-relaxed">
        {place.description}
      </p>
    </SectionShell>
  );
}
