"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import { Search, MapPin, GitMerge } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type {
  AdminEntity,
  CompletenessScoreResult,
} from "@/lib/data/admin-repo";
import {
  AdminNotConfiguredError,
  getContentHealth,
} from "@/lib/data/admin-repo";
import {
  listAllEntities,
  listAllEntitiesIncludingArchived,
  listMergeRecords,
  listRelationshipCandidates,
  listRelationships,
  listSourceRecords,
  type MergeRecord,
  type Relationship,
  type RelationshipCandidate,
  type SourceRecord,
} from "@/lib/data/explorer-repo";
import { AdminSetupNotice } from "./AdminSetupNotice";
import { EnrichmentPanel } from "./EnrichmentPanel";
import { ContainsRelationshipForm } from "./ContainsRelationshipForm";
import { SourceRecordRow } from "./SourceRecordRow";
import { KnowledgeScorePanel } from "./KnowledgeScorePanel";
import { SourceCoveragePanel } from "./SourceCoveragePanel";
import {
  fieldLabel,
  fieldNamesFor,
  formatFieldValue,
  isImageField,
} from "./entityFieldFormat";
import {
  SCORE_TIER_LEGEND,
  scoreBadgeClasses,
  scoreTierLabel,
} from "./knowledgeScorePresentation";
import { useTrace } from "./learning-tracer/TraceContext";

type LoadState = "loading" | "ready" | "error" | "not-configured";
type KindFilter = "all" | "Place" | "Organization" | "Activity" | "Event";

const KINDS: readonly KindFilter[] = [
  "all",
  "Place",
  "Organization",
  "Activity",
  "Event",
];

// Fields whose values read poorly squeezed into a narrow grid column —
// kept full-width in the Fields grid below regardless of how short a
// particular entity's value happens to be, since a curator scanning many
// entities benefits from the same field always landing in the same place.
const FULL_WIDTH_FIELDS = new Set(["description"]);

function completeness(entity: AdminEntity): { filled: number; total: number } {
  const fields = fieldNamesFor([entity]);
  const filled = fields.filter(
    (field) => formatFieldValue(field, entity[field]) !== "—",
  ).length;
  return { filled, total: fields.length };
}

function isArchived(entity: AdminEntity): boolean {
  return Boolean(entity.archivedAt);
}

function entityName(entities: AdminEntity[], id: string): string {
  return entities.find((e) => e.id === id)?.name ?? id;
}

/**
 * The entity list's lightweight quality signal (Sprint 2, §5) — reuses
 * the real Completeness Score fetched from `/admin-health`
 * rather than inventing a second scoring concept. Falls back to nothing
 * (not a placeholder badge) while the score fetch is still in flight or
 * failed — the list's existing "N/M fields populated" line already
 * covers that gap honestly.
 */
function QualityBadge({
  score,
}: {
  score: CompletenessScoreResult | undefined;
}) {
  if (!score) return null;
  return (
    <Badge
      variant="outline"
      title={`Knowledge Score — ${SCORE_TIER_LEGEND}`}
      className={`shrink-0 text-[10px] ${scoreBadgeClasses(score.overallPercent)}`}
    >
      {score.overallPercent}% · {scoreTierLabel(score.overallPercent)}
    </Badge>
  );
}

/** A small, consistent "section eyebrow" used for every panel in the detail view — one visual pattern instead of each section inventing its own heading treatment. */
function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <p className="text-foreground/90 mb-2 text-[11px] font-semibold tracking-wide uppercase">
      {children}
    </p>
  );
}

/** External ids rendered as individual pills — a curator scanning for "does this have a BC Parks ORCS number" shouldn't have to parse a comma-joined string to find out. */
function ExternalIdPills({ value }: { value: readonly unknown[] }) {
  if (value.length === 0)
    return (
      <span className="text-muted-foreground/60 italic">not known yet</span>
    );
  return (
    <div className="flex flex-wrap gap-1">
      {value.map((entry, i) => {
        const isPair =
          typeof entry === "object" &&
          entry !== null &&
          "system" in entry &&
          "id" in entry;
        const text = isPair
          ? `${String((entry as { system: unknown }).system)}: ${String((entry as { id: unknown }).id)}`
          : JSON.stringify(entry);
        return (
          <Badge
            key={i}
            variant="outline"
            className="border-primary/30 bg-primary/5 font-mono text-[11px]"
          >
            {text}
          </Badge>
        );
      })}
    </div>
  );
}

