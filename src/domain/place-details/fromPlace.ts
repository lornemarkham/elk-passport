import type { PlaceDetail } from "@/lib/data/types";
import { siteOf, type PlaceDetailsModel } from "./model";

/** Atlas's source types, as a visitor would name them. */
const SOURCE_LABELS: Record<string, string> = {
  wikipedia: "Wikipedia",
  bcparks: "BC Parks",
  osm: "OpenStreetMap",
  destinationbc: "Destination BC",
  "official-website": "Their own website",
  "passport-local-knowledge": "Passport local knowledge",
};

/**
 * **An Atlas Place read, as the shared place page's frame** (`GET
 * /places/:id/detail`). The Place page keeps its own Atlas sections in the
 * middle — what to know first, what's on, what to bring — so this carries
 * only what the frame draws: identity, the lead photograph, hours, where,
 * and the sources. The rest of the photographs stay in the Place gallery,
 * which knows each one's evidence.
 */
export function placeDetailsFromPlace(
  detail: Pick<PlaceDetail, "place" | "sources" | "media" | "operatedBy">,
  hero: string | undefined,
): PlaceDetailsModel {
  const { place } = detail;
  const operatorAddress = detail.operatedBy?.find((o) =>
    o.address?.trim(),
  )?.address;
  const address = place.address ?? operatorAddress;
  const point =
    place.geometry?.type === "Point"
      ? {
          latitude: place.geometry.coordinates[1],
          longitude: place.geometry.coordinates[0],
        }
      : undefined;
  const kind = place.placeType?.trim();
  return {
    id: place.id,
    name: place.name,
    ...(kind && kind.toLowerCase() !== "unknown"
      ? { kindLabel: kind.charAt(0).toUpperCase() + kind.slice(1) }
      : {}),
    ...(address ? { address, locality: address } : {}),
    ...(place.description?.trim()
      ? { description: place.description.trim() }
      : {}),
    goodFor: [],
    photos: hero ? [{ url: hero, alt: place.name }] : [],
    ...(place.hours?.trim()
      ? { hours: { lines: [place.hours.trim()], confirmed: true } }
      : {}),
    ...(point ? { point } : {}),
    links: [],
    social: [],
    sections: [],
    whatsOn: [],
    partOf: [],
    pairsWith: [],
    nearby: [],
    sources: detail.sources.map((s) => ({
      label:
        SOURCE_LABELS[s.sourceType] ??
        s.sourceType
          .replace(/[-_]/g, " ")
          .replace(/^\w/, (c) => c.toUpperCase()),
      url: s.source,
      ...(siteOf(s.source) ? { site: siteOf(s.source) } : {}),
      ...(s.retrievedAt ? { checked: s.retrievedAt.slice(0, 10) } : {}),
    })),
    readFromSources: [],
    withheld: 0,
  };
}
