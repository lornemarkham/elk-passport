/**
 * Learning Tracer — trace event model (event-driven, generic over layer).
 *
 * A traced action is nothing but an ordered list of `TraceEvent`s. Each
 * event is fully self-describing — its own layer, label, what, why, files,
 * and concepts — so `LearningTracerPanel` can render *any* `TraceAction`
 * with zero action-specific branches. Adding a second traced workflow later
 * means adding a `TraceAction` here; it should never require touching the
 * panel component.
 *
 * This replaces the earlier `WorkflowTrace`/`ArchitectureStep` model, which
 * embedded bespoke `describeAction`/`describeWhatHappened` functions per
 * workflow — real per-action rendering logic the panel had to know about.
 * Nothing here is generated or AI-authored; every event was written after
 * reading the real code path it describes (see learning-tracer/README.md).
 */

import type { LucideIcon } from "lucide-react";
import {
  MousePointerClick,
  Globe,
  Cog,
  Archive,
  Database,
  CornerUpLeft,
} from "lucide-react";

export type ArchitectureLayer =
  "ui" | "api" | "service" | "store" | "database" | "response";

export interface LayerMeta {
  readonly label: string;
  readonly icon: LucideIcon;
  /** Tailwind classes applied to this layer's icon chip and badge — text + border + background, light and dark. */
  readonly colorClass: string;
}

