import { Accessibility } from "lucide-react";
import { SectionShell } from "./SectionShell";
import type { PlaceSectionProps } from "./types";

const PHRASE: Record<"yes" | "no" | "limited", string> = {
  yes: "Wheelchair accessible.",
  limited: "Limited wheelchair accessibility.",
  no: "Not wheelchair accessible.",
};

/**
 * One field today (Atlas's `wheelchairAccessible`, sourced from OSM's own
 * `wheelchair` tag) — a single sentence. Deliberately its own section,
 * not folded into Quick Facts: this is exactly the kind of fact Atlas is
 * likely to know much more about later (terrain difficulty, accessible
 * parking, accessible routes) — when that happens, it's a richer render
 * inside this same section, not a new one.
 */
export function PlaceAccessibility({ place }: PlaceSectionProps) {
  if (!place.wheelchairAccessible) return null;

  return (
    <SectionShell title="Accessibility">
      <p className="flex items-center gap-2 text-sm">
        <Accessibility className="text-muted-foreground h-4 w-4 shrink-0" />
        {PHRASE[place.wheelchairAccessible]}
      </p>
    </SectionShell>
  );
}
