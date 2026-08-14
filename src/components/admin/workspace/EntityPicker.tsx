"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ArrowRight, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";

export interface PickerEntity {
  id: string;
  name: string;
  kind: string;
  subtype?: string;
  score: number | null;
  sourceCount: number;
  hasImage: boolean;
}

type SortKey = "needs-work" | "name" | "sources";

const KINDS = ["All", "Place", "Organization", "Activity", "Event"] as const;

/**
 * Replaces the Content Explorer's flat, unsearchable 97-item list.
 *
 * Scope discipline: this is entity *navigation*, not fleet analytics. It
 * has search, a kind filter, and three sorts — enough to reach any entity
 * in a couple of seconds — and deliberately no charts, no saved views, and
 * no bulk operations. The fleet-level questions belong to the Curator
 * Queue that already exists.
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
        {visible.length} of {entities.length} entities
      </p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((e) => (
          <Link
            key={e.id}
            href={`/admin/workspace/${e.id}`}
            className="border-border hover:border-foreground/30 hover:bg-muted/30 group flex flex-col gap-3 rounded-xl border p-4 transition"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{e.name}</p>
                <p className="text-muted-foreground text-xs">
                  {e.kind}
                  {e.subtype ? ` · ${e.subtype}` : ""}
                </p>
              </div>
              <ArrowRight className="text-muted-foreground group-hover:text-foreground mt-0.5 h-4 w-4 shrink-0 transition" />
            </div>

            <div className="flex items-center gap-3 text-xs">
              {e.score !== null ? (
                <span className="font-medium tabular-nums">{e.score}%</span>
              ) : (
                <span className="text-muted-foreground">not scored</span>
              )}
              <span className="text-muted-foreground">
                {e.sourceCount} {e.sourceCount === 1 ? "source" : "sources"}
              </span>
              {e.sourceCount === 0 && (
                <span
                  className="text-amber-700 dark:text-amber-500"
                  title="No source describes this entity"
                >
                  <AlertTriangle className="inline h-3.5 w-3.5" />
                </span>
              )}
            </div>

            <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
              <div
                className="bg-foreground/50 h-full rounded-full"
                style={{ width: `${e.score ?? 0}%` }}
              />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
