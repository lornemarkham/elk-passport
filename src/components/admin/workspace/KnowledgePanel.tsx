"use client";

import { useMemo, useState } from "react";
import {
  Eye,
  EyeOff,
  AlertTriangle,
  Cpu,
  User,
  FileText,
  Sparkles,
} from "lucide-react";
import type {
  EntityKnowledge,
  KnowledgeItem,
  ProvenanceOrigin,
} from "@/lib/knowledge/entityKnowledge";
import { formatDate } from "@/lib/knowledge/formatDate";

/**
 * "Everything Atlas knows about this entity" — the primary Understand
 * surface.
 *
 * Three deliberate departures from the old Content Explorer's Fields card:
 *
 *  1. **Knowledge, not fields.** Groups come from the source's own section
 *     headings first (ADR 017 `KeyFact.category`), then from provenance,
 *     then core identity — never from an Atlas-invented taxonomy. A winery
 *     works here with no code change.
 *  2. **Usage is on every row.** Whether Passport actually shows a piece
 *     of knowledge is the question the old view couldn't answer at all.
 *  3. **Provenance is progressive.** A glyph always; source, date and
 *     confidence on selection; the verbatim supporting passage on demand.
 */

const ORIGIN_META: Record<
  ProvenanceOrigin,
  { label: string; Icon: typeof FileText; hint: string }
> = {
  sourced: {
    label: "Sourced",
    Icon: FileText,
    hint: "Found verbatim in an attached source.",
  },
  derived: {
    label: "Derived",
    Icon: Sparkles,
    hint: "Computed by Atlas (e.g. geocoded), not quoted from text.",
  },
  ai: { label: "AI", Icon: Cpu, hint: "Synthesized by AI." },
  human: { label: "Human", Icon: User, hint: "Asserted by a curator." },
  unknown: {
    label: "Unverified",
    Icon: AlertTriangle,
    hint: "Could not be located in any attached source.",
  },
};

type Filter = "all" | "used" | "known" | "unverified";

