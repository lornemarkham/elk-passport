"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Database, Loader2, MapPin, TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { RegionDrawer } from "./RegionDrawer";

/**
 * **Region composition — why this region looks small.**
 *
 * ## The gap this makes visible
 *
 * Atlas holds ~166 entities and the Okanagan contains 7. Shown without
 * explanation that reads as data loss. The cause is that **region
 * membership has been asserted once**: most entities predate Regions
 * (ADR 025) and nobody has placed them.
 *
 * So the section states all three numbers and says plainly that the gap
 * is unasserted membership, not failure. **A visible gap beats a hidden
 * one**, and this is the largest one in the product.
 *
 * ## Review, never "assign everything"
 *
 * The drawer lists unassigned entities with search, kind filter and
 * multi-select, and **nothing is pre-selected**. Membership stays a
 * curator decision, one entity at a time or several — but always chosen.
 *
 * Batching is acceptable *here specifically* because **membership is
 * reversible**: it is one edge, and deleting it undoes the assertion
 * completely. Under *automate the reversible, review the irreversible*,
 * a reviewed multi-select is proportionate. It would not be for entity
 * creation or a merge, and this component deliberately does neither.
 */

export interface UnassignedEntity {
  id: string;
  name: string;
  kind: string;
  subtype?: string;
  sourceCount: number;
  /** What Atlas already knows that bears on membership. Never a score. */
  tier: "shared-source" | "proximity" | "none";
  because: string;
}

export interface CompositionCounts {
  corpus: number;
  inThisRegion: number;
  inOtherRegions: number;
  unassigned: number;
  otherRegionCount: number;
  known: boolean;
}

export function RegionComposition({
  regionId,
  regionName,
  counts,
  unassigned,
}: {
  regionId: string;
  regionName: string;
  counts: CompositionCounts;
  unassigned: UnassignedEntity[];
}) {
  if (!counts.known) {
    return (
      <section className="border-border rounded-xl border border-dashed px-6 py-6">
        <p className="text-sm font-medium">Region composition unavailable</p>
        <p className="text-muted-foreground mt-2 text-[13px] leading-relaxed">
          Atlas did not return the corpus, so these counts cannot be shown. This
          says nothing about how many entities exist — only that the read
          failed. Reload, or check the Atlas API is running.
        </p>
      </section>
    );
  }

  return (
    <section className="border-border overflow-hidden rounded-xl border-2">
      <div className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Figure
          icon={<Database className="h-4 w-4" />}
          label="Entities in Atlas"
          value={counts.corpus}
          note="Everything Atlas holds, across all regions"
        />
        <Figure
          icon={<MapPin className="h-4 w-4" />}
          label={`In ${regionName}`}
          value={counts.inThisRegion}
          note="Placed by a curator, plus what those entities contain"
          strong
        />
        <Figure
          icon={<TriangleAlert className="h-4 w-4" />}
          label="In no region yet"
          value={counts.unassigned}
          note={
            counts.otherRegionCount > 0
              ? `${counts.inOtherRegions} more are in another region`
              : "No other region exists to hold them"
          }
          attention={counts.unassigned > 0}
        />
      </div>

      {counts.unassigned > 0 && (
        <div className="border-border bg-muted/30 border-t px-6 py-5">
          {/* The explanation. Without this the numbers read as data loss. */}
          <p className="text-sm font-medium">
            This is not missing data — it is unasserted membership.
          </p>
          <p className="text-muted-foreground mt-2 max-w-3xl text-[13px] leading-relaxed">
            Atlas only places an entity in a region when a person says so. It
            never infers membership from coordinates, distance or names, because
            a lodge whose latitude falls inside a boundary has not been placed
            there by anyone. Most of these {counts.unassigned} entities were
            ingested before Regions existed, so nobody has placed them yet. They
            are still in Atlas, still complete, and still searchable from{" "}
            <Link
              href="/admin/entities"
              className="text-foreground underline-offset-4 hover:underline"
            >
              All entities
            </Link>
            .
          </p>

          <AssignDrawer
            regionId={regionId}
            regionName={regionName}
            unassigned={unassigned}
          />
        </div>
      )}
    </section>
  );
}

