import Link from "next/link";
import { Check, Clock, TriangleAlert } from "lucide-react";
import type { IngestionRun } from "@/lib/knowledge/runData";

/**
 * **What Atlas did last** — evidence that survives a reload.
 *
 * ## The gap this closes
 *
 * The operation panel celebrates a run it watched. Reload the page and
 * that celebration is gone, because it lived in component state — so a
 * curator returning in the morning had no idea anything had ever
 * happened. **Evidence that only exists in the session that produced it
 * is not evidence.**
 *
 * This renders server-side from the last run and the entities it touched,
 * so *"Atlas learned something yesterday"* is on the page whether or not
 * this browser was watching.
 *
 * ## Reads the run's own events, like everything else
 *
 * The names come from `entity-created` and `entity-enriched` events —
 * the same rows the badges in the entity list are derived from. There is
 * no second record of what changed that could drift from the first.
 */
export function RegionLastRun({
  run,
  changed,
}: {
  run: IngestionRun | null;
  changed: ReadonlyMap<string, "new" | "updated">;
}) {
  if (!run) {
    return (
      <p className="text-muted-foreground text-[13px]">
        Atlas has not run anything yet. Nothing has changed because nothing has
        been asked of it.
      </p>
    );
  }

  const created = [...changed.values()].filter((v) => v === "new").length;
  const updated = [...changed.values()].filter((v) => v === "updated").length;
  const nothing = created === 0 && updated === 0;
  const failed = run.status === "failed";

  return (
    <div
      className={`rounded-lg border px-5 py-4 ${
        failed
          ? "border-amber-600/40 bg-amber-500/[0.05]"
          : nothing
            ? "border-border"
            : "border-emerald-600/40 bg-emerald-500/[0.05]"
      }`}
    >
      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
        {failed ? (
          <TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-500" />
        ) : (
          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
        )}
        {failed
          ? `Atlas ran into trouble during “${run.label}”`
          : nothing
            ? `Atlas ran “${run.label}” and found nothing new`
            : `Atlas learned something during “${run.label}”`}
        <span className="text-muted-foreground ml-auto flex items-center gap-1.5 text-[13px] font-normal">
          <Clock className="h-3.5 w-3.5" />
          {new Date(run.startedAt).toLocaleString()}
        </span>
      </p>

      {nothing && !failed ? (
        // The most misread outcome in the product, and it earns prose.
        <p className="text-muted-foreground mt-2 max-w-3xl text-[13px] leading-relaxed">
          Every page Atlas knew about had already been read, and nothing it
          found was new.{" "}
          <span className="text-foreground font-medium">
            An empty run is Atlas being current, not Atlas failing
          </span>{" "}
          — it is exactly what a correct second run looks like.
        </p>
      ) : (
        <>
          <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {created > 0 && (
              <span>
                <span className="font-semibold tabular-nums">+{created}</span>{" "}
                <span className="text-muted-foreground text-[13px]">
                  new {created === 1 ? "place" : "places"}
                </span>
              </span>
            )}
            {updated > 0 && (
              <span>
                <span className="font-semibold tabular-nums">{updated}</span>{" "}
                <span className="text-muted-foreground text-[13px]">
                  {updated === 1 ? "place" : "places"} improved
                </span>
              </span>
            )}
          </p>
          <p className="text-muted-foreground mt-3 text-[13px]">
            Marked <Badge tone="new">new</Badge> and{" "}
            <Badge tone="updated">updated</Badge> in the list below.{" "}
            <Link
              href="?gap=changed#entities"
              scroll
              className="text-foreground underline-offset-4 hover:underline"
            >
              Show only what changed
            </Link>
          </p>
        </>
      )}

      <p className="text-muted-foreground mt-3 text-[13px]">
        <Link
          href={`/admin/runs/${run.id}`}
          className="underline-offset-4 hover:underline"
        >
          Every step Atlas took
        </Link>{" "}
        — technical detail, kept out of the way until you want it.
      </p>
    </div>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "new" | "updated";
  children: React.ReactNode;
}) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${
        tone === "new"
          ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400"
          : "bg-sky-600/15 text-sky-700 dark:text-sky-400"
      }`}
    >
      {children}
    </span>
  );
}