/** One canonical, generic description per layer — never redefined per action. */
export const LAYER_META: Record<ArchitectureLayer, LayerMeta> = {
  ui: {
    label: "UI",
    icon: MousePointerClick,
    colorClass:
      "text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-500/10",
  },
  api: {
    label: "API",
    icon: Globe,
    colorClass:
      "text-violet-600 dark:text-violet-400 border-violet-500/40 bg-violet-500/10",
  },
  service: {
    label: "Service",
    icon: Cog,
    colorClass:
      "text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10",
  },
  store: {
    label: "Store",
    icon: Archive,
    colorClass:
      "text-teal-600 dark:text-teal-400 border-teal-500/40 bg-teal-500/10",
  },
  database: {
    label: "Database",
    icon: Database,
    colorClass:
      "text-rose-600 dark:text-rose-400 border-rose-500/40 bg-rose-500/10",
  },
  response: {
    label: "Response",
    icon: CornerUpLeft,
    colorClass:
      "text-emerald-600 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  },
};

/**
 * One real, discrete step in a traced action. Deliberately flat and
 * uniform — no step-type variants, no optional shape differences — so
 * every event renders through the exact same card.
 */
export interface TraceEvent {
  readonly id: string;
  readonly layer: ArchitectureLayer;
  /** Short, scannable — this is what a card shows collapsed. */
  readonly label: string;
  /** One sentence: what this step actually does, in this code. */
  readonly what: string;
  /** One sentence: why this step exists at all. */
  readonly why: string;
  readonly files: readonly string[];
  readonly conceptIds: readonly string[];
}

export interface TraceAction {
  readonly id: string;
  readonly title: string;
  readonly events: readonly TraceEvent[];
}

/**
 * What a real UI action reports when it fires — deliberately minimal.
 * `headline`/`detail` are short, presentation-only strings the emitting
 * component builds from its own context (an entity name, which fields
 * changed); they carry no architectural meaning, so they don't belong on
 * `TraceAction` itself.
 */
export interface TraceEmission {
  readonly actionId: string;
  readonly headline: string;
  readonly detail?: string;
}

export const APPLY_ENRICHMENT_TRACE: TraceAction = {
  id: "apply-enrichment",
  title: "Apply Enrichment",
  events: [
    {
      id: "ui-click",
      layer: "ui",
      label: "Curator clicks Apply",
      what: "The Apply button's onClick calls apply(), building one { value, sourceRecordId } entry per checked field proposal.",
      why: "A curator's decision has to be captured as an explicit, reviewable choice — never inferred from which fields merely exist.",
      files: ["app/src/components/admin/EnrichmentPanel.tsx"],
      conceptIds: ["entity", "enrichment"],
    },
    {
      id: "ui-data-layer",
      layer: "ui",
      label: "UI data layer",
      what: "applyEnrichment(entityId, chosen, reason) sends the payload as a POST to this app's own /api/admin proxy route.",
      why: "The browser never calls Atlas directly — every admin action goes through one typed data-layer module, not scattered fetch() calls.",
      files: ["app/src/lib/data/explorer-repo.ts"],
      conceptIds: ["api"],
    },
    {
      id: "api-proxy",
      layer: "api",
      label: "Next.js API route (proxy)",
      what: "Forwards the request to Atlas's real API, attaching the admin token server-side.",
      why: "ADMIN_TOKEN must never reach the browser — the proxy is the one place allowed to hold it.",
      files: ["app/src/app/api/admin/entities/[id]/enrichment/route.ts"],
      conceptIds: ["api"],
    },
    {
      id: "atlas-api",
      layer: "api",
      label: "Atlas API server",
      what: "POST /admin/entities/:id/enrichment constructs an EnrichmentService and calls its applyEnrichment(props).",
      why: "The API layer's only job is routing and auth — it holds no business logic of its own.",
      files: ["atlas/src/api/server.ts"],
      conceptIds: ["api", "service"],
    },
    {
      id: "service",
      layer: "service",
      label: "Application service",
      what: "Rebuilds the entity with the chosen field overrides, then writes a new 'passport-editorial' SourceRecord describing exactly what changed and why.",
      why: "Every accepted change needs its own evidence trail — a curator's judgment is a claim too, not a silent mutation.",
      files: [
        "atlas/src/application/enrichment/EnrichmentService.ts",
        "atlas/src/application/merge/rebuildEntity.ts",
      ],
      conceptIds: ["enrichment", "provenance", "source-record", "entity"],
    },
    {
      id: "store",
      layer: "store",
      label: "Store (persistence adapter)",
      what: "Calls store.saveEntity(...), store.saveSourceRecord(...), and store.saveRelationship(...) against the AtlasStore interface.",
      why: "The service never knows or cares which concrete store is running — Supabase in production, in-memory in tests.",
      files: [
        "atlas/src/ingestion/persistence/SupabaseAtlasStore.ts",
        "atlas/src/ingestion/persistence/AtlasStore.ts",
      ],
      conceptIds: ["store", "persistence"],
    },
    {
      id: "database",
      layer: "database",
      label: "Database",
      what: "Three real upserts: the updated row in places, a new row in source_records, a new row in relationships.",
      why: "This is the durable source of truth — still there after a restart, a crash, or tomorrow's session.",
      files: ["atlas/supabase/migrations"],
      conceptIds: ["database", "persistence"],
    },
    {
      id: "response",
      layer: "response",
      label: "Response → UI refresh",
      what: "The updated entity flows back through the same chain; onApplied() triggers ContentExplorerView to reload from Atlas.",
      why: "What's on screen has to reflect what's actually stored, not just local state that assumes the write succeeded.",
      files: [
        "app/src/components/admin/EnrichmentPanel.tsx",
        "app/src/components/admin/ContentExplorerView.tsx",
      ],
      conceptIds: ["entity"],
    },
  ],
};

export const SELECT_ENTITY_TRACE: TraceAction = {
  id: "select-entity",
  title: "Entity Selected",
  events: [
    {
      id: "ui-click",
      layer: "ui",
      label: "Click an entity in the list",
      what: "The entity button's onClick sets selectedId via React's useState — nothing is fetched.",
      why: "Every entity was already loaded by the last real fetch (on page load, or the last Refresh); a plain selection has nothing left to ask a server for.",
      files: ["app/src/components/admin/ContentExplorerView.tsx"],
      conceptIds: ["local-state", "entity"],
    },
    {
      id: "ui-derive",
      layer: "ui",
      label: "Detail panel renders from already-loaded data",
      what: "selected is computed as entities.find(e => e.id === selectedId) on every render — a derived value, not its own state.",
      why: "Deriving selected from entities + selectedId, instead of storing the whole entity object twice, means the detail panel can never show a stale copy of an entity that Refresh or Apply Enrichment just updated.",
      files: ["app/src/components/admin/ContentExplorerView.tsx"],
      conceptIds: ["local-state"],
    },
  ],
};

export const CHECK_OTHER_SOURCES_TRACE: TraceAction = {
  id: "check-other-sources",
  title: "Checked Other Sources",
  events: [
    {
      id: "ui-click",
      layer: "ui",
      label: "Curator clicks Check Other Sources",
      what: "check() calls proposeEnrichment(entity.id) — a read-only request; nothing is written yet.",
      why: "A curator should be able to see what other sources would say before committing to anything, the same way you'd preview a diff before applying it.",
      files: ["app/src/components/admin/EnrichmentPanel.tsx"],
      conceptIds: ["enrichment"],
    },
    {
      id: "ui-data-layer",
      layer: "ui",
      label: "UI data layer",
      what: "proposeEnrichment(entityId) sends a GET to this app's own /api/admin proxy route.",
      why: "The browser never calls Atlas directly — every admin request goes through one typed data-layer module.",
      files: ["app/src/lib/data/explorer-repo.ts"],
      conceptIds: ["api"],
    },
    {
      id: "api-proxy",
      layer: "api",
      label: "Next.js API route (proxy)",
      what: "Forwards the GET to Atlas's real API, attaching the admin token server-side.",
      why: "ADMIN_TOKEN must never reach the browser — the proxy is the one place allowed to hold it.",
      files: ["app/src/app/api/admin/entities/[id]/enrichment/route.ts"],
      conceptIds: ["api"],
    },
    {
      id: "atlas-api",
      layer: "api",
      label: "Atlas API server",
      what: "GET /admin/entities/:id/enrichment constructs an EnrichmentService and calls proposeEnrichment(entityId).",
      why: "The API layer's only job is routing and auth — it holds no business logic of its own.",
      files: ["atlas/src/api/server.ts"],
      conceptIds: ["api", "service"],
    },
    {
      id: "gather-sources",
      layer: "service",
      label: "Find every source already linked to this entity",
      what: "Looks up every SourceRecord connected to this entity via a 'describes' relationship — the evidence Atlas already trusted enough to link, just not yet used to update the entity.",
      why: "Re-checking has to start from evidence Atlas already accepted, not from a fresh web search — that's what makes this a review of existing trust, not a new ingestion.",
      files: ["atlas/src/application/enrichment/EnrichmentService.ts"],
      conceptIds: ["source-record", "provenance"],
    },
    {
      id: "ai-extraction",
      layer: "service",
      label: "Re-run AI extraction on each source",
      what: "ExtractionService.extractCandidates() sends each linked source's real text to OpenAI again and validates what comes back — including a geocoding-rescue pass for any Place with no stated coordinates.",
      why: "A source's own text is re-read fresh each time, rather than trusting a cached interpretation from whenever it was first ingested — the source may say more than Atlas originally captured.",
      files: [
        "atlas/src/ingestion/extraction/ExtractionService.ts",
        "atlas/src/ingestion/extraction/ExtractionDefinition.ts",
      ],
      conceptIds: ["ai-extraction", "geocoding-rescue"],
    },
    {
      id: "duplicate-match",
      layer: "service",
      label: "Match each candidate back to this entity",
      what: "DuplicateGuard.findDuplicate() decides whether each freshly-extracted candidate is really describing the entity being checked, by name/alias and geographic proximity — not an exact string match.",
      why: "The same identity-matching rule Atlas uses at ingestion time is reused here, so a source that spells the name differently still gets recognized correctly.",
      files: ["atlas/src/ingestion/dedup/DuplicateGuard.ts"],
      conceptIds: ["duplicate-detection"],
    },
    {
      id: "response",
      layer: "response",
      label: "Proposals returned to the UI — nothing persisted",
      what: "Every field where a source's current answer differs from what's stored becomes a FieldProposal; the response is rendered as review cards. No entity, SourceRecord, or relationship is written by this action.",
      why: "Read and write are kept as two distinct actions — Check Other Sources only ever shows you what's possible; Apply Enrichment is the one action that actually commits anything.",
      files: ["app/src/components/admin/EnrichmentPanel.tsx"],
      conceptIds: ["enrichment"],
    },
  ],
};

export const REFRESH_TRACE: TraceAction = {
  id: "refresh",
  title: "Refreshed Content Explorer",
  events: [
    {
      id: "ui-click",
      layer: "ui",
      label: "Curator clicks Refresh",
      what: "load(includeArchived) is called directly from the button's onClick.",
      why: "A curator needs a way to pull the current, real state back from Atlas — especially right after an action (like Apply Enrichment on another tab) that could have changed it.",
      files: ["app/src/components/admin/ContentExplorerView.tsx"],
      conceptIds: ["entity"],
    },
    {
      id: "parallel-fetch",
      layer: "api",
      label: "Four real GETs, in parallel",
      what: "listAllEntities (or the archived-inclusive variant), listSourceRecords, listRelationships, and listMergeRecords all fire together via Promise.all, each through its own /api/admin proxy route to Atlas.",
      why: "These four collections are independent — there's no reason to wait for entities before asking for source records, so they're requested together instead of one after another.",
      files: [
        "app/src/lib/data/explorer-repo.ts",
        "app/src/app/api/admin/entities/route.ts",
      ],
      conceptIds: ["api"],
    },
    {
      id: "response",
      layer: "response",
      label: "State updated, UI re-renders",
      what: "setEntities/setSourceRecords/setRelationships/setMergeRecords all update from the real response bodies — nothing here is optimistic or assumed.",
      why: "What's on screen has to reflect what Atlas actually has right now, not a locally-patched guess.",
      files: ["app/src/components/admin/ContentExplorerView.tsx"],
      conceptIds: ["entity"],
    },
  ],
};

export const TRACE_ACTIONS: readonly TraceAction[] = [
  APPLY_ENRICHMENT_TRACE,
  SELECT_ENTITY_TRACE,
  CHECK_OTHER_SOURCES_TRACE,
  REFRESH_TRACE,
];

export function getTraceAction(id: string): TraceAction | undefined {
  return TRACE_ACTIONS.find((a) => a.id === id);
}
