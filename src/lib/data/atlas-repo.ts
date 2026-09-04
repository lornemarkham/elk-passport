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
