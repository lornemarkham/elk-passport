import "server-only";

/**
 * **The Atlas Explorer's one way of talking to Atlas.**
 *
 * Server-only, read-only, and admin-gated on the Atlas side — `ADMIN_TOKEN`
 * never reaches a browser, and every page that uses this is a server
 * component, so there is no proxy route in between to add a same-process
 * round trip.
 *
 * ## Why this reads `ATLAS_API_URL` and most of `/admin` does not
 *
 * Passport currently names Atlas in 35 places and only three of them read
 * the environment; the rest hardcode `http://localhost:3000`, which is why
 * the whole admin suite is dark whenever Atlas runs anywhere else. That is a
 * real defect with its own mission. This file is new code, so it simply does
 * the right thing rather than inheriting the wrong one — the same pattern
 * `atlas-repo.ts` and `boards-server.ts` already use.
 */
const ATLAS_BASE_URL = process.env.ATLAS_API_URL ?? "http://localhost:3000";

/**
 * Atlas answers a dossier by reading the whole entity table, the whole
 * relationship table and the whole source table — about three seconds
 * today, and a documented limitation of Atlas's read path rather than
 * something Explorer can fix from here. Long enough to need a real budget,
 * short enough that a person browsing does not notice.
 */
const TIMEOUT_MS = 60_000;

export class ExplorerNotConfiguredError extends Error {}
export class ExplorerUnreachableError extends Error {}

