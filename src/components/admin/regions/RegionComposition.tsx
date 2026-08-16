"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  Circle,
  Database,
  Loader2,
  Lock,
  MapPin,
  TriangleAlert,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { RegionDrawer } from "./RegionDrawer";
import {
  BAND_META,
  type Band,
  type Signal,
} from "@/lib/knowledge/membershipBands";

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
  /** Which evidence band Atlas sorted this into. */
  band: Band;
  /** Count of evidence present, out of `max`. **Not** a probability. */
  score: number;
  max: number;
  /** The strongest true sentence Atlas can say about this entity. */
  headline: string;
  /** The full checklist — present and missing — so the score is checkable. */
  signals: readonly Signal[];
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

/**
 * **A number that counts to its new value when knowledge changes.**
 *
 * The one animation on this page that carries information rather than
 * decoration. Placing six entities moves "In Okanagan" from 7 to 13 and
 * "In no region" from 157 to 151; if both numbers simply *are* different
 * after a refresh, the curator has to remember the old ones to notice that
 * anything happened. Counting makes the change the thing you see.
 *
 * Deliberately does **not** animate on first render — a page that counts
 * every figure up from zero on load teaches nothing, because nothing
 * changed. It animates only on a *transition*, which is exactly when
 * something did.
 *
 * Respects `prefers-reduced-motion` by snapping to the value.
 */
function AnimatedNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const previous = useRef(value);
  const frame = useRef<number | undefined>(undefined);

  useEffect(() => {
    const from = previous.current;
    previous.current = value;
    if (from === value) return;

    // Reduced motion snaps rather than counts — but still goes through the
    // frame callback. Setting state synchronously in an effect body
    // cascades renders, and the lint gate is right to refuse it.
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    )?.matches;

    const start = performance.now();
    const duration = reduced ? 0 : 550;
    const step = (now: number) => {
      const t = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
      // Ease-out: fast enough to feel responsive, settled enough to read.
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (t < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    };
  }, [value]);

  return <>{shown}</>;
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
        <AnimatedNumber value={value} />
      </p>
      <p className="text-muted-foreground mt-1 text-[13px] leading-relaxed">
        {note}
      </p>
    </div>
  );
}

/**
 * The evidence checklist for one entity — present *and* missing.
 *
 * The missing half is the point. "98% confident" tells a curator nothing
 * they can act on; **"official domain ✓, second source ✗"** tells them
 * precisely what would change the answer, and lets them disagree with the
 * reasoning rather than with a number they cannot inspect.
 */
