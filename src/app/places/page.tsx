import { PassportNav } from "@/components/shell/PassportNav";
import { currentUser } from "@/lib/auth/currentUser";
import type { Metadata } from "next";
import { listPlaces } from "@/lib/data/atlas-repo";
import { PlacesDiscovery } from "@/components/places/PlacesDiscovery";

export const metadata: Metadata = {
  title: "Places — Passport",
};

/**
 * Rendered on request, never at build. This page is a live read of Atlas, and
 * a build machine has no Atlas to read — the first deployment failed exactly
 * there, prerendering an index of a backend it could not reach. A page that
 * lists what a backend holds right now should not be baked into a build.
 */
export const dynamic = "force-dynamic";

/**
 * The index `/places/[id]` never had. Reads the same `listPlaces()` that
 * `/discovery` does — no new Atlas surface, no mapper in between, so every
 * field shown is a field Atlas actually holds.
 */
export default async function PlacesPage() {
  const [places, user] = await Promise.all([listPlaces(), currentUser()]);
  return (
    <>
      <PassportNav displayName={user?.displayName ?? null} />
      <PlacesDiscovery places={places} />
    </>
  );
}
