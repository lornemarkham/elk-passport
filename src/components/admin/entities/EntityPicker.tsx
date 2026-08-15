"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronRight, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";

export interface PickerEntity {
  id: string;
  name: string;
  kind: string;
  subtype?: string;
  score: number | null;
  sourceCount: number;
  /** How many entities this one directly contains. Real `contains` edges, never a guess. */
  containsCount: number;
  hasImage: boolean;
}

type SortKey = "needs-work" | "name" | "sources";

const KINDS = ["All", "Place", "Organization", "Activity", "Event"] as const;

/**
 * The entity browser. One component, two scopes: everything Atlas holds
 * (`/admin/entities`) and one region's members (the Region workspace).
 *
 * ## Rows, not cards
 *
 * This shipped as a grid of bordered cards, which is the one thing the
 * design system names outright as wrong: *a card is a box drawn around
 * content, and a page of boxes is a page of borders.* Inside the Region
 * workspace it was worse than untidy — a grid of cards under a health
 * summary reads as a second dashboard rather than as the list of things to
 * work on.
 *
 * The row carries strictly more information than the card did (kind,
 * subtype, coverage, sources, what it contains) in less vertical space,
 * because dot-separated meta is denser than a stack of chips and a
 * progress bar. The progress bar went with the cards: a 1px bar repeated
 * 168 times is texture, and the number it encodes is already in the row.
 *
 * ## Scope discipline
 *
 * Entity *navigation*, not fleet analytics — search, a kind filter, three
 * sorts. Deliberately no charts, no saved views, no bulk operations. When
 * bulk operations arrive they bring a Collection screen with them, because
 * processing is a different verb from choosing (ADR 028).
 */
export function EntityPicker({ entities }: { entities: PickerEntity[] }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("All");
  const [sort, setSort] = useState<SortKey>("needs-work");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = entities.filter((e) => {
      if (kind !== "All" && e.kind !== kind) return false;
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
      // "needs-work": lowest score first, unscored last (an unknown score
      // isn't evidence of a problem and shouldn't jump the queue).
      const as = a.score ?? 999;
      const bs = b.score ?? 999;
      return as - bs || a.name.localeCompare(b.name);
    });
  }, [entities, query, kind, sort]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[280px] flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search entities…"
            className="h-11 pl-9"
          />
        </div>

        <div className="border-border flex items-center gap-1 rounded-lg border p-1">
          {KINDS.map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`rounded-md px-3 py-1.5 text-sm transition ${
                kind === k
                  ? "bg-foreground text-background font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        <div className="border-border flex items-center gap-1 rounded-lg border p-1">
          {(
            [
              ["needs-work", "Needs work"],
              ["sources", "Most sources"],
              ["name", "A–Z"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={`rounded-md px-3 py-1.5 text-sm transition ${
                sort === key
                  ? "bg-foreground text-background font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-muted-foreground text-sm">
        {visible.length === entities.length
          ? `${entities.length} ${entities.length === 1 ? "entity" : "entities"}`
          : `${visible.length} of ${entities.length} entities`}
      </p>

      {visible.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-lg border border-dashed px-5 py-8 text-sm">
          Nothing matches that search. Clearing it brings back all{" "}
          {entities.length}.
        </p>
      ) : (
        <div className="border-border divide-border divide-y overflow-hidden rounded-lg border">
          {visible.map((e) => (
            <Link
              key={e.id}
              href={`/admin/entities/${e.id}`}
              className="hover:bg-muted/40 group flex items-center gap-4 px-4 py-3 transition-colors"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {e.name}
                </span>
                <span className="text-muted-foreground mt-0.5 block text-[13px]">
                  {[
                    e.subtype ? `${e.kind} · ${e.subtype}` : e.kind,
                    // "not scored" rather than 0% — an unmeasured entity is
                    // not a bad one, and a fabricated zero here would sort
                    // and read as though it were.
                    e.score === null ? "not scored" : `${e.score}% knowledge`,
                    `${e.sourceCount} ${e.sourceCount === 1 ? "source" : "sources"}`,
                    e.containsCount > 0 && `contains ${e.containsCount}`,
                  ]
                    .filter(Boolean)
                    .join("  ·  ")}
                </span>
              </span>

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
