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
 * ## Two populations, because there are two kinds of thing here
 *
 * Every row used to carry the same `[Place in Okanagan]` button, which said
 * *I found this, place it?* for a named provincial park and for a row called
 * `Viewpoint` alike. The curator had no way to tell which was which.
 *
 * `placementReadiness.ts` now decides, per entity, whether Atlas can justify
 * asking at all. The **ready** are the curator's actual work. The **withheld**
 * are shown, named and counted — never hidden — but placement is not offered
 * as their next action, because it is not one. They have an evidence problem,
 * and clicking will not solve an evidence problem.
 *
 * ## Why the count comes back from Atlas, not from this component
 *
 * `router.refresh()` re-runs the server component, which re-reads membership
 * and re-evaluates the mission. The row disappearing and the remaining count
 * dropping are two readings of one authoritative fact, not a local counter
 * being decremented.
 *
 * A row is marked placed the moment Atlas's own response names it in `added`
 * or `alreadyMember` — that is reporting the API's answer, not guessing ahead
 * of it. A row whose call failed stays exactly where it was, with the error
 * attached. Optimistically removing it would report work Atlas never did.
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

export interface RowRequirement {
  readonly label: string;
  readonly met: boolean;
  readonly detail: string;
}

export interface RowReadiness {
  readonly ready: boolean;
  /** One line: why this is ready, or why it is not. */
  readonly because: string;
  readonly requirements: readonly RowRequirement[];
  /** Distinct publishers, not record count. */
  readonly publishers: readonly string[];
  /** What kind of operation would resolve the gap. Absent when ready. */
  readonly nextOperation?: string;
}

