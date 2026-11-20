/**
 * **Atlas's geocoder notes are not for a family.** A stated address can arrive
 * as `2901 35th Avenue, Vernon, BC → 2901 35 Ave, Vernon, BC
 * (bc-address-geocoder: CIVIC_NUMBER, score 100, parcelPoint; from
 * stated-location)` — the organiser's words, an arrow, the normalised form and
 * the ingestion's own provenance. A card shows the organiser's words only
 * (what the listing says), and a trailing ", BC" the town beside it already
 * says is dropped. Nothing is added; only the engineering is taken away.
 */
export function tidyWhere(line: string): string {
  return line
    .split(" · ")
    .map((part) => {
      const stated = part.split("→")[0] ?? part;
      return stated
        .replace(/\s*\((?:[^)]*geocod[^)]*)\)\s*/gi, " ")
        .replace(/,\s*BC\b/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
    })
    .filter(Boolean)
    .join(" · ");
}