/** A Point geometry rendered as a compact, unmistakably-coordinates chip rather than a bare "lat, lon" string easy to mistake for something else. */
function CoordinateChip({ value }: { value: unknown }) {
  if (
    typeof value !== "object" ||
    value === null ||
    !("type" in value) ||
    (value as { type: unknown }).type !== "Point" ||
    !("coordinates" in value)
  ) {
    return <span>Shape on file (not a single point)</span>;
  }
  const [lon, lat] = (value as { coordinates: [number, number] }).coordinates;
  return (
    <span className="bg-muted/40 inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-xs">
      <MapPin className="text-muted-foreground h-3 w-3" />
      {lat.toFixed(4)}, {lon.toFixed(4)}
    </span>
  );
}

/**
 * The Atlas Content Explorer — the one authoritative place to inspect
 * everything Atlas knows about an entity: its fields (populated or not),
 * every source that describes it in full (never truncated — this is a
 * debugging tool, not a curator-polish surface), every relationship, and
 * its merge lineage if it has one. Not the traveler experience, and not a
 * second admin page next to it — this page is meant to keep absorbing that
 * role as the schema grows (Phase 3+), not be replaced by a new one.
 *
 * "Include archived" exists because an absorbed entity (IMP-007 merge)
 * becomes invisible everywhere else by design — this is the one place that
 * can still find it, specifically to answer "what happened to this record."
 *
 * Curator Workbench v2: the detail panel changed from one long stacked
 * document to a denser set of clearly separated panels — same data, same
 * fetch logic, same actions, laid out so a curator answers "what is this /
 * what do we know / where did it come from / what needs my attention"
 * without scrolling through fields that happen to be empty to get there.
 */
