import Link from "next/link";
import { CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";
import type { IngestionEvent } from "@/lib/knowledge/runData";
import {
  buildBranch,
  buildStory,
  type RunVitals,
  type StoryLine,
} from "@/lib/knowledge/heartbeat";

/**
 * The run, told as a story.
 *
 * Ordered the way a person reads a result: *what happened*, then the
 * branch of knowledge it grew. A line appears only when its count is
 * non-zero — a story does not narrate what did not happen, and a column of
 * zeros is exactly what made a correct idempotent run look like a broken
 * one.
 */
export function RunStory({
  vitals,
  events,
  alreadyCurrent,
}: {
  vitals: RunVitals;
  events: readonly IngestionEvent[];
  alreadyCurrent: boolean;
}) {
  const story = buildStory(vitals, events);
  const branch = buildBranch(events);

  if (alreadyCurrent) {
    return (
      <section className="border-border rounded-xl border p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-500" />
          <div>
            <p className="font-medium">Already current</p>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Atlas read{" "}
              {vitals.pagesFetched === 1
                ? "a page"
                : `${vitals.pagesFetched} pages`}{" "}
              and found nothing it didn&apos;t already hold. Nothing changed,
              and nothing went wrong — re-reading a source Atlas has already
              understood is expected to look like this.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            What Atlas did
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Every line below is counted from events Atlas actually recorded. A
            stage that never happened isn&apos;t here.
          </p>
        </div>

        <dl className="divide-border border-border divide-y rounded-xl border">
          {story.map((line) => (
            <StoryRow key={line.label} line={line} />
          ))}
        </dl>
      </section>

      {branch.nodes.length > 0 && (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              The branch it grew
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              What this run touched, and what changed on each. Every entity
              opens in the Workspace.
            </p>
          </div>

          <div className="border-border rounded-xl border p-5">
            <p className="mb-4 font-medium">{branch.root}</p>
            <ul className="border-border ml-1 flex flex-col gap-3 border-l pl-5">
              {branch.nodes.map((node) => (
                <li key={node.name} className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {node.entityId ? (
                      <Link
                        href={`/admin/entities/${node.entityId}`}
                        className="text-sm font-medium underline-offset-4 hover:underline"
                      >
                        {node.name}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium">{node.name}</span>
                    )}
                    <OutcomeChip outcome={node.outcome} />
                    {node.hasFirstPartySource && (
                      <span className="text-muted-foreground text-xs">
                        first-party source ✓
                      </span>
                    )}
                    {node.factsLearned > 0 && (
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-500">
                        +{node.factsLearned} fact
                        {node.factsLearned === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  {node.detail && (
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {node.detail}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}

function StoryRow({ line }: { line: StoryLine }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 p-4">
      <dt className="text-muted-foreground min-w-[140px] text-sm">
        {line.label}
      </dt>
      <dd className="flex-1">
        <span
          className={`text-sm font-medium ${
            line.tone === "growth"
              ? "text-emerald-700 dark:text-emerald-500"
              : line.tone === "attention"
                ? "text-amber-700 dark:text-amber-500"
                : ""
          }`}
        >
          {line.tone === "growth" && (
            <Sparkles className="mr-1.5 inline h-3.5 w-3.5" />
          )}
          {line.tone === "attention" && (
            <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5" />
          )}
          {line.value}
        </span>
        {line.detail && (
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
            {line.detail}
          </p>
        )}
      </dd>
    </div>
  );
}

function OutcomeChip({ outcome }: { outcome: string }) {
  const tone =
    outcome === "created" || outcome === "enriched"
      ? "border-emerald-600/40 text-emerald-700 dark:text-emerald-500"
      : outcome === "refused"
        ? "border-amber-500/50 text-amber-700 dark:text-amber-500"
        : "border-border text-muted-foreground";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] ${tone}`}>
      {outcome}
    </span>
  );
}
