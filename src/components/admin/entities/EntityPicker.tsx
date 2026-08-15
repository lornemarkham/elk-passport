"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, ChevronRight, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { hasRealType } from "./entityGaps";

export interface PickerEntity {
  id: string;
  name: string;
  kind: string;
  /** The source's own word — "ski resort", "winery". Evidence, never normalised. */
  subtype?: string;
  score: number | null;
  sourceCount: number;
  /** Entities this one directly contains. Real `contains` edges. */
  containsCount: number;
  /** Every non-`describes` edge touching it, either direction. */
  relationshipCount: number;
  hasImage: boolean;
  /** Present only inside a region: did a curator place this, or does a member contain it? */
  membership?: "direct" | "indirect";
  awaitingReview?: boolean;
  researching?: boolean;
  /** What the most recent run did to this entity, if anything. */
  changed?: "new" | "updated";
}

type SortKey = "needs-work" | "name" | "sources" | "connections";

/**
 * A gap filter. Each is a **measured absence**, not a judgement — the
 * browser's job is to find entities by what Atlas does or does not hold,
 * and to leave "is that bad?" to the curator.
 */
type GapKey =
  | "all"
  | "needs-review"
  | "researching"
  | "no-sources"
  | "no-relationships"
  | "no-image"
  | "unscored"
  | "no-type"
  | "changed"
  | "thin";

const KINDS = ["All", "Place", "Organization", "Activity", "Event"] as const;

const GAPS: {
  key: GapKey;
  label: string;
  match: (e: PickerEntity) => boolean;
}[] = [
  { key: "all", label: "All", match: () => true },
  {
    key: "changed",
    label: "Changed just now",
    match: (e) => e.changed !== undefined,
  },
  {
    key: "needs-review",
    label: "Needs review",
    match: (e) => !!e.awaitingReview,
  },
  { key: "researching", label: "Researching", match: (e) => !!e.researching },
  {
    key: "thin",
    label: "Under 50%",
    match: (e) => e.score !== null && e.score < 50,
  },
  { key: "no-sources", label: "No sources", match: (e) => e.sourceCount === 0 },
  {
    key: "no-relationships",
    label: "No relationships",
    match: (e) => e.relationshipCount === 0,
  },
  { key: "no-type", label: "No type", match: (e) => !hasRealType(e) },
  { key: "no-image", label: "No image", match: (e) => !e.hasImage },
  { key: "unscored", label: "Unscored", match: (e) => e.score === null },
];

/**
 * The entity browser. One component, two scopes: everything Atlas holds
 * (`/admin/entities`) and one region's scope (the Region workspace).
 *
 * ## Built for a region with thousands in it
 *
 * Today the Okanagan has seven. The filters are shaped for the day it has
 * four thousand, which changes what a filter has to be: **every control
 * here narrows by something Atlas measured**, so each one still means
 * something at scale and none needs a human to have tagged anything.
 *
 * Three orthogonal axes, deliberately — kind, gap, and free text — because
 * they compose. *"Organizations in this region with no sources"* is two
 * clicks, and that is the question a curator actually arrives with.
 *
 * Filtering stays client-side while a region is small enough to send whole.
 * When it is not, the axes are already the right ones to push into the
 * query, and the row shape does not change. That is the foundation this
 * exists to lay; server-side filtering is not built on speculation.
 *
 * ## Type is a first-class column, not a subtitle
 *
 * Types are about to matter structurally — different layouts, completeness
 * rules, research missions and Passport presentation per type. So the type
 * is set as its own column rather than buried in a dot-separated meta
 * line, and it shows the **source's own word** (`ski resort`, `winery`)
 * next to the domain kind. Atlas never normalises that word (ADR 017), and
 * showing it is how a curator sees what the corpus actually contains
 * before anyone writes rules against it.
 *
 * ## Rows, not cards
 *
 * A card is a box drawn around content, and a page of boxes is a page of
 * borders. Under a health summary a card grid reads as a second dashboard
 * rather than as the work.
 *
 * ## Scope discipline
 *
 * Entity *navigation*, not fleet analytics. Deliberately no charts, no
 * saved views, no bulk operations — when bulk operations arrive they bring
 * a Collection screen with them, because processing is a different verb
 * from choosing (ADR 028).
 */