export function ContentExplorerView() {
  const [entities, setEntities] = useState<AdminEntity[]>([]);
  const [sourceRecords, setSourceRecords] = useState<SourceRecord[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [mergeRecords, setMergeRecords] = useState<MergeRecord[]>([]);
  // Phase 5.1 — pending contains candidates a standalone discovery pass
  // already found and persisted; never written to from here.
  const [relationshipCandidates, setRelationshipCandidates] = useState<
    RelationshipCandidate[]
  >([]);
  // Sprint 2 — Completeness Scores, fetched alongside everything else.
  // Kept in its own state (not folded into `entities`) since it comes from
  // a different endpoint (`/admin-health`) with its own honest
  // possibility of failing independently — a curator should still be able
  // to browse and edit entities even if scoring is temporarily unavailable.
  const [scores, setScores] = useState<CompletenessScoreResult[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  // Sprint 2 — seeded from `?entityId=` so the Curator Queue's "Open in
  // Content Explorer" links land directly on the flagged entity. A plain
  // `useState` initializer, not an effect: this only ever needs to run
  // once, on mount, and `entities` doesn't need to have loaded yet for it
  // to take effect — `selected` below just resolves once they have.
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    searchParams.get("entityId"),
  );
  const [includeArchived, setIncludeArchived] = useState(false);

  // Learning Tracer — record() is called directly, right where each real
  // action actually completes, rather than threaded up through props. The
  // panel itself lives in the shared Curator Workbench layout, not here.
  const { record } = useTrace();

  /**
   * `isCancelled` lets a caller abandon a load whose result is no longer
   * wanted. Event handlers omit it — their result is always wanted. The
   * effect passes one, so a superseded toggle cannot overwrite the newer
   * answer with an older one.
   */
  const load = useCallback(
    async (archived: boolean, isCancelled: () => boolean = () => false) => {
      if (!isCancelled()) setState("loading");
      setError(null);
      try {
        const [
          entityList,
          sourceRecordList,
          relationshipList,
          mergeRecordList,
          candidateList,
          healthResult,
        ] = await Promise.all([
          archived ? listAllEntitiesIncludingArchived() : listAllEntities(),
          listSourceRecords(),
          listRelationships(),
          listMergeRecords(),
          listRelationshipCandidates(),
          // Scored separately from the rest of the load — a failure here
          // is caught on its own so it degrades to "no score shown" rather
          // than taking down entity browsing entirely.
          getContentHealth().catch((err) => {
            console.error("Failed to load Completeness Scores:", err);
            return null;
          }),
        ]);
        // A superseded load must not write. Checked once, after the await
        // that made it superseded, and before anything is applied.
        if (isCancelled()) return;
        setEntities(entityList);
        setSourceRecords(sourceRecordList);
        setRelationships(relationshipList);
        setMergeRecords(mergeRecordList);
        setRelationshipCandidates(candidateList);
        setScores(healthResult?.scores ?? []);
        setState("ready");
      } catch (err) {
        // An abandoned load's failure is not this screen's failure — the
        // curator has already asked a different question.
        if (isCancelled()) return;
        if (err instanceof AdminNotConfiguredError) {
          setState("not-configured");
          return;
        }
        console.error("Failed to load Content Explorer data:", err);
        setError(err instanceof Error ? err.message : "Failed to load.");
        setState("error");
      }
    },
    [],
  );

  /**
   * **The fetch belongs to the effect, and the effect can be cancelled.**
   *
   * This used to call `load` directly, which sets `"loading"` on its first
   * line — a synchronous state write during an effect, and the
   * `react-hooks/set-state-in-effect` error that kept this file uncommitted.
   * Routing around it with a disable directive would have left the real
   * problem: nothing cancelled an in-flight load, so toggling *include
   * archived* twice raced two responses and the slower one won.
   *
   * `state` already starts as `"loading"`, so the mount pass announces
   * nothing it has not already said; a later toggle announces through the
   * same path as any other reload. Handlers keep calling `load` directly and
   * still `await` it — a state write in an event handler is ordinary, and the
   * Learning Tracer depends on that ordering.
   */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await load(includeArchived, () => cancelled);
    })();
    return () => {
      cancelled = true;
    };
  }, [includeArchived, load]);

  const filtered = useMemo(() => {
    return entities
      .filter((e) => kindFilter === "all" || e.kind === kindFilter)
      .filter(
        (e) =>
          !query.trim() ||
          e.name.toLowerCase().includes(query.trim().toLowerCase()),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entities, kindFilter, query]);

  const scoresByEntityId = useMemo(() => {
    return new Map(scores.map((score) => [score.entityId, score]));
  }, [scores]);

  const selected = entities.find((e) => e.id === selectedId) ?? null;
  const selectedScore = selected
    ? scoresByEntityId.get(selected.id)
    : undefined;

  const selectedSourceRecords = useMemo(() => {
    if (!selected) return [];
    const describingIds = relationships
      .filter((r) => r.type === "describes" && r.targetEntityId === selected.id)
      .map((r) => r.sourceEntityId);
    // Grouped by source type — a curator scanning "what does BC Parks say
    // vs. what does OSM say" shouldn't have to hunt through an
    // arbitrarily-ordered list to find both.
    return sourceRecords
      .filter((sr) => describingIds.includes(sr.id))
      .sort((a, b) => a.sourceType.localeCompare(b.sourceType));
  }, [selected, relationships, sourceRecords]);

  const selectedOtherRelationships = useMemo(() => {
    if (!selected) return [];
    return relationships.filter(
      (r) =>
        r.type !== "describes" &&
        (r.sourceEntityId === selected.id || r.targetEntityId === selected.id),
    );
  }, [selected, relationships]);

  // Grouped by relationship type — "contains (2)" once, not the same
  // "contains" badge repeated on every row underneath it.
  const relationshipsByType = useMemo(() => {
    const groups = new Map<string, Relationship[]>();
    for (const r of selectedOtherRelationships) {
      const list = groups.get(r.type) ?? [];
      list.push(r);
      groups.set(r.type, list);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [selectedOtherRelationships]);

  // Phase 4.2 (docs/content-model/relationships/contains.md) — the
  // immediate-parent invariant made visible: if a `contains` edge already
  // targets this entity, that's its one parent, full stop.
  const existingParent = useMemo(() => {
    if (!selected) return null;
    const edge = relationships.find(
      (r) => r.type === "contains" && r.targetEntityId === selected.id,
    );
    return edge
      ? { edge, name: entityName(entities, edge.sourceEntityId) }
      : null;
  }, [selected, relationships, entities]);

  const candidateContainsParents = useMemo(() => {
    if (!selected) return [];
    return entities.filter(
      (e) => e.kind === "Place" && e.id !== selected.id && !isArchived(e),
    );
  }, [selected, entities]);

  // Phase 5.1 — a pending discovery candidate targeting this entity, if
  // one exists. Atlas's own listRelationshipCandidates already excludes
  // stale candidates (referencing an archived entity) server-side.
  const persistedCandidateForSelected = useMemo(() => {
    if (!selected) return undefined;
    return relationshipCandidates.find(
      (c) => c.status === "pending" && c.targetEntityId === selected.id,
    );
  }, [selected, relationshipCandidates]);

  // Both directions: this entity absorbed others (it's `survivingId`), or
  // this entity was itself absorbed (it's `absorbedId`) — an archived
  // entity will only ever match the second case, an active one usually only
  // the first, but nothing stops an entity from eventually being both.
  const absorbedIntoThis = useMemo(
    () => mergeRecords.filter((m) => selected && m.survivingId === selected.id),
    [mergeRecords, selected],
  );
  const thisWasAbsorbedBy = useMemo(
    () => mergeRecords.find((m) => selected && m.absorbedId === selected.id),
    [mergeRecords, selected],
  );

  if (state === "not-configured") {
    return <AdminSetupNotice />;
  }

  if (state === "error") {
    return (
      <div className="rounded-xl border border-dashed py-12 text-center">
        <p className="font-medium">Couldn&apos;t load the Content Explorer</p>
        <p className="text-muted-foreground mt-1 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
      {/* Entity list */}
      <div className="flex flex-col gap-2.5">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
          <Input
            placeholder="Search by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {KINDS.map((kind) => (
            <button
              key={kind}
              onClick={() => setKindFilter(kind)}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                kindFilter === kind
                  ? "border-primary bg-primary/5 font-medium"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              {kind === "all" ? "All" : kind}
            </button>
          ))}
        </div>
        <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
          />
          Include archived (merged-away entities)
        </label>
        <p className="text-muted-foreground text-xs">
          {state === "loading"
            ? "Loading…"
            : `${filtered.length} of ${entities.length} entities`}
        </p>
        <div className="flex max-h-[75vh] flex-col gap-0.5 overflow-y-auto">
          {filtered.map((entity) => {
            const { filled, total } = completeness(entity);
            return (
              <button
                key={entity.id}
                onClick={() => {
                  setSelectedId(entity.id);
                  // Real, but tiny: this is genuinely just React state — no
                  // fetch happens, since every entity was already loaded.
                  record({ actionId: "select-entity", headline: entity.name });
                }}
                className={`flex flex-col gap-0.5 rounded-md border px-2 py-1.5 text-left text-sm transition-colors ${
                  selectedId === entity.id
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50 border-transparent"
                } ${isArchived(entity) ? "opacity-60" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{entity.name}</span>
                  <span className="flex shrink-0 gap-1">
                    {isArchived(entity) && (
                      <Badge
                        variant="outline"
                        className="border-amber-500 text-amber-700 dark:text-amber-400"
                      >
                        Archived
                      </Badge>
                    )}
                    <Badge variant="secondary">{entity.kind}</Badge>
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs">
                    {filled}/{total} fields populated
                  </span>
                  <QualityBadge score={scoresByEntityId.get(entity.id)} />
                </div>
              </button>
            );
          })}
          {state === "ready" && filtered.length === 0 && (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No matches.
            </p>
          )}
        </div>
      </div>

      {/* Detail */}
      <div>
        {!selected ? (
          <div className="text-muted-foreground flex h-full min-h-[300px] items-center justify-center rounded-xl border border-dashed text-sm">
            Select an entity to inspect it.
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col gap-4 py-4">
              {/* Header — what is this? */}
              <div className="flex items-start justify-between gap-3 border-b pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg leading-tight font-semibold">
                      {selected.name}
                    </h2>
                    <Badge variant="secondary">{selected.kind}</Badge>
                    {isArchived(selected) && (
                      <Badge
                        variant="outline"
                        className="border-amber-500 text-amber-700 dark:text-amber-400"
                      >
                        Archived
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground font-mono text-xs">
                    {selected.id}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await load(includeArchived);
                    // Recorded only after the real fetch resolves — the trace
                    // describes what actually happened, not what was requested.
                    record({
                      actionId: "refresh",
                      headline: "Content Explorer",
                      detail: includeArchived
                        ? "including archived"
                        : undefined,
                    });
                  }}
                >
                  Refresh
                </Button>
              </div>

              {/* Knowledge Score — Sprint 2's fix for Sprint 1's biggest gap:
                  the score existed but a curator had no way to find it.
                  Placed right after the header, before any raw field data,
                  so "how good is this entity's knowledge" is the first real
                  answer this panel gives. `undefined` (score fetch still
                  loading, or failed) renders nothing here — the Fields grid
                  below already tells the same story field-by-field either
                  way, so there's no broken-looking gap. */}
              {selectedScore && (
                <KnowledgeScorePanel
                  // Keyed by entity — the panel's own gap-improvement state
                  // (fetched lazily, per entity) has no business surviving a
                  // switch to a different entity; remounting via `key` is the
                  // React-idiomatic way to get that reset for free, instead
                  // of an effect that resets state on prop change.
                  key={selected.id}
                  score={selectedScore}
                  entityId={selected.id}
                  onApplied={() => load(includeArchived)}
                />
              )}

              {/* Source Coverage — Sprint 3.1. Sits directly under the
                  Knowledge Score for the same reason KnowledgeScorePanel
                  sits above Fields: "why does Atlas know what it knows" is
                  the natural next question after "how complete is it,"
                  answered as a plain inventory, not a second score. */}
              <SourceCoveragePanel
                key={`${selected.id}-coverage`}
                entityId={selected.id}
              />

              {/* Merge lineage — shown first when present, since it's often the
                  most important fact about an archived record: not "what are
                  its fields" but "what did it become." Styled as lineage, not
                  another source card: a left accent bar and icon rather than a
                  full bordered box, so it reads distinctly at a glance. */}
              {(thisWasAbsorbedBy || absorbedIntoThis.length > 0) && (
                <div className="flex gap-2.5 border-l-4 border-amber-500/70 bg-amber-500/5 py-1.5 pr-2 pl-3 text-sm">
                  <GitMerge className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="mb-0.5 font-medium text-amber-800 dark:text-amber-300">
                      Merge history
                    </p>
                    {thisWasAbsorbedBy && (
                      <p className="text-amber-900/80 dark:text-amber-200/80">
                        Merged into{" "}
                        <span className="font-medium">
                          {entityName(entities, thisWasAbsorbedBy.survivingId)}
                        </span>{" "}
                        on{" "}
                        {new Date(thisWasAbsorbedBy.mergedAt).toLocaleString()}
                        {thisWasAbsorbedBy.reason
                          ? ` — "${thisWasAbsorbedBy.reason}"`
                          : ""}
                      </p>
                    )}
                    {absorbedIntoThis.map((m) => (
                      <p
                        key={m.id}
                        className="text-amber-900/80 dark:text-amber-200/80"
                      >
                        Absorbed{" "}
                        <span className="font-medium">
                          {entityName(entities, m.absorbedId)}
                        </span>{" "}
                        on {new Date(m.mergedAt).toLocaleString()}
                        {m.reason ? ` — "${m.reason}"` : ""}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Fields — what do we know? Two columns on wide screens so an
                  entity with a dozen-plus fields (routine now, with BC Parks +
                  OSM both contributing) doesn't need a scroll of its own just
                  to see them all. */}
              <div>
                <SectionHeading>Fields</SectionHeading>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm lg:grid-cols-2">
                  {fieldNamesFor([selected]).map((field) => {
                    const value = selected[field];
                    const empty = formatFieldValue(field, value) === "—";
                    return (
                      <div
                        key={field}
                        className={`grid grid-cols-[150px_1fr] gap-2 py-0.5 ${
                          FULL_WIDTH_FIELDS.has(field) ? "lg:col-span-2" : ""
                        }`}
                      >
                        {/* No truncate: longer labels ("Wheelchair
                            accessibility") were being cut off with an
                            ellipsis at the old 130px width — wrapping onto
                            a second line loses nothing, silently hiding
                            part of a label does. */}
                        <dt
                          className={
                            empty
                              ? "text-muted-foreground/60"
                              : "text-muted-foreground"
                          }
                        >
                          {fieldLabel(field)}
                        </dt>
                        <dd
                          className={
                            empty ? "text-muted-foreground/60 italic" : ""
                          }
                        >
                          {isImageField(field) &&
                          typeof value === "string" &&
                          value ? (
                            // eslint-disable-next-line @next/next/no-img-element -- internal explorer, external source images
                            <img
                              src={value}
                              alt=""
                              className="h-16 w-16 rounded object-cover"
                            />
                          ) : field === "externalIds" &&
                            Array.isArray(value) ? (
                            <ExternalIdPills value={value} />
                          ) : field === "geometry" && !empty ? (
                            <CoordinateChip value={value} />
                          ) : empty ? (
                            "not known yet"
                          ) : (
                            formatFieldValue(field, value)
                          )}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </div>

              <Separator />

              {/* Enrichment — the most consequential curator workflow on this
                  page, given its own visual weight rather than blending into
                  the same undifferentiated stack as everything else.
                  key={selected.id} is load-bearing, not decoration: without
                  it React reuses the same EnrichmentPanel instance across a
                  selection change (same component type, same position in
                  the tree), so its internal review/selected-fields state
                  from the previous entity stayed visible after switching —
                  the exact bug already found and fixed for
                  ContainsRelationshipForm in Phase 5.1, never applied here
                  until now. Remounting on every new entity id is what
                  actually resets it; Refresh never could, since it only
                  refetches ContentExplorerView's own data, not this
                  component's local state. */}
              <EnrichmentPanel
                key={selected.id}
                entity={selected}
                onApplied={() => load(includeArchived)}
              />

              <Separator />

              {/* Provenance — where did it come from? Collapsed by default;
                  a curator sees source, date, and a first-line preview of
                  what was extracted, and opens only the ones worth a closer
                  look. */}
              <div>
                <SectionHeading>
                  Sources ({selectedSourceRecords.length})
                </SectionHeading>
                {selectedSourceRecords.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No source record found — unexpected for a real entity, worth
                    investigating.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {selectedSourceRecords.map((sr) => (
                      <SourceRecordRow key={sr.id} sourceRecord={sr} />
                    ))}
                  </div>
                )}
              </div>

              {/* contains (Phase 4.2) — Place-to-Place only, per
                  docs/content-model/relationships/contains.md's Definition.
                  Archived entities excluded: an absorbed record's own store
                  lookup would reject it anyway (listEntities excludes
                  archived by default), so the form shouldn't offer it. */}
              {selected.kind === "Place" && !isArchived(selected) && (
                <>
                  <Separator />
                  <div>
                    <SectionHeading>Parent place</SectionHeading>
                    <ContainsRelationshipForm
                      // Keyed on the selected entity so its suggestion/confirm/
                      // reject state resets cleanly on every new selection,
                      // instead of a stale mode leaking from the previous one.
                      key={selected.id}
                      entity={selected}
                      candidateParents={candidateContainsParents}
                      relationships={relationships}
                      sourceRecords={sourceRecords}
                      persistedCandidate={persistedCandidateForSelected}
                      existingParentName={existingParent?.name}
                      onCreated={() => load(includeArchived)}
                    />
                  </div>
                </>
              )}

              {/* Other relationships — grouped by type so the same badge
                  isn't repeated on every row underneath its own heading. */}
              {relationshipsByType.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <SectionHeading>
                      Relationships ({selectedOtherRelationships.length})
                    </SectionHeading>
                    <div className="flex flex-col gap-2.5">
                      {relationshipsByType.map(([type, rels]) => (
                        <div key={type}>
                          <div className="mb-1 flex items-center gap-1.5">
                            <Badge variant="outline">{type}</Badge>
                            <span className="text-muted-foreground text-xs">
                              {rels.length}{" "}
                              {rels.length === 1
                                ? "relationship"
                                : "relationships"}
                            </span>
                          </div>
                          <div className="flex flex-col gap-0.5 pl-1 text-sm">
                            {rels.map((r) => (
                              <div key={r.id} className="text-muted-foreground">
                                {r.sourceEntityId === selected.id
                                  ? `→ ${entityName(entities, r.targetEntityId)}`
                                  : `← ${entityName(entities, r.sourceEntityId)}`}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
