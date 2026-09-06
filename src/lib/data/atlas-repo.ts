import type { DiscoveryCandidate, Place, PlaceDetail } from "./types";

export async function listPlaces(): Promise<Place[]> {
  const response = await fetch("http://localhost:3000/places");

  if (!response.ok) {
    throw new Error("Failed to load places.");
  }

  return response.json();
}

export async function getPlace(id: string): Promise<Place> {
  const response = await fetch(`http://localhost:3000/places/${id}`);

  if (!response.ok) {
    throw new Error("Failed to load place.");
  }

  return response.json();
}

/**
 * The Place Detail page's one real request — `place`, `relationships`, and
 * `sources` in a single round trip (`GET /places/:id/detail`; see that
 * route's own comment in `atlas/src/api/server.ts` for why this is a
 * separate, purpose-built composite rather than a change to `getPlace`
 * above). Returns `null` on a real 404 (no such place, or an archived one
 * — Atlas excludes archived entities from this route by default) so the
 * page can call Next.js's `notFound()` rather than rendering half a page;
 * any other failure still throws, same as every other function here.
 */
export async function getPlaceDetail(id: string): Promise<PlaceDetail | null> {
  const response = await fetch(`http://localhost:3000/places/${id}/detail`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to load place detail.");
  }

  return response.json();
}

/**
 * Everything Discover may consider, across every entity kind.
 *
 * Replaces `listPlaces()` as Discover's source. `listPlaces` stays exactly as
 * it was — `/places` and the place detail pages still use it, and this changes
 * only what Discover consumes.
 */
export async function listDiscoveryCandidates(): Promise<DiscoveryCandidate[]> {
  const response = await fetch("http://localhost:3000/discovery/candidates");
  if (!response.ok) {
    throw new Error(
      `Atlas discovery candidates request failed: ${response.status}`,
    );
  }
  const body = (await response.json()) as { candidates: DiscoveryCandidate[] };
  return body.candidates;
}

export interface AtlasRegion {
  id: string;
  name: string;
}

/**
 * The Regions Atlas holds, by id and name.
 *
 * Server-only: it goes through Atlas's admin route because Atlas publishes no
 * traveller-facing regions endpoint yet, and `ADMIN_TOKEN` must not reach a
 * browser. Read here rather than configured so that Passport never hardcodes a
 * region's uuid or its name — Atlas stays the authority on what a Region is and
 * what it is called.
 *
 * Returns `[]` when Atlas is unreachable or unconfigured, which resolves to no
 * scope: the whole corpus, exactly as before scoping existed. Falling back to
 * *everything* is right and falling back to *a guess* would not be.
 */
export async function listRegions(): Promise<AtlasRegion[]> {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return [];
  try {
    const response = await fetch("http://localhost:3000/admin/regions", {
      headers: { "x-admin-token": token },
      cache: "no-store",
    });
    if (!response.ok) return [];
    const body = (await response.json()) as { regions?: AtlasRegion[] };
    return (body.regions ?? []).map((r) => ({ id: r.id, name: r.name }));
  } catch {
    return [];
  }
}
