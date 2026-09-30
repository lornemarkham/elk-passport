import "server-only";
import {
  ATLAS_BASE_URL,
  atlasAuthHeaders,
  AtlasUnavailableError,
  describeAtlasFailure,
  isAtlasUnavailable,
  type AtlasFailure,
} from "./atlasAuth";

/**
 * Where Atlas is, and how Passport proves it is Passport: both now come from
 * `atlasAuth`, because a service token added in some call sites and not others
 * is worse than one added in none.
 *
 * Server-side only, enforced rather than asserted. The browser never names
 * Atlas at all and must never hold its secret.
 */

/**
 * How long Passport waits for Atlas.
 *
 * Node's default is 30 seconds to the first header, which was invisible until
 * Atlas's corpus passed a thousand entities: `/discovery/candidates` reads the
 * whole thing, and under a concurrent population run that read measured 56
 * seconds. Passport then failed with an undici `HeadersTimeoutError` and no
 * page at all — a Passport-side failure caused by a Passport-side assumption
 * about somebody else's speed.
 *
 * Two minutes is not a fix for the read being slow; that is Atlas's to solve.
 * It is the difference between waiting and lying about the result.
 */
const ATLAS_TIMEOUT_MS = 120_000;

/**
 * Every request Passport makes of Atlas, carrying its identity.
 *
 * A network failure arrives here as an `AtlasUnavailableError` with
 * `unreachable`, so that "Atlas is not there" and "Atlas answered with
 * nothing" cannot be the same value by the time a page sees them.
 */
const atlasFetch = async (
  path: string,
  init?: RequestInit,
): Promise<Response> => {
  try {
    return await fetch(`${ATLAS_BASE_URL}${path}`, {
      ...init,
      headers: atlasAuthHeaders(init?.headers as Record<string, string>),
      signal: AbortSignal.timeout(ATLAS_TIMEOUT_MS),
    });
  } catch (cause) {
    throw new AtlasUnavailableError("unreachable", undefined, { cause });
  }
};

import type {
  DiscoveryCandidate,
  Place,
  PlaceDetail,
  SubjectComposition,
} from "./types";

export async function listPlaces(): Promise<Place[]> {
  const response = await atlasFetch("/places");

  if (!response.ok) {
    throw new Error("Failed to load places.");
  }

  return response.json();
}

export async function getPlace(id: string): Promise<Place> {
  const response = await atlasFetch(`/places/${id}`);

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
  const response = await atlasFetch(`/places/${id}/detail`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to load place detail.");
  }

  return response.json();
}

/**
 * **One subject, composed** — `GET /organizations/:id/detail` and
 * `GET /experiences/:id/detail` (Atlas 2846f50).
 *
 * The public read that replaced an admin token on the traveller page. Atlas
 * walks `offers`, `includes` and `hosts` two hops from the id and returns each
 * subject with its own facts, its own temporal claims and its own ADR 072
 * state — so Passport asks one question instead of downloading the corpus and
 * joining it by uuid.
 *
 * `on` is an explicit day (`YYYY-MM-DD`) the caller chose. Atlas answers
 * *does a claim it holds state that day?* with its own `claimCoversDay`;
 * Passport has no copy of that logic and must never grow one.
 *
 * `null` on a 404 — no such subject, or an id of a different kind — so the
 * caller can fall through rather than render half a page. Any other failure
 * throws, like every other function here.
 */
export async function getSubjectDetail(
  kind: "organizations" | "experiences" | "events",
  id: string,
  on?: string,
): Promise<SubjectComposition | null> {
  const query = on ? `?on=${encodeURIComponent(on)}` : "";
  const response = await atlasFetch(
    `/${kind}/${encodeURIComponent(id)}/detail${query}`,
  );

  if (response.status === 404 || response.status === 400) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to load subject detail.");
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
  const response = await atlasFetch("/discovery/candidates");
  if (!response.ok) {
    // A refusal is not an absence. Every October surface used to `.catch()`
    // this into `[]`, so a wrong service token rendered as "nothing is on".
    const failure = describeAtlasFailure(response.status);
    if (failure) throw failure;
    throw new Error(
      `Atlas discovery candidates request failed: ${response.status}`,
    );
  }
  const body = (await response.json()) as { candidates: DiscoveryCandidate[] };
  return body.candidates;
}

/**
 * **Discovery candidates, or the reason there are none.**
 *
 * Every October surface used to write `listDiscoveryCandidates().catch(() => [])`,
 * which turned four different failures — no service token, a refused token,
 * Atlas not configured, Atlas not answering — into the same empty array. The
 * page then said *"Nothing Passport knows about is on tonight. That is most
 * nights."* over a corpus of two and a half thousand things, and it said it
 * calmly, which is what made it dangerous.
 *
 * An empty corpus and an unanswered question are different answers and this
 * returns them differently. The operator's detail — which secret is wrong —
 * goes to the server log, never to the page: a visitor must not be shown the
 * name of a credential.
 */
export async function discoveryCandidates(): Promise<{
  readonly candidates: DiscoveryCandidate[];
  /** Absent when Atlas answered, whatever it answered with. */
  readonly outage?: AtlasFailure;
}> {
  try {
    return { candidates: await listDiscoveryCandidates() };
  } catch (error) {
    const outage = isAtlasUnavailable(error) ? error.reason : "unreachable";
    console.error(
      `[atlas] discovery candidates unavailable (${outage}):`,
      error instanceof Error ? error.message : error,
    );
    return { candidates: [], outage };
  }
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
    const response = await atlasFetch("/admin/regions", {
      headers: atlasAuthHeaders({ "x-admin-token": token }),
      cache: "no-store",
    });
    if (!response.ok) return [];
    const body = (await response.json()) as { regions?: AtlasRegion[] };
    return (body.regions ?? []).map((r) => ({ id: r.id, name: r.name }));
  } catch {
    return [];
  }
}