export function KnowledgePanel({ knowledge }: { knowledge: EntityKnowledge }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  /**
   * Every source type that contributed anything. Filtering by one answers
   * "what did the official website actually teach Atlas?" in a single
   * click — the question the whole official-source expansion exists to
   * make answerable.
   */
  const sourceTypes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const group of knowledge.groups) {
      for (const item of group.items) {
        const t = item.provenance.sourceType;
        if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [knowledge.groups]);

  const groups = useMemo(() => {
    return knowledge.groups
      .map((g) => ({
        ...g,
        items: g.items.filter((i) => {
          if (sourceFilter && i.provenance.sourceType !== sourceFilter)
            return false;
          if (filter === "used") return i.usage === "used";
          if (filter === "known") return i.usage === "known";
          if (filter === "unverified") return !i.provenance.supported;
          return true;
        }),
      }))
      .filter((g) => g.items.length > 0);
  }, [knowledge.groups, filter, sourceFilter]);

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All knowledge", count: knowledge.counts.total },
    { key: "used", label: "On the page", count: knowledge.counts.used },
    { key: "known", label: "Known, unused", count: knowledge.counts.known },
    {
      key: "unverified",
      label: "Unverified",
      count: knowledge.counts.unsupported,
    },
  ];

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            What Atlas knows
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Grouped the way the sources themselves grouped it — never by an
            Atlas-invented taxonomy.
          </p>
        </div>
        <div className="border-border flex flex-wrap items-center gap-1 rounded-lg border p-1">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition ${
                filter === f.key
                  ? "bg-foreground text-background font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
              <span className="tabular-nums opacity-70">{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      {sourceTypes.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Taught by
          </span>
          <button
            onClick={() => setSourceFilter(null)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              sourceFilter === null
                ? "border-foreground bg-foreground text-background font-medium"
                : "border-border hover:border-foreground/40"
            }`}
          >
            Every source
          </button>
          {sourceTypes.map(([type, count]) => (
            <button
              key={type}
              onClick={() =>
                setSourceFilter(sourceFilter === type ? null : type)
              }
              className={`rounded-full border px-3 py-1 text-xs transition ${
                sourceFilter === type
                  ? "border-foreground bg-foreground text-background font-medium"
                  : "border-border hover:border-foreground/40"
              }`}
            >
              {type} <span className="tabular-nums opacity-70">{count}</span>
            </button>
          ))}
        </div>
      )}

      {groups.length === 0 && (
        <p className="text-muted-foreground border-border rounded-xl border border-dashed p-8 text-center text-sm">
          Nothing matches this filter.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        {groups.map((group) => (
          <div
            key={group.key}
            className="border-border flex flex-col gap-1 rounded-xl border p-5"
          >
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <h3 className="font-semibold tracking-tight">{group.label}</h3>
              <span
                className="text-muted-foreground shrink-0 text-[11px] tracking-wide uppercase"
                title={
                  group.groupedBy === "source-category"
                    ? "This heading came from the source itself."
                    : group.groupedBy === "core"
                      ? "Core identity fields every entity has."
                      : "Grouped by which source contributed it, because the source stated no section heading."
                }
              >
                {group.groupedBy === "source-category"
                  ? "source heading"
                  : group.groupedBy === "core"
                    ? "core"
                    : "by source"}
              </span>
            </div>

            {group.sourceTypes.length > 0 && (
              <p className="text-muted-foreground mb-2 text-[11px]">
                taught by {group.sourceTypes.join(", ")}
              </p>
            )}

            {group.items.map((item) => (
              <KnowledgeRow
                key={item.id}
                item={item}
                expanded={selected === item.id}
                onToggle={() =>
                  setSelected(selected === item.id ? null : item.id)
                }
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function KnowledgeRow({
  item,
  expanded,
  onToggle,
}: {
  item: KnowledgeItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const origin = ORIGIN_META[item.provenance.origin];
  const OriginIcon = origin.Icon;
  const unverified = !item.provenance.supported;

  return (
    <div
      className={`-mx-2 rounded-lg px-2 py-2 transition ${expanded ? "bg-muted/50" : "hover:bg-muted/30"} ${
        unverified ? "border-l-2 border-amber-500 pl-3" : ""
      }`}
    >
      <button
        onClick={onToggle}
        className="flex w-full items-start gap-3 text-left"
      >
        {/* Usage state — shape + icon, never colour alone. */}
        <span
          className="mt-0.5 shrink-0"
          title={
            item.usage === "used"
              ? "Passport currently shows this"
              : "Atlas knows this; Passport does not show it"
          }
        >
          {item.usage === "used" ? (
            <Eye className="h-4 w-4" />
          ) : (
            <EyeOff className="text-muted-foreground/60 h-4 w-4" />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-muted-foreground text-xs">{item.label}</span>
            {unverified && (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-amber-700 uppercase dark:text-amber-500">
                unverified
              </span>
            )}
          </span>
          <span
            className={`block text-sm ${item.usage === "used" ? "" : "text-foreground/80"}`}
          >
            {item.value}
          </span>
        </span>

        <span
          className="text-muted-foreground mt-0.5 shrink-0"
          title={`${origin.label} — ${origin.hint}`}
        >
          <OriginIcon className="h-3.5 w-3.5" />
        </span>
      </button>

      {expanded && (
        <div className="text-muted-foreground mt-3 flex flex-col gap-2 border-t pt-3 text-xs">
          <Detail label="Origin" value={`${origin.label} — ${origin.hint}`} />
          {item.provenance.sourceType && (
            <Detail
              label="Source"
              value={`${item.provenance.sourceType}${item.provenance.source ? ` · ${item.provenance.source}` : ""}`}
            />
          )}
          {item.provenance.retrievedAt && (
            <Detail
              label="Retrieved"
              value={formatDate(item.provenance.retrievedAt)}
            />
          )}
          {item.provenance.confidence !== undefined && (
            <Detail
              label="Confidence"
              value={String(item.provenance.confidence)}
            />
          )}
          <Detail
            label="Passport"
            value={
              item.usage === "used"
                ? `Shown in: ${item.usageDetail.sections.join(", ")}${item.usageDetail.note ? ` — ${item.usageDetail.note}` : ""}`
                : "Not surfaced on the traveler page today."
            }
          />
          {item.provenance.partialSupportNote && (
            <Detail
              label="Coverage"
              value={item.provenance.partialSupportNote}
            />
          )}
          {item.provenance.excerpt && (
            <div>
              <p className="mb-1 font-medium tracking-wide uppercase">
                Supporting passage
              </p>
              <p className="border-border bg-background rounded-md border p-3 leading-relaxed">
                {item.provenance.excerpt}
              </p>
            </div>
          )}
          {unverified && (
            <p className="rounded-md bg-amber-500/10 p-3 leading-relaxed text-amber-800 dark:text-amber-400">
              This value could not be found in the raw text of any source that
              describes this entity. That does not automatically make it wrong —
              a value can be legitimately derived or reworded — but it does mean
              nothing here proves it. Worth reviewing against the source before
              it reaches a traveler.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-20 shrink-0 font-medium tracking-wide uppercase">
        {label}
      </span>
      <span className="min-w-0 flex-1 break-words">{value}</span>
    </div>
  );
}
