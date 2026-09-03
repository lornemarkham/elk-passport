import type { Metadata } from "next";
import { listPlaces } from "@/lib/data/atlas-repo";
import { PlacesDiscovery } from "@/components/places/PlacesDiscovery";

export const metadata: Metadata = {
  title: "Places — Passport",
};

/**
 * The index `/places/[id]` never had. Reads the same `listPlaces()` that
 * `/discovery` does — no new Atlas surface, no mapper in between, so every
 * field shown is a field Atlas actually holds.
 */
export default async function PlacesPage() {
  const places = await listPlaces();
  return <PlacesDiscovery places={places} />;
}