async function atlasGet<T>(path: string): Promise<T> {
  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    throw new ExplorerNotConfiguredError(
      "ADMIN_TOKEN is not set, so Passport cannot read Atlas's inspection routes.",
    );
  }

  let response: Response;
  try {
    response = await fetch(`${ATLAS_BASE_URL}${path}`, {
      headers: { "x-admin-token": token },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new ExplorerUnreachableError(
      `Atlas is unreachable at ${ATLAS_BASE_URL}: ${(error as Error).message}`,
    );
  }

  if (response.status === 401) {
    throw new ExplorerNotConfiguredError("Atlas rejected ADMIN_TOKEN.");
  }
  if (response.status === 404) {
    throw new ExplorerNotFoundError(`Atlas has nothing at ${path}.`);
  }
  if (!response.ok) {
    throw new ExplorerUnreachableError(
      `Atlas returned ${response.status} for ${path}.`,
    );
  }

  return (await response.json()) as T;
}

export class ExplorerNotFoundError extends Error {}

/* ------------------------------------------------------------------ *
 * The shapes Atlas serves. Mirrors
 * `atlas/src/application/explorer/EntityDossier.ts` — declared rather
 * than imported, because the two repositories share no build.
 * ------------------------------------------------------------------ */

export type EntityKindName =
  "Place" | "Organization" | "Activity" | "Event" | "Experience";

export interface DossierEntityRef {
  id: string;
  kind: EntityKindName;
  name: string;
  subtype?: string;
  archived: boolean;
  isRegion: boolean;
}

export interface DossierSourceRef {
  id: string;
  sourceType: string;
  source: string;
}

export interface DossierEdge {
  id: string;
  type: string;
  direction: "outgoing" | "incoming" | "self";
  otherId: string;
  other?: DossierEntityRef;
  otherSourceRecord?: DossierSourceRef;
  dangling: boolean;
  flags: {
    selfReferential: boolean;
    reciprocal: boolean;
    repeated: boolean;
  };
}

export interface DossierEdgeGroup {
  type: string;
  outgoing: DossierEdge[];
  incoming: DossierEdge[];
  selfReferential: DossierEdge[];
  total: number;
}

export interface DossierSource {
  id: string;
  sourceType: string;
  source: string;
  retrievedAt: string;
  rawContentChars: number;
  rawContentExcerpt: string;
  imageUrl?: string;
  mediaCount: number;
  mediaSubject?: string;
  interpretedUnder?: string;
  observationCount: number;
}

export interface AttributedObservation {
  id: string;
  entityId: string;
  sourceRecordId: string;
  observationKind: string;
  sourceRole: string;
  statement: string;
  supportingPassage: string;
}

export interface GeographicObservation {
  id: string;
  subjectEntityId: string;
  sourceRecordId: string;
  coordinate?: [number, number];
  streetAddress?: string;
  locality?: string;
  region?: string;
  country?: string;
  postalCode?: string;
  locationRole?: string;
  statedAs?: string;
  observedAt: string;
}

export interface TemporalClaim {
  id: string;
  subjectEntityId: string;
  sourceRecordId: string;
  supportingPassage: string;
  shape: string;
  intervals: { start?: string; end?: string }[];
  weekdays: string[];
  excludes: string[];
  timesOfDay: string[];
  editionLabel?: string;
  unresolved?: string;
  observedAt: string;
}

export interface MergeRecord {
  id: string;
  kind: string;
  survivingId: string;
  absorbedId: string;
  mergedAt: string;
  reason?: string;
}

export interface EntityCorrection {
  id: string;
  retiredId: string;
  activeId: string;
  retiredKind: string;
  activeKind: string;
  correctionType?: string;
  ontologyRule: string;
  reason: string;
  correctedAt: string;
  evidenceSourceRecordId?: string;
  evidencePassage?: string;
}

export interface ResearchDossierView {
  entityId: string;
  state: string;
  stateReason: string;
  policyId: string;
  policyVersion: number;
  ladderVersion: number;
  objectives: unknown[];
  attempts: {
    rungNumber?: number;
    rungName?: string;
    publisher?: string;
    outcome?: string;
    question?: string;
    attemptedAt?: string;
  }[];
  lastEvaluatedAt?: string;
}

/** Every field Atlas stores on the entity, whatever its kind. */
export type DossierEntityRecord = Record<string, unknown> & {
  kind: EntityKindName;
  id: string;
  name: string;
  description: string;
};

export interface EntityDossier {
  entity: DossierEntityRecord;
  identity: {
    id: string;
    kind: EntityKindName;
    name: string;
    subtype?: string;
    aliases: string[];
    externalIds: { system: string; id: string }[];
    archivedAt?: string;
    isRegion: boolean;
  };
  regionMemberships: { region: DossierEntityRef; relationshipId: string }[];
  edges: DossierEdge[];
  edgeGroups: DossierEdgeGroup[];
  sources: DossierSource[];
  attributedObservations: AttributedObservation[];
  geographicObservations: GeographicObservation[];
  temporalClaims: TemporalClaim[];
  mergeRecords: MergeRecord[];
  corrections: EntityCorrection[];
  research?: ResearchDossierView;
  counts: {
    relationships: number;
    outgoing: number;
    incoming: number;
    selfReferential: number;
    reciprocal: number;
    repeated: number;
    danglingEdges: number;
    relationshipTypes: number;
    sources: number;
    media: number;
    attributedObservations: number;
    geographicObservations: number;
    temporalClaims: number;
  };
}

export interface ExplorerSearchHit {
  id: string;
  kind: EntityKindName;
  name: string;
  subtype?: string;
  description: string;
  imageUrl?: string;
  archived: boolean;
  isRegion: boolean;
  mediaCount: number;
  aliases: string[];
  matchedOn: "name" | "alias" | "id" | "description";
}

export interface ExplorerSearchResult {
  hits: ExplorerSearchHit[];
  total: number;
  countsByKind: Record<string, number>;
}

export interface FullSourceRecord {
  record: {
    id: string;
    sourceType: string;
    source: string;
    retrievedAt: string;
    rawContent: string;
    imageUrl?: string;
    mediaSubject?: string;
    interpretedUnder?: string;
    media?: { url: string; caption?: string }[];
  };
  describes: {
    id: string;
    kind: EntityKindName;
    name: string;
    archived: boolean;
  }[];
}

/* ------------------------------------------------------------------ *
 * Calls
 * ------------------------------------------------------------------ */

export function searchAtlas(options: {
  query?: string;
  kind?: string;
  limit?: number;
}): Promise<ExplorerSearchResult> {
  const params = new URLSearchParams();
  if (options.query) params.set("q", options.query);
  if (options.kind) params.set("kind", options.kind);
  if (options.limit) params.set("limit", String(options.limit));
  const suffix = params.toString();
  return atlasGet<ExplorerSearchResult>(
    `/admin/explorer/search${suffix ? `?${suffix}` : ""}`,
  );
}

export function getEntityDossier(id: string): Promise<EntityDossier> {
  return atlasGet<EntityDossier>(
    `/admin/explorer/entities/${encodeURIComponent(id)}`,
  );
}

export function getSourceRecord(id: string): Promise<FullSourceRecord> {
  return atlasGet<FullSourceRecord>(
    `/admin/explorer/source-records/${encodeURIComponent(id)}`,
  );
}

/**
 * Discovery's own answer about this entity, straight from the endpoint
 * Passport's Discover page reads.
 *
 * Unauthenticated and public, exactly as Discover calls it. It is here so
 * the "how Passport sees this" panel is answered by the *real* pipeline
 * rather than by a reimplementation of it — the difference between a
 * diagnostic and a second opinion.
 */
export interface DiscoveryVerdict {
  candidate?: {
    id: string;
    kind: string;
    name: string;
    subtype?: string;
    description: string;
    heroUrl?: string;
    mediaCount: number;
    coordinates?: [number, number];
    context?: { id: string; kind: string; name: string };
    containsCount: number;
    regionIds: string[];
    startTime?: string;
    endTime?: string;
  };
  suppressed?: { id: string; kind: string; name: string; reason: string };
}

export async function getDiscoveryVerdict(
  id: string,
): Promise<DiscoveryVerdict> {
  let response: Response;
  try {
    response = await fetch(`${ATLAS_BASE_URL}/discovery/candidates`, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new ExplorerUnreachableError(
      `Atlas is unreachable at ${ATLAS_BASE_URL}: ${(error as Error).message}`,
    );
  }
  if (!response.ok) {
    throw new ExplorerUnreachableError(
      `Atlas returned ${response.status} for /discovery/candidates.`,
    );
  }
  const body = (await response.json()) as {
    candidates: NonNullable<DiscoveryVerdict["candidate"]>[];
    suppressed: NonNullable<DiscoveryVerdict["suppressed"]>[];
  };
  return {
    candidate: body.candidates.find((c) => c.id === id),
    suppressed: body.suppressed.find((s) => s.id === id),
  };
}

/** The Regions Atlas holds, so Explorer can name the scope rather than a uuid. */
export function listExplorerRegions(): Promise<{
  regions: { id: string; name: string }[];
}> {
  return atlasGet<{ regions: { id: string; name: string }[] }>(
    "/admin/regions",
  );
}
