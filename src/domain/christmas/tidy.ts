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

/**
 * **Say each place once.** "Okanagan Park · Vernon" beside a stated address
 * that already ends "…, Vernon" repeats the town; a card that says it twice
 * reads as noise. A part is dropped when another part already contains it
 * (case-insensitive), and a comma segment is dropped when an earlier segment
 * or part says the same thing. Nothing is added.
 */
export function distinctWhere(line: string): string {
  const seen: string[] = [];
  const said = (text: string) =>
    seen.some((s) => s.includes(text.toLowerCase()));
  const parts = line
    .split(" · ")
    .map((p) => p.trim())
    .filter(Boolean);
  // A part another, longer part already contains is said twice.
  const keep = parts.filter(
    (part, i) =>
      !parts.some(
        (other, j) =>
          j !== i &&
          other.length > part.length &&
          other.toLowerCase().includes(part.toLowerCase()),
      ),
  );
  return keep
    .map((part) =>
      part
        .split(/,\s*/)
        .filter((segment) => {
          const lower = segment.toLowerCase();
          if (!lower || said(lower)) return false;
          seen.push(lower);
          return true;
        })
        .join(", "),
    )
    .filter(Boolean)
    .join(" · ");
}
