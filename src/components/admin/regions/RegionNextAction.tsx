"use client";

import { ArrowRight, Check, Sparkles, Target } from "lucide-react";
import type { OperationSpec } from "@/lib/knowledge/operationCatalogue";

/**
 * **Next best action — one recommendation, ranked, explained.**
 *
 * ## The question this answers
 *
 * A curator opening Mission Control has already decided to do *something*.
 * What they lack is **which**. A list of findings is a list of decisions;
 * this makes one and shows its reasoning, with the rest ranked beneath so
 * the choice is visible rather than hidden.
 *
 * ## Every recommendation states its consequences before it runs
 *
 * What it does · why *now*, given this region's actual state · **whether
 * it writes to Atlas** · what comes out · how long, but only if Atlas has
 * measured it. A curator who can predict the outcome can trust the result.
 *
 * `mutates` is shown explicitly rather than left to be inferred from the
 * verb, because Atlas's whole model is *propose, then a person decides* —
 * the interface should make that visible at the point of decision.
 *
 * ## "Nothing blocks Atlas" is not "nothing to do"
 *
 * When the queue empties, the panel does **not** go quiet. Atlas can
 * always keep learning given a new source; an empty queue means *no human
 * decision is outstanding*, which is a different and much better message
 * than silence.
 */
export function RegionNextAction({
  ranked,
  regionName,
  onOpen,
}: {
  ranked: readonly OperationSpec[];
  regionName: string;
  /** Opens the workflow that resolves an operation. Owned by the parent. */
  onOpen: (id: OperationSpec["id"]) => void;
}) {
  const [primary, ...rest] = ranked;

  if (!primary) {
    return (
      <section className="rounded-xl border-2 border-emerald-600/30 bg-emerald-500/[0.04] px-6 py-6">
        <p className="flex items-center gap-2 text-base font-semibold">
          <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />
          Nothing is waiting on you
        </p>
        <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-relaxed">
          Every decision Atlas needed a human for has been made, and it has read
          everything it currently knows about in {regionName}.{" "}
          <span className="text-foreground font-medium">
            This is not the end of the work.
          </span>{" "}
          Atlas keeps learning when it is given something new to read — adding a
          source is the next most valuable thing, and it is the one operation
          that is still terminal-only.
        </p>
        <button
          onClick={() => onOpen("grow")}
          className="border-border bg-background hover:bg-muted mt-5 inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors"
        >
          Grow anyway — it will report finding nothing
          <ArrowRight className="h-4 w-4" />
        </button>
      </section>
    );
  }

  return (
    <section className="border-foreground/20 bg-muted/40 overflow-hidden rounded-xl border-2">
      <div className="bg-foreground text-background flex flex-wrap items-center gap-2 px-6 py-2.5">
        <Target className="h-4 w-4" />
        <span className="text-[13px] font-semibold tracking-wide uppercase">
          Next best action
        </span>
        <span className="ml-auto text-[13px] opacity-80">
          {ranked.length === 1
            ? "The only thing waiting on you"
            : `Ranked first of ${ranked.length} — the rest are below`}
        </span>
      </div>

      <div className="px-6 py-6">
        <h2 className="text-xl font-semibold tracking-tight">
          {primary.label}
          {primary.affected > 0 && (
            <span className="text-muted-foreground ml-2 text-base font-normal tabular-nums">
              · {primary.affected} {primary.affected === 1 ? "item" : "items"}
            </span>
          )}
        </h2>

        <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-relaxed">
          {primary.why}
        </p>

        <div className="mt-5 grid gap-5 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="text-muted-foreground text-[13px] font-medium">
              What happens:
            </p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {primary.outcome.map((o) => (
                <li key={o} className="flex gap-2 text-sm">
                  <span className="text-muted-foreground/50 select-none">
                    →
                  </span>
                  <span className="text-foreground/85">{o}</span>
                </li>
              ))}
            </ul>
          </div>

          <dl className="flex shrink-0 gap-8 text-[13px] sm:flex-col sm:gap-3">
            <div>
              <dt className="text-muted-foreground">Changes data</dt>
              <dd className="mt-0.5 font-medium">
                {primary.mutates ? (
                  <span className="text-amber-700 dark:text-amber-400">
                    Yes — writes to Atlas
                  </span>
                ) : (
                  <span className="text-emerald-700 dark:text-emerald-400">
                    No — read only
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Takes</dt>
              <dd className="mt-0.5 font-medium">
                {primary.durationSeconds === null ? (
                  <span className="text-muted-foreground font-normal">
                    Not measured
                  </span>
                ) : (
                  <>~{primary.durationSeconds}s</>
                )}
              </dd>
            </div>
          </dl>
        </div>

        <button
          onClick={() => onOpen(primary.id)}
          className="bg-foreground text-background mt-6 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
        >
          {primary.label}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {rest.length > 0 && (
        <div className="border-border bg-background/60 border-t px-6 py-4">
          <p className="text-muted-foreground text-[13px] font-medium">
            Then, in order:
          </p>
          <ol className="mt-2 flex flex-col gap-1.5">
            {rest.map((op, i) => (
              <li key={op.id}>
                <button
                  onClick={() => onOpen(op.id)}
                  className="hover:bg-muted group -mx-2 flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors"
                >
                  <span className="text-muted-foreground w-4 shrink-0 text-[13px] tabular-nums">
                    {i + 2}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-medium">{op.label}</span>
                    <span className="text-muted-foreground ml-2 text-[13px]">
                      {op.affected} · {op.does}
                    </span>
                  </span>
                  <Sparkles className="text-muted-foreground/0 group-hover:text-muted-foreground h-3.5 w-3.5 shrink-0 transition-colors" />
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