export function EntityPicker({
  entities,
  showMembership = false,
}: {
  entities: PickerEntity[];
  /** Region scope only: label whether a curator placed this or a member contains it. */
  showMembership?: boolean;
}) {
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("All");
  const [sort, setSort] = useState<SortKey>("needs-work");

  /**
   * The gap filter comes from the URL, with a local override once the
   * curator clicks a chip themselves.
   *
   * A finding above says *"show me the six"* by linking to `?gap=no-type`,
   * so the link is shareable and the back button works — a server-rendered
   * finding can drive a client-rendered filter without the two sharing a
   * parent.
   *
   * **Derived, not synced.** Copying the URL into state inside an effect
   * would render once with the wrong filter and again with the right one,
   * and would fight the curator every time the URL changed under them.
   * `override ?? url ?? all` needs no effect at all.
   */
  const urlGap = params.get("gap");
  const [override, setOverride] = useState<GapKey | null>(null);
  const gap: GapKey =
    override ??
    (urlGap && GAPS.some((g) => g.key === urlGap) ? (urlGap as GapKey) : "all");
  const setGap = setOverride;

  // Counts are computed against the *other* axes, so a filter that would
  // return nothing says so before it is clicked. A control that silently
  // empties the list is how a curator concludes the corpus is empty.
  const gapCounts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = entities.filter(
      (e) =>
        (kind === "All" || e.kind === kind) &&
        (!q ||
          e.name.toLowerCase().includes(q) ||
          (e.subtype ?? "").toLowerCase().includes(q)),
    );
    return new Map(GAPS.map((g) => [g.key, base.filter(g.match).length]));
  }, [entities, kind, query]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchGap = GAPS.find((g) => g.key === gap)!.match;
    const filtered = entities.filter((e) => {
      if (kind !== "All" && e.kind !== kind) return false;
      if (!matchGap(e)) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        (e.subtype ?? "").toLowerCase().includes(q)
      );
    });
    return filtered.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "sources")
        return b.sourceCount - a.sourceCount || a.name.localeCompare(b.name);
      if (sort === "connections")
        return (
          b.relationshipCount - a.relationshipCount ||
          a.name.localeCompare(b.name)
        );
      // "needs-work": lowest score first, unscored last — an unknown score
      // isn't evidence of a problem and shouldn't jump the queue.
      return (
        (a.score ?? 999) - (b.score ?? 999) || a.name.localeCompare(b.name)
      );
    });
  }, [entities, query, kind, gap, sort]);

  return (
    <div className="flex flex-col gap-4">
      {/* --- Search and the two orthogonal axes ------------------------- */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or type…"
            className="h-9 pl-9 text-sm"
          />
        </div>

        <Segmented
          options={KINDS.map((k) => ({ key: k, label: k }))}
          value={kind}
          onChange={(k) => setKind(k as (typeof KINDS)[number])}
        />

        <Segmented
          options={(
            [
              ["needs-work", "Needs work"],
              ["connections", "Connections"],
              ["sources", "Sources"],
              ["name", "A–Z"],
            ] as const
          ).map(([key, label]) => ({ key, label }))}
          value={sort}
          onChange={(k) => setSort(k as SortKey)}
        />
      </div>

      {/* --- Gap filters. Each is a measured absence. ------------------- */}
      <div className="flex flex-wrap items-center gap-1.5">
        {GAPS.map((g) => {
          const count = gapCounts.get(g.key) ?? 0;
          const empty = count === 0 && g.key !== "all";
          return (
            <button
              key={g.key}
              onClick={() => setGap(g.key)}
              disabled={empty}
              title={empty ? "Nothing matches this here" : undefined}
              className={`rounded-md px-2.5 py-1 text-[13px] transition-colors ${
                gap === g.key
                  ? "bg-foreground text-background font-medium"
                  : empty
                    ? "text-muted-foreground/40 cursor-not-allowed"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {g.label}
              {g.key !== "all" && (
                <span className="ml-1.5 tabular-nums opacity-60">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-muted-foreground text-[13px]">
        {visible.length === entities.length
          ? `${entities.length} ${entities.length === 1 ? "entity" : "entities"}`
          : `${visible.length} of ${entities.length} entities`}
      </p>

      {visible.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-lg border border-dashed px-5 py-8 text-sm">
          Nothing matches these filters. That is a statement about the filters,
          not about {entities.length === 1 ? "the entity" : "the entities"} —
          clearing them brings back all {entities.length}.
        </p>
      ) : (
        <div className="border-border divide-border divide-y overflow-hidden rounded-lg border">
          {visible.map((e) => (
            <Link
              key={e.id}
              href={`/admin/entities/${e.id}`}
              className="hover:bg-muted/40 group flex items-center gap-4 px-4 py-3 transition-colors"
            >
              {/* Name and type — type is a column, not a subtitle. */}
              <span className="min-w-0 flex-[2]">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{e.name}</span>
                  {/* What the last run did to this row. Loud on purpose:
                      the point of an operation is seeing what it touched,
                      and a subtle badge is one a curator scrolls past. */}
                  {e.changed === "new" && (
                    <span className="shrink-0 rounded bg-emerald-600/15 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-emerald-700 uppercase dark:text-emerald-400">
                      New
                    </span>
                  )}
                  {e.changed === "updated" && (
                    <span className="shrink-0 rounded bg-sky-600/15 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-sky-700 uppercase dark:text-sky-400">
                      Updated
                    </span>
                  )}
                  {e.awaitingReview && (
                    <span className="shrink-0 rounded bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                      review
                    </span>
                  )}
                  {e.researching && (
                    <span className="text-muted-foreground bg-muted shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium">
                      researching
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground mt-0.5 block truncate text-[13px]">
                  {hasRealType(e) ? (
                    <span className="text-foreground/70">{e.subtype}</span>
                  ) : (
                    // Not a type. Atlas never established one, and saying
                    // so is the difference between a gap and a label.
                    <span className="text-muted-foreground/60 italic">
                      type not set
                    </span>
                  )}
                  {"  ·  "}
                  {e.kind}
                  {showMembership && e.membership === "indirect" && (
                    <>{"  ·  inside a member"}</>
                  )}
                </span>
              </span>

              {/* Measured signals. Fixed columns so they compare vertically. */}
              <Signal
                value={e.score === null ? "—" : `${e.score}%`}
                label="knowledge"
                muted={e.score === null}
              />
              <Signal
                value={String(e.sourceCount)}
                label={e.sourceCount === 1 ? "source" : "sources"}
                muted={e.sourceCount === 0}
              />
              <Signal
                value={String(e.relationshipCount)}
                label={e.relationshipCount === 1 ? "link" : "links"}
                muted={e.relationshipCount === 0}
              />
              <Signal
                value={e.containsCount > 0 ? String(e.containsCount) : "—"}
                label="inside"
                muted={e.containsCount === 0}
              />

              {e.sourceCount === 0 && (
                <AlertTriangle
                  className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-500"
                  aria-label="No source describes this entity"
                />
              )}
              <ChevronRight className="text-muted-foreground/0 group-hover:text-muted-foreground h-4 w-4 shrink-0 transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** One measured number with its unit. Tabular so columns compare down the list. */
function Signal({
  value,
  label,
  muted,
}: {
  value: string;
  label: string;
  muted?: boolean;
}) {
  return (
    <span className="hidden w-[86px] shrink-0 text-right sm:block">
      <span
        className={`block text-[13px] tabular-nums ${muted ? "text-muted-foreground/50" : "font-medium"}`}
      >
        {value}
      </span>
      <span className="text-muted-foreground/70 block text-[11px]">
        {label}
      </span>
    </span>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="border-border flex items-center gap-0.5 rounded-lg border p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`rounded-md px-2.5 py-1 text-[13px] transition-colors ${
            value === o.key
              ? "bg-foreground text-background font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