export interface PlacementRow {
  readonly id: string;
  /** The entity's own name. Often generic on OpenStreetMap POIs. */
  readonly name: string;
  /** What kind of place it is, in the source's words. Disambiguates two rows both called "Viewpoint". */
  readonly kindLabel?: string;
  /** Coordinates or provenance — whatever makes this row identifiable when the name does not. */
  readonly detail?: string;
  readonly readiness: RowReadiness;
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
  /** Every unplaced entity, each carrying its own verdict. Split here, not by the caller. */
  rows: readonly PlacementRow[];
}) {
  const router = useRouter();
  const [state, setState] = useState<Record<string, RowState>>({});
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const ready = useMemo(() => rows.filter((r) => r.readiness.ready), [rows]);
  const withheld = useMemo(
    () => rows.filter((r) => !r.readiness.ready),
    [rows],
  );
  const placed = useMemo(
    () => ready.filter((r) => state[r.id]?.status === "placed"),
    [ready, state],
  );
  const remaining = ready.length - placed.length;
  /** Rows a click can still act on — a placed row is finished, not a choice. */
  const selectable = useMemo(
    () => ready.filter((r) => state[r.id]?.status !== "placed"),
    [ready, state],
  );
  const allSelected =
    selectable.length > 0 && selectable.every((r) => selected.has(r.id));
  const someSelected = selected.size > 0;

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

  return (
    <div className="flex flex-col gap-8">
      <Tally
        unplaced={rows.length}
        readyCount={ready.length}
        withheldCount={withheld.length}
        remaining={remaining}
      />

      {remaining === 0 ? (
        <DecisionsDone
          regionName={regionName}
          placedNow={placed.length}
          withheldCount={withheld.length}
          onContinue={() => router.refresh()}
        />
      ) : (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h3 className="text-[11.5px] font-medium tracking-widest uppercase">
              Ready to place
            </h3>
            <span className="text-muted-foreground text-[12.5px]">
              {selected.size === 0
                ? `${remaining} ready to place`
                : `${selected.size} selected`}
            </span>
          </div>

          {/*
            Select all, and then a separate deliberate act to commit it.

            Bulk placement is safe to *write* — the service takes an array —
            but no route removes a `contains` edge, so at this scale it has no
            undo. That is why there is no one-click "place everything": the
            operator selects, sees the count they are about to commit, and
            presses a button that names it. Two acts, both intentional, and
            the list they apply to is on screen.
          */}
          <div className="border-border flex flex-wrap items-center gap-x-4 gap-y-2 border-y py-3">
            <label className="flex cursor-pointer items-center gap-2.5 text-[13px] font-medium">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(node) => {
                  if (node) node.indeterminate = someSelected && !allSelected;
                }}
                disabled={busy || selectable.length === 0}
                onChange={() =>
                  setSelected(
                    allSelected
                      ? new Set()
                      : new Set(selectable.map((r) => r.id)),
                  )
                }
                aria-label="Select all ready to place"
                className="accent-primary h-4 w-4 disabled:opacity-30"
              />
              Select all
            </label>

            <button
              type="button"
              disabled={busy || selected.size === 0}
              onClick={() => setSelected(new Set())}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded text-[12.5px] underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
            >
              Clear selection
            </button>

            <button
              type="button"
              disabled={busy || selected.size === 0}
              onClick={() => void place([...selected])}
              className="bg-foreground text-background focus-visible:ring-ring ml-auto rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-40"
            >
              {busy && selected.size > 0
                ? `Placing ${selected.size}…`
                : `Place selected (${selected.size})`}
            </button>
          </div>

          <ul className="divide-border divide-y">
            {ready.map((row) => {
              const rowState = state[row.id] ?? { status: "pending" };
              const isPlaced = rowState.status === "placed";

              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-start gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    disabled={busy || isPlaced}
                    onChange={() => toggle(row.id)}
                    aria-label={`Select ${row.name}`}
                    className="accent-primary mt-1 h-4 w-4 shrink-0 disabled:opacity-30"
                  />

                  <span className="min-w-[14rem] flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-3">
                      <span
                        className={`text-sm ${isPlaced ? "text-muted-foreground line-through" : "font-medium"}`}
                      >
                        {row.name}
                      </span>
                      <Verdict ready />
                    </span>
                    <span className="text-muted-foreground mt-0.5 block text-[12.5px] leading-relaxed">
                      {[
                        row.kindLabel,
                        row.detail,
                        row.readiness.publishers.join(" + "),
                      ]
                        .filter(Boolean)
                        .join("  ·  ")}
                    </span>
                    <Evidence readiness={row.readiness} />
                    {rowState.status === "failed" && (
                      <span className="text-destructive mt-1 block text-[12.5px] leading-relaxed">
                        {rowState.error}
                      </span>
                    )}
                  </span>

                  {isPlaced ? (
                    <span className="text-muted-foreground mt-1 shrink-0 text-[12.5px]">
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
        </section>
      )}

      {withheld.length > 0 && (
        <Withheld
          rows={withheld}
          regionName={regionName}
          busy={busy}
          state={state}
          onPlaceAnyway={(id) => void place([id])}
        />
      )}
    </div>
  );
}

/**
 * **Three numbers, because there are three facts.**
 *
 * `17 unplaced` on its own was a true number that produced a false impression:
 * it read as seventeen decisions waiting. Splitting it says what is actually
 * there — how many questions a curator can answer, and how many entities are
 * waiting on evidence instead. The unplaced total stays, so nothing looks like
 * it disappeared when the gate was introduced.
 */
function Tally({
  unplaced,
  readyCount,
  withheldCount,
  remaining,
}: {
  unplaced: number;
  readyCount: number;
  withheldCount: number;
  remaining: number;
}) {
  return (
    <dl className="flex flex-wrap gap-x-10 gap-y-3">
      <Figure term="Unplaced" value={unplaced} />
      <Figure
        term="Placement decisions"
        value={remaining}
        note={
          remaining === readyCount ? undefined : `${readyCount} at last read`
        }
      />
      <Figure term="Need more evidence" value={withheldCount} />
    </dl>
  );
}

function Figure({
  term,
  value,
  note,
}: {
  term: string;
  value: number;
  note?: string;
}) {
  return (
    <div>
      <dt className="text-muted-foreground text-[12px] tracking-wide uppercase">
        {term}
      </dt>
      <dd className="font-heading text-2xl font-medium tabular-nums">
        {value}
        {note && (
          <span className="text-muted-foreground ml-2 text-[12px] font-normal tracking-normal">
            {note}
          </span>
        )}
      </dd>
    </div>
  );
}

/** A small, scannable state marker. Colour carries status and nothing else. */
function Verdict({ ready }: { ready: boolean }) {
  return (
    <span
      className={`text-[11px] font-medium tracking-widest uppercase ${ready ? "text-primary" : "text-muted-foreground"}`}
    >
      {ready ? "Ready" : "Needs evidence"}
    </span>
  );
}

/**
 * The provenance, folded away.
 *
 * Every row must be able to justify its verdict, and no row may be so tall
 * that a list of seventeen stops being scannable. A disclosure is the whole
 * resolution: the summary line is the verdict in one sentence, and opening it
 * gives the requirement-by-requirement reading underneath.
 */
function Evidence({ readiness }: { readiness: RowReadiness }) {
  return (
    <details className="mt-1">
      <summary className="text-muted-foreground marker:text-muted-foreground cursor-pointer text-[12.5px] leading-relaxed">
        {readiness.ready ? "Why ready" : "Why not"} — {readiness.because}
      </summary>
      <ul className="mt-2 flex flex-col gap-1 pl-4">
        {readiness.requirements.map((requirement) => (
          <li
            key={requirement.label}
            className="flex gap-2 text-[12.5px] leading-relaxed"
          >
            <span
              aria-hidden
              className={
                requirement.met ? "text-primary" : "text-muted-foreground"
              }
            >
              {requirement.met ? "✓" : "—"}
            </span>
            <span>
              <span className="text-muted-foreground">
                {requirement.label}:{" "}
              </span>
              {requirement.detail}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * **Shown, counted, explained — and not offered as a placement.**
 *
 * The temptation was to hide these until Atlas knows more. That would be the
 * gate quietly shrinking a to-do list, which is indistinguishable from the
 * gate working. So they stay on the page, in their own section, each one
 * stating what Atlas knows, what it lacks, and what kind of operation would
 * close the gap.
 *
 * **Place anyway exists, and is deliberately quiet.** A curator who recognises
 * the place is a better authority than this gate, and refusing them outright
 * would make Atlas's caution more important than their knowledge. Putting it
 * inside the disclosure rather than beside the name means the default path is
 * acquisition and the override is a considered act.
 */
function Withheld({
  rows,
  regionName,
  busy,
  state,
  onPlaceAnyway,
}: {
  rows: readonly PlacementRow[];
  regionName: string;
  busy: boolean;
  state: Record<string, RowState>;
  onPlaceAnyway: (id: string) => void;
}) {
  return (
    <section className="border-border flex flex-col gap-4 border-t pt-7">
      <div>
        <h3 className="text-[11.5px] font-medium tracking-widest uppercase">
          Needs more evidence before placement
        </h3>
        <p className="text-muted-foreground mt-1.5 max-w-2xl text-[13px] leading-relaxed">
          Atlas holds these, and cannot yet justify asking whether they belong
          to {regionName} — it cannot name them, locate them, or say who
          published them. That is an acquisition problem, not a decision waiting
          on you.
        </p>
      </div>

      <ul className="divide-border divide-y">
        {rows.map((row) => {
          const rowState = state[row.id] ?? { status: "pending" };
          return (
            <li key={row.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-sm font-medium">{row.name}</span>
                <Verdict ready={false} />
              </div>
              <p className="text-muted-foreground mt-0.5 text-[12.5px] leading-relaxed">
                {[
                  row.kindLabel,
                  row.detail,
                  row.readiness.publishers.join(" + "),
                ]
                  .filter(Boolean)
                  .join("  ·  ")}
              </p>
              <Evidence readiness={row.readiness} />
              {row.readiness.nextOperation && (
                <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed font-medium">
                  Next: {row.readiness.nextOperation}
                </p>
              )}
              {rowState.status === "placed" ? (
                <p className="text-muted-foreground mt-1.5 text-[12.5px]">
                  Placed anyway.
                </p>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onPlaceAnyway(row.id)}
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring mt-1.5 rounded text-[12.5px] underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                >
                  {rowState.status === "placing"
                    ? "Placing…"
                    : `Place in ${regionName} anyway`}
                </button>
              )}
              {rowState.status === "failed" && (
                <p className="text-destructive mt-1 text-[12.5px] leading-relaxed">
                  {rowState.error}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * **No placement decisions left — which is not the same as everything placed.**
 *
 * The old completion block said *"Every Recreation entity is in the Okanagan"*,
 * and with a gate in front of it that sentence can be false at the moment it
 * appears. This one states the two figures separately, so finishing the
 * decisions never reads as finishing the domain.
 */
function DecisionsDone({
  regionName,
  placedNow,
  withheldCount,
  onContinue,
}: {
  regionName: string;
  placedNow: number;
  withheldCount: number;
  onContinue: () => void;
}) {
  return (
    <div className="border-border flex flex-col gap-4 border-y py-8">
      <p className="text-primary text-[11.5px] font-medium tracking-widest uppercase">
        ✓ No placement decisions left
      </p>
      <p className="font-heading max-w-2xl text-3xl leading-tight font-medium tracking-tight">
        {withheldCount === 0
          ? `Every Recreation entity is in ${regionName}.`
          : `Everything Atlas can justify placing is in ${regionName}.`}
      </p>
      <dl className="mt-1 flex flex-wrap gap-x-12 gap-y-3">
        <Figure term="Placed just now" value={placedNow} />
        <Figure term="Decisions remaining" value={0} />
        <Figure term="Need more evidence" value={withheldCount} />
      </dl>
      <button
        type="button"
        onClick={onContinue}
        className="bg-foreground text-background focus-visible:ring-ring mt-2 w-fit rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        Continue to the next mission
      </button>
      <p className="text-muted-foreground max-w-2xl text-[12.5px] leading-relaxed">
        Atlas re-reads membership and re-evaluates every mission. The next one
        becomes current because this one&apos;s conditions are now true — not
        because anything was marked done.
        {withheldCount > 0 &&
          ` The ${withheldCount} above are still here, and still counted: they need acquisition, not a decision.`}
      </p>
    </div>
  );
}
