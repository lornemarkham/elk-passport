"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * **Placing an entity in a Region, from the page that knows it is unplaced.**
 *
 * This is the first mission an operator can finish without a terminal, and it
 * needed no new backend to do it: `POST /api/admin/regions/:id/members` has
 * existed for some time, proxies to Atlas with the token server-side, and calls
 * the **same `RegionMembershipService.assert()`** that `npm run define-region`
 * calls. The region workspace already posts to it. Nothing about placement is
 * reimplemented here — this component only decides *which* ids to send.
 *
 * ## Why the count comes back from Atlas, not from this component
 *
 * `router.refresh()` re-runs the server component, which re-reads membership
 * and re-evaluates the mission. The row disappearing and the "18 remaining"
 * dropping are two readings of one authoritative fact, not a local counter
 * being decremented.
 *
 * A row is marked placed the moment Atlas's own response names it in `added`
 * or `alreadyMember` — that is reporting the API's answer, not guessing ahead
 * of it. A row whose call failed stays exactly where it was, with the error
 * attached. Optimistically removing it would report work Atlas never did.
 *
 * ## Why the completion block lives here
 *
 * Mission progression is derived: the moment the last entity is placed,
 * `evaluateDomain` makes the *next* mission current, so a server render can
 * never show "you just finished this one" — it has no memory of a previous
 * state. The celebration therefore reports **what this action did** (Atlas
 * placed N, none remain), and the operator's *Continue* triggers the refresh
 * that brings the newly-current mission in. Nothing about mission state is
 * faked or advanced by hand.
 *
 * ## Why there is no "Place all"
 *
 * `assert()` takes an array, so bulk placement is free and safe *to write*.
 * But **no route removes a `contains` edge**, so at this scale an accidental
 * bulk placement has no undo. Atlas automates reversible work and reviews
 * irreversible work; until un-placing exists, a one-click "place everything"
 * is irreversible work wearing an automation's clothes. Per-row and an
 * explicit multi-select are both deliberate acts, so both are offered.
 */

export interface PlacementRow {
  readonly id: string;
  /** The entity's own name. Often generic on OpenStreetMap POIs. */
  readonly name: string;
  /** What kind of place it is, in the source's words. Disambiguates two rows both called "Viewpoint". */
  readonly kindLabel?: string;
  /** Coordinates or provenance — whatever makes this row identifiable when the name does not. */
  readonly detail?: string;
}

type RowState =
  | { readonly status: "pending" }
  | { readonly status: "placing" }
  | { readonly status: "placed"; readonly already: boolean }
  | { readonly status: "failed"; readonly error: string };

