import type { Journey } from "./journey";

/**
 * **Who to credit for a travel time on screen.**
 *
 * Every provider ADR 097 evaluated routes over OpenStreetMap, whose ODbL
 * licence requires the credit wherever the derived data is shown, and
 * openrouteservice's terms ask for its own as well. So a page that shows a
 * routed minute shows where it came from, once per provider, and a page that
 * shows only straight lines owes nobody anything.
 *
 * The provider name is Atlas's. A provider Passport does not recognise is
 * still credited by that name, with any limitation Atlas sent that carries a
 * copyright line — Passport never drops a credit it was handed.
 *
 * The openrouteservice wording follows its published attribution
 * requirement; confirm it against the terms of the key Atlas actually uses.
 */
const KNOWN: readonly { readonly match: RegExp; readonly line: string }[] = [
  {
    match: /^(ors|openrouteservice)\b/i,
    line: "Routes © openrouteservice.org by HeiGIT · map data © OpenStreetMap contributors",
  },
  {
    match: /^osrm\b/i,
    line: "Routes by OSRM · road network © OpenStreetMap contributors (ODbL)",
  },
];

export function attributionFor(
  journeys: readonly (Journey | undefined)[],
): readonly string[] {
  const lines = new Set<string>();
  for (const journey of journeys) {
    if (journey?.kind !== "routed") continue;
    const known = KNOWN.find((k) => k.match.test(journey.provider));
    if (known) {
      lines.add(known.line);
      continue;
    }
    const credits = journey.limitations.filter((l) => /©|\bodbl\b/i.test(l));
    lines.add([`Travel times by ${journey.provider}`, ...credits].join(" · "));
  }
  return [...lines];
}