function Figure({
  icon,
  label,
  value,
  note,
  strong,
  attention,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  note: string;
  strong?: boolean;
  attention?: boolean;
}) {
  return (
    <div className={`px-6 py-5 ${strong ? "bg-muted/40" : ""}`}>
      <p className="text-muted-foreground flex items-center gap-1.5 text-[13px]">
        {icon}
        {label}
      </p>
      <p
        className={`mt-1 text-4xl font-bold tracking-tight tabular-nums ${
          attention ? "text-amber-700 dark:text-amber-500" : ""
        }`}
      >
        {value}
      </p>
      <p className="text-muted-foreground mt-1 text-[13px] leading-relaxed">
        {note}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Review drawer
 * ---------------------------------------------------------------------- */

const KINDS = ["All", "Place", "Organization", "Activity", "Event"] as const;

/**
 * The evidence groups, in the order a curator should work them.
 *
 * `shared-source` first because it is the only tier backed by something a
 * page actually published. `proximity` is coordinate-derived and is
 * deliberately **not** offered for bulk selection — see
 * `membershipEvidence.ts`.
 */
const TIERS = [
  {
    key: "shared-source" as const,
    label: "A source describes both",
    blurb:
      "A page Atlas has already read describes this entity and something already in the region. This is documentary evidence — it exists because a real source said so.",
    bulk: true,
  },
  {
    key: "proximity" as const,
    label: "Near something in the region",
    blurb:
      'Atlas computed a "near" link from stored coordinates. Nothing published said these belong together, so this is a hint about where to look — not a reason to place. No bulk selection here, deliberately.',
    bulk: false,
  },
  {
    key: "none" as const,
    label: "Atlas has no evidence either way",
    blurb:
      "Nothing Atlas holds connects these to this region. That is not a judgement that they do not belong — only that Atlas cannot help you decide.",
    bulk: false,
  },
];

function AssignDrawer({
  regionId,
  regionName,
  unassigned,
}: {
  regionId: string;
  regionName: string;
  unassigned: UnassignedEntity[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("All");
  // Opens on the strongest evidence — Atlas has done the sorting, so the
  // curator starts where the reasoning is best rather than at "A".
  const [tier, setTier] =
    useState<(typeof TIERS)[number]["key"]>("shared-source");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    added: { id: string; name: string }[];
    alreadyMember: { id: string; name: string }[];
  } | null>(null);

  const tierCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of unassigned)
      counts.set(e.tier, (counts.get(e.tier) ?? 0) + 1);
    return counts;
  }, [unassigned]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return unassigned
      .filter((e) => e.tier === tier)
      .filter((e) => kind === "All" || e.kind === kind)
      .filter(
        (e) =>
          !q ||
          e.name.toLowerCase().includes(q) ||
          (e.subtype ?? "").toLowerCase().includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [unassigned, query, kind, tier]);

  const activeTier = TIERS.find((t) => t.key === tier)!;

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/regions/${regionId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityIds: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Atlas refused the change.");
        return;
      }
      setResult({
        added: data.added ?? [],
        alreadyMember: data.alreadyMember ?? [],
      });
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach Atlas.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <RegionDrawer
      wide
      title={`Entities in no region`}
      description={`Place any of these in ${regionName}. Membership is your assertion — Atlas never infers it. Nothing is pre-selected, and adding an entity here is reversible: it writes one relationship and removing it undoes the whole assertion.`}
      trigger={(open) => (
        <button
          onClick={open}
          className="bg-foreground text-background mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
        >
          Review unassigned entities
        </button>
      )}
    >
      {result && (
        <div className="mb-5 rounded-lg border border-emerald-600/40 bg-emerald-500/[0.05] px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
            {result.added.length} placed in {regionName}
          </p>
          {result.added.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {result.added.map((a) => (
                <li
                  key={a.id}
                  className="bg-muted rounded px-2 py-0.5 text-[13px]"
                >
                  {a.name}
                </li>
              ))}
            </ul>
          )}
          {result.alreadyMember.length > 0 && (
            <p className="text-muted-foreground mt-2 text-[13px]">
              {result.alreadyMember.length} were already members — asserting
              again changes nothing, which is what a correct repeat looks like.
            </p>
          )}
          <p className="text-muted-foreground mt-2 text-[13px]">
            The region behind this panel has already updated.
          </p>
        </div>
      )}

      {/* Atlas has grouped the work by the evidence it actually holds. */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {TIERS.map((t) => {
          const n = tierCounts.get(t.key) ?? 0;
          return (
            <button
              key={t.key}
              onClick={() => setTier(t.key)}
              disabled={n === 0}
              className={`rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                tier === t.key
                  ? "bg-foreground text-background font-medium"
                  : n === 0
                    ? "text-muted-foreground/40 cursor-not-allowed"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {t.label}
              <span className="ml-1.5 tabular-nums opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      <p className="text-muted-foreground border-border mb-4 rounded-lg border border-dashed px-4 py-3 text-[13px] leading-relaxed">
        {activeTier.blurb}
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or type…"
          className="h-9 min-w-[220px] flex-1 text-sm"
        />
        <div className="border-border flex items-center gap-0.5 rounded-lg border p-0.5">
          {KINDS.map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`rounded-md px-2.5 py-1 text-[13px] transition-colors ${
                kind === k
                  ? "bg-foreground text-background font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-3">
        <p className="text-muted-foreground text-[13px]">
          {visible.length} shown · {selected.size} selected
        </p>
        {activeTier.bulk && visible.length > 0 && (
          <button
            onClick={() =>
              setSelected((s) => {
                const next = new Set(s);
                for (const e of visible) next.add(e.id);
                return next;
              })
            }
            className="border-border hover:bg-muted rounded-md border px-2.5 py-1 text-[13px] transition-colors"
          >
            Select these {visible.length}
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-lg border border-dashed px-5 py-8 text-sm">
          Nothing matches these filters. That is a statement about the filters,
          not about the corpus.
        </p>
      ) : (
        <div className="border-border divide-border divide-y overflow-hidden rounded-lg border">
          {visible.map((e) => (
            <label
              key={e.id}
              className="hover:bg-muted/40 flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.has(e.id)}
                onChange={() => toggle(e.id)}
                className="h-4 w-4 shrink-0"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {e.name}
                </span>
                <span className="text-muted-foreground block text-[13px]">
                  {e.subtype ? `${e.subtype} · ` : ""}
                  {e.kind} · {e.sourceCount}{" "}
                  {e.sourceCount === 1 ? "source" : "sources"}
                </span>
                {/* The evidence itself, not a score — so a curator can
                    disagree with the grouping rather than with a number. */}
                {e.because && (
                  <span className="text-muted-foreground/80 mt-0.5 block text-[12px] leading-relaxed">
                    {e.because}
                  </span>
                )}
              </span>
              <Link
                href={`/admin/entities/${e.id}`}
                onClick={(ev) => ev.stopPropagation()}
                className="text-muted-foreground hover:text-foreground shrink-0 text-[13px] underline-offset-4 hover:underline"
              >
                Open
              </Link>
            </label>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-3 text-[13px] text-amber-700 dark:text-amber-400">
          {error}
        </p>
      )}

      <div className="border-border bg-background sticky bottom-0 mt-4 flex flex-wrap items-center gap-3 border-t pt-4">
        <button
          disabled={busy || selected.size === 0}
          onClick={() => void submit()}
          className="bg-foreground text-background inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MapPin className="h-4 w-4" />
          )}
          Place {selected.size > 0 ? selected.size : ""} in {regionName}
        </button>
        {selected.size > 0 && (
          <button
            onClick={() => setSelected(new Set())}
            className="text-muted-foreground hover:text-foreground text-[13px]"
          >
            Clear selection
          </button>
        )}
      </div>
    </RegionDrawer>
  );
}
