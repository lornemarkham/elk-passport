import { ExternalLink } from "lucide-react";
import { SectionShell } from "./SectionShell";
import type { PlaceSectionProps } from "./types";

const SOURCE_LABELS: Record<string, string> = {
  wikipedia: "Wikipedia",
  bcparks: "BC Parks",
  osm: "OpenStreetMap",
  destinationbc: "Destination BC",
  "passport-local-knowledge": "Passport Local Knowledge",
};

export function sourceLabel(sourceType: string): string {
  return (
    SOURCE_LABELS[sourceType] ??
    sourceType.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/**
 * Provenance, not a curator debugging view — no raw scraped content (the
 * `/detail` endpoint already trims that before it reaches here), no
 * expand/collapse, just a clean, trustworthy "here's where this came
 * from" list. Valuable for two real audiences: a traveler deciding how
 * much to trust what they're reading, and us, while Atlas is still
 * growing — the fastest way to see whether a place has real multi-source
 * corroboration or is still resting on one thin source.
 *
 * Titled "Trusted Information" (Phase 7.2) — traveler language, not
 * database language.
 */
export function PlaceSources({ sources }: PlaceSectionProps) {
  if (sources.length === 0) return null;

  return (
    <SectionShell title="Trusted Information">
      <ul className="flex flex-wrap gap-2">
        {sources.map((source) => (
          <li key={source.id}>
            <a
              href={source.source}
              target="_blank"
              rel="noreferrer"
              className="border-border hover:bg-muted/40 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors"
            >
              {sourceLabel(source.sourceType)}
              <ExternalLink className="text-muted-foreground h-3 w-3" />
            </a>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