export function PlacementList({
  regionId,
  regionName,
  rows,
}: {
  /** Absent when Atlas could not identify the Region — the list refuses rather than guessing. */
  regionId?: string;
  regionName: string;
  rows: readonly PlacementRow[];
}) {
  const router = useRouter();
  const [state, setState] = useState<Record<string, RowState>>({});
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const placed = useMemo(
    () => rows.filter((r) => state[r.id]?.status === "placed"),
    [rows, state],
  );
  const remaining = rows.length - placed.length;

  if (!regionId) {
    return (
      <p className="max-w-2xl text-sm leading-relaxed">
        Atlas could not identify which Region is being built, so it cannot say
        what is unplaced. That is a failed read, not an empty list — nothing is
        offered here until it answers.
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="max-w-2xl text-sm leading-relaxed">
        Everything {regionName} knows in this domain is already placed.
      </p>
    );
  }

  const place = async (ids: readonly string[]) => {
    if (ids.length === 0) return;
    setBusy(true);
    setState((s) => {
      const next = { ...s };
      for (const id of ids) next[id] = { status: "placing" };
      return next;
    });

    try {
      // The existing route. Same service the CLI uses, token stays server-side.
      const response = await fetch(`/api/admin/regions/${regionId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityIds: [...ids] }),
      });
      const data = (await response.json()) as {
        added?: { id: string }[];
        alreadyMember?: { id: string }[];
        unknownIds?: string[];
        error?: string;
      };

      if (!response.ok) {
        const error = data.error ?? "Atlas refused the change.";
        setState((s) => {
          const next = { ...s };
          for (const id of ids) next[id] = { status: "failed", error };
          return next;
        });
        return;
      }

      // Marked from Atlas's own answer, never from the request. An id Atlas
      // did not confirm stays unplaced and says why.
      const added = new Set((data.added ?? []).map((e) => e.id));
      const already = new Set((data.alreadyMember ?? []).map((e) => e.id));
      setState((s) => {
        const next = { ...s };
        for (const id of ids) {
          if (added.has(id)) next[id] = { status: "placed", already: false };
          else if (already.has(id))
            next[id] = { status: "placed", already: true };
          else
            next[id] = {
              status: "failed",
              error:
                "Atlas did not confirm this one — it may not be an entity it holds.",
            };
        }
        return next;
      });
      setSelected(new Set());
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not reach Atlas.";
      setState((s) => {
        const next = { ...s };
        for (const id of ids) next[id] = { status: "failed", error: message };
        return next;
      });
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /* --- Everything placed: the moment the mission finished ---------------- */
  if (remaining === 0) {
    return (
      <div className="border-border flex flex-col gap-4 border-y py-8">
        <p className="text-primary text-[11.5px] font-medium tracking-widest uppercase">
          ✓ Mission complete
        </p>
        <p className="font-heading max-w-2xl text-3xl leading-tight font-medium tracking-tight">
          Every Recreation entity is in {regionName}.
        </p>
        <dl className="mt-1 flex flex-wrap gap-x-12 gap-y-3">
          <div>
            <dt className="text-muted-foreground text-[12px] tracking-wide uppercase">
              Placed
            </dt>
            <dd className="font-heading text-[19px] font-medium tabular-nums">
              {placed.length}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-[12px] tracking-wide uppercase">
              Remaining
            </dt>
            <dd className="font-heading text-[19px] font-medium tabular-nums">
              0
            </dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="bg-foreground text-background focus-visible:ring-ring mt-2 w-fit rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Continue to the next mission
        </button>
        <p className="text-muted-foreground max-w-2xl text-[12.5px] leading-relaxed">
          Atlas re-reads membership and re-evaluates every mission. The next one
          becomes current because this one&apos;s conditions are now true — not
          because anything was marked done.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-sm">
          <span className="font-medium tabular-nums">{remaining}</span>{" "}
          remaining
        </p>
        <button
          type="button"
          disabled={busy || selected.size === 0}
          onClick={() => void place([...selected])}
          className="border-border hover:bg-muted focus-visible:ring-ring rounded-md border px-3.5 py-1.5 text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
        >
          Place selected ({selected.size})
        </button>
      </div>

      <ul className="divide-border divide-y">
        {rows.map((row) => {
          const rowState = state[row.id] ?? { status: "pending" };
          const isPlaced = rowState.status === "placed";

          return (
            <li
              key={row.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0"
            >
              <input
                type="checkbox"
                checked={selected.has(row.id)}
                disabled={busy || isPlaced}
                onChange={() => toggle(row.id)}
                aria-label={`Select ${row.name}`}
                className="accent-primary h-4 w-4 shrink-0 disabled:opacity-30"
              />

              <span className="min-w-[14rem] flex-1">
                <span
                  className={`block text-sm ${isPlaced ? "text-muted-foreground line-through" : "font-medium"}`}
                >
                  {row.name}
                </span>
                <span className="text-muted-foreground mt-0.5 block text-[12.5px] leading-relaxed">
                  {[row.kindLabel, row.detail].filter(Boolean).join("  ·  ")}
                </span>
                {rowState.status === "failed" && (
                  <span className="text-destructive mt-1 block text-[12.5px] leading-relaxed">
                    {rowState.error}
                  </span>
                )}
              </span>

              {isPlaced ? (
                <span className="text-muted-foreground shrink-0 text-[12.5px]">
                  {rowState.already ? "Already a member" : "Placed"}
                </span>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void place([row.id])}
                  className="bg-foreground text-background focus-visible:ring-ring shrink-0 rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
                >
                  {rowState.status === "placing"
                    ? "Placing…"
                    : `Place in ${regionName}`}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-muted-foreground max-w-2xl text-[12.5px] leading-relaxed">
        Placement is a curator&apos;s assertion, never inferred from
        coordinates. It writes a <span className="font-mono">contains</span>{" "}
        edge through the same service the command line uses.
      </p>
    </div>
  );
}
