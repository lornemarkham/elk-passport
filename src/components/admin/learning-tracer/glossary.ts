/**
 * Learning Tracer — concept glossary (MVP v0.1).
 *
 * A small, static, hand-authored reference — not a database, not
 * AI-generated. Every entry is grounded in real Passport/Atlas code, most
 * of it written or discovered during tonight's session (2026-08-09/10).
 * Definitions here are deliberately plain-English first, correct
 * terminology second — see learning-tracer/README.md for the philosophy
 * this follows.
 *
 * This is a sibling to `atlas/engineering-coach`, not a replacement for it.
 * Engineering Coach tracks longer-term mastery (curriculum, evidence,
 * Bloom/SFIA scoring) across ~210 concepts. This glossary exists purely to
 * back the Learning Tracer's in-the-moment "what did I just touch"
 * explanations for one real action at a time. Nothing here is scored, and
 * none of tonight's concepts (Provenance, External ID, ORCS, Idempotency,
 * Type Guard, Tuple, Function Overloading, Runtime Verification, Geocoding
 * Rescue, Ontology, Knowledge Graph, Derived Knowledge) exist in Engineering
 * Coach's curriculum yet — a natural candidate for it to absorb later, not
 * done here to keep this MVP small.
 */

export interface GlossaryConcept {
  readonly id: string;
  readonly term: string;
  /** Plain-English, one or two sentences. What it is. */
  readonly definition: string;
  /** Why the concept exists at all — the problem it solves. */
  readonly whyItMatters: string;
  /** A real, concrete example from tonight's Passport/Atlas work. */
  readonly passportExample: string;
  readonly relatedConcepts: readonly string[];
  /** Real files in this repo where you can see the concept in use — workspace-relative paths. */
  readonly files: readonly string[];
}