function EvidenceChecklist({ signals }: { signals: readonly Signal[] }) {
  const CLASS_NOTE: Record<Signal["cls"], string> = {
    documentary: "a page said so",
    corroborating: "about the record, not the region",
    geometric: "from coordinates — never counts",
  };
  return (
    <ul className="mt-2 space-y-1.5">
      {signals.map((s) => (
        <li key={s.id} className="flex gap-2 text-[12px] leading-relaxed">
          {s.present ? (
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-500" />
          ) : (
            <Circle className="text-muted-foreground/40 mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          <span className={s.present ? "" : "text-muted-foreground/70"}>
            <span className="font-medium">{s.label}</span>
            <span className="text-muted-foreground/60">
              {" "}
              · {s.weight > 0 ? `+${s.weight}` : "0"} · {CLASS_NOTE[s.cls]}
            </span>
            <span className="text-muted-foreground mt-0.5 block">
              {s.detail}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------
 * Review drawer
 * ---------------------------------------------------------------------- */

const KINDS = ["All", "Place", "Organization", "Activity", "Event"] as const;

/** Strongest evidence first — the order a curator should work the queue. */
const BANDS: readonly Band[] = ["strong", "moderate", "weak", "none"];

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
  // Opens on the strongest band that actually has entities in it.
  //
  // Opening on `strong` unconditionally looked right and was wrong: the
  // Okanagan currently has **zero** strong candidates, so the drawer
  // greeted the curator with "nothing matches these filters" over a queue
  // of 157. **A default that is correct in principle and empty in practice
  // is a broken default.**
  const [band, setBand] = useState<Band>(() => {
    const present = new Set(unassigned.map((e) => e.band));
    return BANDS.find((b) => present.has(b)) ?? "none";
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    added: { id: string; name: string }[];
    alreadyMember: { id: string; name: string }[];
  } | null>(null);

  const bandCounts = useMemo(() => {
    const counts = new Map<Band, number>();
    for (const e of unassigned)
      counts.set(e.band, (counts.get(e.band) ?? 0) + 1);
    return counts;
  }, [unassigned]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (
      unassigned
        .filter((e) => e.band === band)
        .filter((e) => kind === "All" || e.kind === kind)
        .filter(
          (e) =>
            !q ||
            e.name.toLowerCase().includes(q) ||
            (e.subtype ?? "").toLowerCase().includes(q),
        )
        // Strongest evidence first inside the band, then alphabetical —
        // so the best-reasoned rows are the ones read first.
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    );
  }, [unassigned, query, kind, band]);

  const activeBand = BAND_META[band];

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

      {/* What Atlas would do without asking — and why it will not. */}
      <div className="border-border bg-muted/40 mb-4 flex gap-2.5 rounded-lg border px-4 py-3">
        <Lock className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
        <p className="text-muted-foreground text-[13px] leading-relaxed">
          <span className="text-foreground font-medium">
            Atlas placed 0 of these on its own.
          </span>{" "}
          It automates work when the evidence is deterministic, and none of this
          evidence is. A page that describes a resort also describes its road
          contractor and the airport two valleys over — so a shared source is
          strong enough to <em>rank</em> this queue and far too weak to{" "}
          <em>assert</em> membership. Atlas will place entities without asking
          once a source states which region something is in; nothing it holds
          does that yet.
        </p>
      </div>

      {/* Atlas has graded the work by how much evidence it actually holds. */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {BANDS.map((b) => {
          const n = bandCounts.get(b) ?? 0;
          return (
            <button
              key={b}
              onClick={() => setBand(b)}
              disabled={n === 0}
              className={`rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                band === b
                  ? "bg-foreground text-background font-medium"
                  : n === 0
                    ? "text-muted-foreground/40 cursor-not-allowed"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {BAND_META[b].label}
              <span className="ml-1.5 tabular-nums opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      <p className="text-muted-foreground border-border mb-4 rounded-lg border border-dashed px-4 py-3 text-[13px] leading-relaxed">
        {activeBand.blurb}
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
        {activeBand.bulk && visible.length > 0 && (
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
          {visible.map((e) => {
            const open = expanded.has(e.id);
            return (
              <div key={e.id} className="hover:bg-muted/40 transition-colors">
                <label className="flex cursor-pointer items-start gap-3 px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(e.id)}
                    onChange={() => toggle(e.id)}
                    className="mt-1 h-4 w-4 shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="truncate text-sm font-medium">
                        {e.name}
                      </span>
                      {/* Evidence count, labelled so it can never read as a
                          probability. The bar is the same number, seen. */}
                      <span className="text-muted-foreground flex items-center gap-1.5 text-[12px] tabular-nums">
                        <span className="bg-muted h-1.5 w-10 overflow-hidden rounded-full">
                          <span
                            className="bg-foreground/70 block h-full rounded-full"
                            style={{ width: `${(e.score / e.max) * 100}%` }}
                          />
                        </span>
                        {e.score}/{e.max} evidence
                      </span>
                    </span>
                    <span className="text-muted-foreground block text-[13px]">
                      {e.subtype ? `${e.subtype} · ` : ""}
                      {e.kind} · {e.sourceCount}{" "}
                      {e.sourceCount === 1 ? "source" : "sources"}
                    </span>
                    {/* The strongest true sentence, always visible — never
                        hidden behind the disclosure. */}
                    <span className="text-muted-foreground/80 mt-0.5 block text-[12px] leading-relaxed">
                      {e.headline}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        setExpanded((s) => {
                          const next = new Set(s);
                          if (next.has(e.id)) next.delete(e.id);
                          else next.add(e.id);
                          return next;
                        });
                      }}
                      aria-expanded={open}
                      className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[13px]"
                    >
                      Why
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
                      />
                    </button>
                    <Link
                      href={`/admin/entities/${e.id}`}
                      onClick={(ev) => ev.stopPropagation()}
                      className="text-muted-foreground hover:text-foreground text-[13px] underline-offset-4 hover:underline"
                    >
                      Open
                    </Link>
                  </span>
                </label>
                {open && (
                  <div className="border-border bg-muted/30 border-t px-4 py-3 pl-11">
                    <EvidenceChecklist signals={e.signals} />
                  </div>
                )}
              </div>
            );
          })}
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