export const GLOSSARY: readonly GlossaryConcept[] = [
  {
    id: "entity",
    term: "Entity",
    definition:
      "A thing the system knows about, with its own identity and a stable ID.",
    whyItMatters:
      "Atlas needs a consistent way to represent every real-world thing it reasons about — a Place, an Organization, an Activity, an Event — so every other concept (relationships, provenance, enrichment) has something concrete to attach to.",
    passportExample:
      "Ellison Provincial Park is a Place entity. It has an id, a name, aliases, and — as of tonight — facilities and external IDs.",
    relatedConcepts: [
      "ontology",
      "relationship",
      "knowledge-graph",
      "provenance",
    ],
    files: [
      "atlas/src/domain/entities/Place.ts",
      "atlas/src/domain/entities/DomainEntity.ts",
    ],
  },
  {
    id: "enrichment",
    term: "Enrichment",
    definition:
      "Adding new, source-backed knowledge to an entity Atlas already has, after a human reviews and approves it.",
    whyItMatters:
      "Atlas often links a new source (like a BC Parks record) to an entity it already knows about. That source may know things the entity doesn't have yet — enrichment is how that new knowledge gets proposed, reviewed, and adopted, instead of silently overwriting what's stored.",
    passportExample:
      'Clicking "Check other sources" on Ellison Provincial Park re-extracts every linked source and proposes fields — like Confirmed facilities — that differ from what\'s currently stored.',
    relatedConcepts: ["provenance", "source-record", "entity", "service"],
    files: [
      "atlas/src/application/enrichment/EnrichmentService.ts",
      "app/src/components/admin/EnrichmentPanel.tsx",
    ],
  },
  {
    id: "provenance",
    term: "Provenance",
    definition: "Evidence showing where a piece of knowledge came from.",
    whyItMatters:
      "Atlas needs to explain why it believes a fact and which source supported it — a fact with no traceable origin can't be trusted or corrected later.",
    passportExample:
      "BC Parks is the source supporting Ellison Park's facilities. When a curator applies that field, Atlas writes a `passport-editorial` SourceRecord recording exactly what was applied and why, linked to the entity the same way every other claim is.",
    relatedConcepts: ["source-record", "enrichment", "entity"],
    files: [
      "atlas/src/application/enrichment/EnrichmentService.ts",
      "atlas/src/domain/entities/SourceRecord.ts",
    ],
  },
  {
    id: "source-record",
    term: "SourceRecord",
    definition:
      "A stored snapshot of one piece of evidence Atlas pulled from somewhere — a webpage, an API response, a curator's own decision.",
    whyItMatters:
      "Every fact Atlas knows has to trace back to something real. SourceRecord is that unit of evidence — immutable once written, so what a source actually said at the time is never lost even if the field it produced later changes.",
    passportExample:
      'Each BC Parks fetch for Ellison Park creates one SourceRecord holding that page\'s full text, including the "Confirmed facilities" line the loader builds.',
    relatedConcepts: ["provenance", "entity", "database"],
    files: [
      "atlas/src/domain/entities/SourceRecord.ts",
      "atlas/src/ingestion/loaders/BCParksSourceLoader.ts",
    ],
  },
  {
    id: "api",
    term: "API",
    definition:
      "The defined set of requests a client (like the Curator Workbench) can send to a server to read or change data.",
    whyItMatters:
      "The UI never touches the database directly — it goes through an API, which is what lets the frontend and backend evolve independently and lets Atlas control exactly what's allowed to happen to its data.",
    passportExample:
      "`POST /admin/entities/:id/enrichment` is the real Atlas API endpoint the Curator Workbench calls when you click Apply.",
    relatedConcepts: ["service", "persistence"],
    files: [
      "atlas/src/api/server.ts",
      "app/src/app/api/admin/entities/[id]/enrichment/route.ts",
    ],
  },
  {
    id: "service",
    term: "Service",
    definition:
      "A class that holds one piece of application logic — the actual decision-making — separate from both the API layer and the database layer.",
    whyItMatters:
      "Keeping logic in a service (not the API route, not the store) means the same logic can be tested directly, reused, and reasoned about without needing a running server or database.",
    passportExample:
      "`EnrichmentService` decides what proposeEnrichment surfaces and what applyEnrichment actually writes — the API route only forwards the request to it.",
    relatedConcepts: ["api", "store", "entity"],
    files: [
      "atlas/src/application/enrichment/EnrichmentService.ts",
      "atlas/src/ingestion/extraction/ExtractionService.ts",
    ],
  },
  {
    id: "store",
    term: "Repository / Store",
    definition:
      "The one piece of code responsible for actually reading and writing entities to storage, hidden behind a consistent interface.",
    whyItMatters:
      "Nothing else in Atlas needs to know whether data lives in Supabase or in memory for a test — it just calls `store.saveEntity(...)`. That's what lets `SupabaseAtlasStore` and `InMemoryAtlasStore` both satisfy the exact same `AtlasStore` interface.",
    passportExample:
      "`EnrichmentService.applyEnrichment` calls `this.store.saveEntity(updated)` without knowing or caring which concrete store is running underneath.",
    relatedConcepts: ["persistence", "database", "service"],
    files: [
      "atlas/src/ingestion/persistence/AtlasStore.ts",
      "atlas/src/ingestion/persistence/SupabaseAtlasStore.ts",
      "atlas/src/ingestion/persistence/InMemoryAtlasStore.ts",
    ],
  },
  {
    id: "persistence",
    term: "Persistence",
    definition:
      "Saving application state somewhere that survives beyond the current request — a restart, a crash, a new browser tab.",
    whyItMatters:
      "Without persistence, every fact Atlas learned would disappear the moment the server restarted. Persistence is what turns a one-off computation into durable knowledge.",
    passportExample:
      "When a curator applies enrichment, the updated Place and its new editorial SourceRecord are both persisted to Supabase — they're still there tomorrow.",
    relatedConcepts: ["store", "database"],
    files: ["atlas/src/ingestion/persistence/SupabaseAtlasStore.ts"],
  },
  {
    id: "database",
    term: "Database",
    definition:
      "The actual system that stores structured data on disk, long-term — tables, rows, columns.",
    whyItMatters:
      "It's the thing everything else in the persistence layer is ultimately writing to and reading from — the durable source of truth once a request completes.",
    passportExample:
      "Atlas uses Supabase (hosted PostgreSQL). Applying enrichment ultimately runs `.upsert()` calls against the real `places` and `source_records` tables.",
    relatedConcepts: ["persistence", "store"],
    files: [
      "atlas/supabase/migrations",
      "atlas/src/ingestion/persistence/SupabaseAtlasStore.ts",
    ],
  },
  {
    id: "ontology",
    term: "Ontology",
    definition:
      "The organized model of what kinds of things exist in a system and how they relate to each other.",
    whyItMatters:
      'Before Atlas can reason about travel, it has to agree on what a "thing" even is — a Place is not an Organization, and "near" means something different from "contains." The ontology is that agreement, written down.',
    passportExample:
      "Place, Organization, Activity, and Event are the entity kinds in the Passport/Atlas ontology; `near` is one of its relationship types.",
    relatedConcepts: ["entity", "relationship", "knowledge-graph"],
    files: [
      "docs/content-model/atlas-entity-schema.md",
      "atlas/src/domain/entities/Place.ts",
    ],
  },
  {
    id: "knowledge-graph",
    term: "Knowledge Graph",
    definition:
      "A system where things are represented as entities and meaningful connections are represented as relationships, instead of just flat database rows.",
    whyItMatters:
      'A knowledge graph lets Atlas answer questions a plain table can\'t — not just "what is Ellison Park" but "what is Ellison Park near, and why."',
    passportExample:
      "Atlas storing Ellison Park (entity) and a `near` relationship to Predator Ridge Resort (another entity) is what makes it a knowledge graph rather than a collection of rows.",
    relatedConcepts: [
      "entity",
      "relationship",
      "ontology",
      "derived-knowledge",
    ],
    files: [
      "atlas/src/domain/relationships/Relationship.ts",
      "atlas/src/domain/entities/DomainEntity.ts",
    ],
  },
  {
    id: "external-id",
    term: "External ID",
    definition:
      "A stable identifier assigned to something by another system, that Atlas stores alongside its own ID.",
    whyItMatters:
      'Names drift and vary ("Ellison Park" vs. "Ellison Provincial Park"), but a stable external ID from an authoritative source doesn\'t — it\'s strong evidence two records describe the same real-world thing.',
    passportExample:
      'BC Parks ORCS 139 is stored on Ellison Park\'s `externalIds` field as `{ system: "bcparks-orcs", id: "139" }`.',
    relatedConcepts: ["orcs", "entity", "provenance"],
    files: [
      "atlas/src/domain/entities/Place.ts",
      "atlas/src/ingestion/loaders/BCParksSourceLoader.ts",
    ],
  },
  {
    id: "orcs",
    term: "ORCS",
    definition:
      "Operational Records Classification System — BC Parks' own stable numeric identifier for a protected area.",
    whyItMatters:
      "It's the concrete, real-world example of an External ID this project actually uses — a government system's own identifier, not something Atlas invented.",
    passportExample:
      "`bcparks-orcs: 139` identifies Ellison Park; `bcparks-orcs: 277` identifies Kalamalka Lake Park.",
    relatedConcepts: ["external-id"],
    files: ["atlas/src/ingestion/loaders/BCParksSourceLoader.ts"],
  },
  {
    id: "relationship",
    term: "Relationship",
    definition: "A meaningful, named connection between two entities.",
    whyItMatters:
      'Facts about how things relate — not just what they are — are often the more useful half of what a traveler actually wants to know ("what\'s near here"), and a relationship is how Atlas represents that explicitly instead of leaving it implicit.',
    passportExample:
      "Ellison Park `near` Predator Ridge Resort is a real, stored Relationship record, distinct from either entity.",
    relatedConcepts: ["entity", "knowledge-graph", "derived-knowledge"],
    files: [
      "atlas/src/domain/relationships/Relationship.ts",
      "atlas/src/application/relationships/NearRelationshipComputer.ts",
    ],
  },
  {
    id: "derived-knowledge",
    term: "Derived Knowledge",
    definition:
      "Knowledge computed from existing facts, rather than stated directly by a source.",
    whyItMatters:
      "Not everything worth knowing was ever written down somewhere — some facts only become visible once you combine what you already have. Atlas needs a clear way to mark that kind of fact as computed, not sourced.",
    passportExample:
      "Nobody told Atlas Kal Beach is near Kalavista Boat Launch — `NearRelationshipComputer` derived that from both places' stored coordinates.",
    relatedConcepts: ["relationship", "idempotency"],
    files: ["atlas/src/application/relationships/NearRelationshipComputer.ts"],
  },
  {
    id: "idempotency",
    term: "Idempotency",
    definition:
      "Running the same operation repeatedly produces the same final result, instead of creating duplicates or accumulating unintended changes.",
    whyItMatters:
      "A derived-knowledge computation like `near` relationships needs to be safely re-runnable — as source data grows, re-running it should only add genuinely new relationships, never duplicate ones that already exist.",
    passportExample:
      'Running `npm run compute-near-relationships` twice in a row: the second run reported 155 existing relationships and "No new relationships to create" — proof of idempotent behavior.',
    relatedConcepts: ["derived-knowledge"],
    files: [
      "atlas/src/application/relationships/NearRelationshipComputer.ts",
      "atlas/src/explorer/computeNearRelationshipsCli.ts",
    ],
  },
  {
    id: "type-guard",
    term: "Type Guard",
    definition:
      "TypeScript logic that proves to the compiler what specific type a value actually has, so later code can safely use it as that type.",
    whyItMatters:
      "TypeScript can't always tell which of several possible shapes a value has just from its declared type — a type guard is how code narrows that down explicitly, so the compiler stops requiring a defensive check that would otherwise never go away.",
    passportExample:
      "Before computing distance between two Places, `NearRelationshipComputer` needed to prove a Place's geometry was actually a Point (not a Polygon) before passing its coordinates into `haversineKm`.",
    relatedConcepts: ["tuple"],
    files: ["atlas/src/application/relationships/NearRelationshipComputer.ts"],
  },
  {
    id: "tuple",
    term: "Tuple",
    definition:
      'An array whose length and the type of each position are known and fixed by the type system — not just "an array of strings," but "exactly two strings, in this order."',
    whyItMatters:
      "A plain array's length isn't tracked by TypeScript, so code that assumes \"exactly two items\" can silently stop being provably true after something as ordinary as calling `.sort()`.",
    passportExample:
      "`[a.id, b.id].sort()` returns a plain `string[]`, not a 2-tuple, so TypeScript could no longer guarantee two defined values existed — fixed with explicit two-value ordering instead of relying on `.sort()`.",
    relatedConcepts: ["type-guard"],
    files: ["atlas/src/application/relationships/NearRelationshipComputer.ts"],
  },
  {
    id: "function-overloading",
    term: "Function Overloading",
    definition:
      "Multiple functions (or, in SQL, database functions) can share the same name as long as their parameter signatures differ.",
    whyItMatters:
      "It's easy to assume `CREATE OR REPLACE FUNCTION` always replaces the one function you meant — but if the new version has a different parameter list, the database keeps the old one around too, silently, as a second overload.",
    passportExample:
      "Adding a parameter to `merge_places` for `external_ids`, and later for `facilities`, each created a new overload instead of replacing the old one — which is exactly why a bare `GRANT EXECUTE ON FUNCTION merge_places` became ambiguous.",
    relatedConcepts: ["database"],
    files: [
      "atlas/supabase/migrations/202608101115_merge_places_facilities.sql",
    ],
  },
  {
    id: "runtime-verification",
    term: "Runtime Verification",
    definition:
      "Checking what the real, running system actually does, rather than trusting assumptions or unit tests alone.",
    whyItMatters:
      "Passing unit tests only prove the code behaves correctly for the inputs the tests chose — they can't catch a bug that only shows up with real data flowing through the real pipeline, like an object reconstructed mid-pipeline losing fields no test happened to exercise.",
    passportExample:
      "Temporary diagnostic logs traced BC Parks facilities from SourceRecord, through AI extraction, through geocoding rescue, to the enrichment API — and found a real bug (fields silently dropped) that every existing unit test had missed.",
    relatedConcepts: ["geocoding-rescue"],
    files: ["atlas/src/ingestion/extraction/ExtractionService.ts"],
  },
  {
    id: "geocoding",
    term: "Geocoding",
    definition:
      "Looking up real-world geographic coordinates for a named place.",
    whyItMatters:
      'A source\'s text often names a place without stating its coordinates — geocoding is what turns "Ellison Park" into an actual latitude/longitude Atlas can store and compute distances from.',
    passportExample:
      "`NominatimGeocoder` looks up a Place's name against OpenStreetMap's Nominatim service to find its coordinates.",
    relatedConcepts: ["geocoding-rescue"],
    files: [
      "atlas/src/ingestion/extraction/geocoding/Geocoder.ts",
      "atlas/src/ingestion/extraction/geocoding/NominatimGeocoder.ts",
    ],
  },
  {
    id: "geocoding-rescue",
    term: "Geocoding Rescue",
    definition:
      "A fallback path used when an extracted Place has no coordinates: Atlas geocodes the place name and reconstructs the entity proposal with real coordinates instead of dropping it.",
    whyItMatters:
      "Without this rescue path, any source that never states coordinates as text — every BC Parks source, for example — would have its Place proposals dropped outright, even though everything else about them is real and usable.",
    passportExample:
      "Tonight's real bug lived here: `UngeocodedPlaceProposal` was built before `hasActiveFireBan`, `activities`, `externalIds`, and `facilities` existed, so every BC Parks Place rescued through this path silently lost those four fields on reconstruction — fixed by extending the type and carrying the fields through.",
    relatedConcepts: ["geocoding", "runtime-verification", "entity"],
    files: [
      "atlas/src/ingestion/extraction/ExtractionService.ts",
      "atlas/src/ingestion/extraction/ExtractionTypes.ts",
    ],
  },
  {
    id: "local-state",
    term: "Local (Client) State",
    definition:
      "Data a UI component holds in memory for its own use — never fetched, never persisted, gone the moment the tab reloads.",
    whyItMatters:
      'Not every user action needs the network. Recognizing when something is "just UI" — versus when it genuinely reaches a server — is what stops you from either over-engineering a trivial interaction or assuming something is safely saved when it isn\'t.',
    passportExample:
      "Selecting an entity in Content Explorer just sets a selectedId in React state — every entity's data was already loaded by the last real fetch, so selecting one is instant and offline-safe.",
    relatedConcepts: ["entity"],
    files: ["app/src/components/admin/ContentExplorerView.tsx"],
  },
  {
    id: "ai-extraction",
    term: "AI Extraction",
    definition:
      "Using a language model to read a source's raw text and propose structured field values for a domain entity.",
    whyItMatters:
      "A source is prose, not structured data — extraction is the one place free text becomes something Atlas's domain model can actually store as a typed field.",
    passportExample:
      "ExtractionService.extractCandidates() sends a BC Parks page's text to OpenAI and gets back a candidate Place with a name, description, and any facilities the source actually states.",
    relatedConcepts: ["entity", "geocoding-rescue", "runtime-verification"],
    files: [
      "atlas/src/ingestion/extraction/ExtractionService.ts",
      "atlas/src/ingestion/extraction/ExtractionDefinition.ts",
    ],
  },
  {
    id: "duplicate-detection",
    term: "Duplicate Detection",
    definition:
      "Deciding whether two records — possibly with different names — describe the same real-world thing.",
    whyItMatters:
      'Sources rarely agree on a name ("Ellison Park" vs. "Ellison Provincial Park"). Without duplicate detection, Atlas would create a new entity for every source instead of recognizing corroborating evidence about one.',
    passportExample:
      "DuplicateGuard.findDuplicate() matches a freshly re-extracted BC Parks candidate back to the existing Ellison Provincial Park entity by name/alias and geographic proximity, not an exact string match.",
    relatedConcepts: ["entity", "enrichment"],
    files: ["atlas/src/ingestion/dedup/DuplicateGuard.ts"],
  },
];

export function getConcept(id: string): GlossaryConcept | undefined {
  return GLOSSARY.find((c) => c.id === id);
}
