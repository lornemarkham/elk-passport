"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Copy,
  Loader2,
  MessageSquareQuote,
  Tags,
  Waves,
  X,
} from "lucide-react";
import { AdminDuplicatesView } from "@/components/admin/AdminDuplicatesView";
import { RegionDrawer } from "./RegionDrawer";

/**
 * **The curator's workflows, hosted inside the region.**
 *
 * Each one is a `RegionDrawer` over something that already exists:
 *
 * | Workflow | Reuses |
 * |---|---|
 * | Duplicate review | `AdminDuplicatesView`, unmodified |
 * | Research review | `decideResearch`, the same server action `/admin/review` posts to |
 * | Activity | `/api/admin/runs/:id`, the same events the Observatory renders |
 *
 * **Nothing here reimplements a workflow.** The pages at `/admin/duplicates`,
 * `/admin/review` and `/admin/runs` still exist and still work — this gives
 * their contents a second home so a curator does not have to leave the
 * region to use them. A drawer that reimplemented duplicate review would
 * be a second surface to keep correct, and the first time the two
 * disagreed a curator would have no way to tell which was right.
 */

/* -------------------------------------------------------------------------
 * Duplicate review — pure reuse
 * ---------------------------------------------------------------------- */

export function DuplicatesWorkflow({ trigger }: { trigger: TriggerFn }) {
  return (
    <RegionDrawer
      wide
      title="Duplicate review"
      description="Entities Atlas thinks are the same real thing. Merging is not reversible in practice, so Atlas proposes and never decides — it matches on a deterministic key, never on names that look alike."
      trigger={trigger}
    >
      {/* The exact component /admin/duplicates renders. One implementation. */}
      <AdminDuplicatesView />
    </RegionDrawer>
  );
}

/* -------------------------------------------------------------------------
 * Research review — reuses the server action, scoped to this region
 * ---------------------------------------------------------------------- */

export interface WaitingFinding {
  missionId: string;
  entityId: string;
  entityName: string;
  topic: string;
  summary?: string;
  findings: { label: string; value: string }[];
}

export function ResearchWorkflow({
  trigger,
  waiting,
  decide,
}: {
  trigger: TriggerFn;
  waiting: WaitingFinding[];
  /** The same server action `/admin/review` posts to. Passed in, never re-implemented. */
  decide: (formData: FormData) => Promise<void>;
}) {
  return (
    <RegionDrawer
      wide
      title="Research waiting on you"
      description="Atlas read a source, found something, and stopped before writing it. It proposes; a person decides. Rejecting keeps the evidence — Atlas simply does not apply it."
      trigger={trigger}
    >
      {waiting.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nothing in this region is waiting on a decision. When Atlas researches
          something it cannot resolve on its own, it appears here.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {waiting.map((w) => (
            <li key={w.missionId} className="border-border rounded-lg border">
              <div className="border-border flex flex-wrap items-baseline gap-2 border-b px-4 py-3">
                <Link
                  href={`/admin/entities/${w.entityId}`}
                  className="text-sm font-medium underline-offset-4 hover:underline"
                >
                  {w.entityName}
                </Link>
                <span className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 text-[12px]">
                  {w.topic}
                </span>
              </div>

              <div className="px-4 py-3">
                {w.summary && (
                  <p className="text-muted-foreground mb-3 text-[13px] leading-relaxed">
                    {w.summary}
                  </p>
                )}
                {w.findings.length === 0 ? (
                  <p className="text-muted-foreground text-[13px]">
                    Atlas found nothing on this topic. That is a real result —
                    it usually means no source Atlas can reach publishes it.
                  </p>
                ) : (
                  <dl className="flex flex-col gap-1.5">
                    {w.findings.map((f, i) => (
                      <div key={i} className="flex gap-3 text-[13px]">
                        <dt className="text-muted-foreground w-40 shrink-0">
                          {f.label}
                        </dt>
                        <dd>{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                <div className="mt-4 flex gap-2">
                  <form action={decide}>
                    <input type="hidden" name="missionId" value={w.missionId} />
                    <input type="hidden" name="entityId" value={w.entityId} />
                    <input type="hidden" name="decision" value="accept" />
                    <button className="bg-foreground text-background inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-opacity hover:opacity-90">
                      <Check className="h-3.5 w-3.5" />
                      Accept
                    </button>
                  </form>
                  <form action={decide}>
                    <input type="hidden" name="missionId" value={w.missionId} />
                    <input type="hidden" name="entityId" value={w.entityId} />
                    <input type="hidden" name="decision" value="reject" />
                    <button className="border-border hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors">
                      <X className="h-3.5 w-3.5" />
                      Reject
                    </button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </RegionDrawer>
  );
}

/* -------------------------------------------------------------------------
 * Activity — the run, step by step, as it happened
 * ---------------------------------------------------------------------- */

interface RunEvent {
  id: string;
  stage: string;
  outcome: string;
  at: string;
  subject: string;
  message: string;
}

/**
 * **What Atlas actually did, step by step.**
 *
 * Replaces a link labelled *"Watch what Atlas did"* that went to a page
 * of runs — one more navigation to answer "did anything happen". This
 * reads the same events the Observatory does, in the same order, and
 * refreshes while a run is live.
 */
export function ActivityWorkflow({
  trigger,
  runId,
  runLabel,
  live,
}: {
  trigger: TriggerFn;
  runId: string | null;
  runLabel: string;
  /** Poll while the run is still going. */
  live: boolean;
}) {
  return (
    <RegionDrawer
      wide
      title={runId ? `Activity — ${runLabel}` : "Activity"}
      description="Every fetch, extraction and merge Atlas performed, in the order it happened. The same events the Observatory shows — this is just a closer window onto them."
      trigger={trigger}
    >
      {runId ? (
        <ActivityStream runId={runId} live={live} />
      ) : (
        <p className="text-muted-foreground text-sm">
          Atlas has not run anything yet, so there is no activity to show.
        </p>
      )}
    </RegionDrawer>
  );
}

function ActivityStream({ runId, live }: { runId: string; live: boolean }) {
  const router = useRouter();
  const [events, setEvents] = useState<RunEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/admin/runs/${runId}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as {
          run?: { status: string } | null;
          events?: RunEvent[];
          error?: string;
        };
        if (cancelled) return;
        if (data.error) throw new Error(data.error);
        setEvents(data.events ?? []);
        if (live && data.run?.status === "running") {
          timer.current = setTimeout(() => void tick(), 1000);
        } else if (live) {
          router.refresh();
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not read the run.");
      }
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [runId, live, router]);

  if (error) {
    return (
      <p className="text-[13px] text-amber-700 dark:text-amber-400">{error}</p>
    );
  }
  if (events === null) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Reading the run…
      </p>
    );
  }
  if (events.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        This run recorded no events.
      </p>
    );
  }

  return (
    <ol className="flex flex-col">
      {events.map((e) => (
        <li key={e.id} className="border-border flex gap-3 border-b py-2.5">
          <span
            className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
              e.outcome === "failed"
                ? "bg-amber-500"
                : e.outcome === "skipped"
                  ? "bg-muted-foreground/30"
                  : "bg-emerald-500"
            }`}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px]">
              <span className="font-medium">
                {STAGE_WORDS[e.stage] ?? e.stage}
              </span>
              {"  "}
              <span className="text-foreground/70">{e.subject}</span>
            </span>
            <span className="text-muted-foreground block text-[12px] leading-relaxed">
              {e.message}
            </span>
          </span>
          <span className="text-muted-foreground/60 shrink-0 text-[11px] tabular-nums">
            {new Date(e.at).toLocaleTimeString()}
          </span>
        </li>
      ))}
    </ol>
  );
}

const STAGE_WORDS: Record<string, string> = {
  "run-started": "Started",
  "source-discovered": "Discovered",
  "source-queued": "Queued",
  "source-fetched": "Read",
  "source-verified": "Verified",
  "knowledge-extracted": "Understood",
  "entity-created": "Created",
  "entity-matched": "Matched",
  "entity-enriched": "Enriched",
  "run-failed": "Failed",
  "run-finished": "Finished",
};

/* -------------------------------------------------------------------------
 * Triggers
 * ---------------------------------------------------------------------- */

type TriggerFn = (open: () => void) => React.ReactNode;

/** A card in "What you can do" that opens a drawer rather than navigating. */
export function WorkflowCard({
  label,
  detail,
  icon,
  badge,
  onOpen,
}: {
  label: string;
  detail: string;
  icon: React.ReactNode;
  badge?: number;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="border-border hover:border-foreground/30 hover:bg-muted/40 group flex flex-col rounded-lg border px-4 py-3.5 text-left transition-colors"
    >
      <span className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-sm font-medium">{label}</span>
        {badge !== undefined && badge > 0 && (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 tabular-nums dark:text-amber-400">
            {badge}
          </span>
        )}
        <ArrowRight className="text-muted-foreground/0 group-hover:text-muted-foreground ml-auto h-4 w-4 transition-colors" />
      </span>
      <span className="text-muted-foreground mt-1.5 block text-[13px] leading-relaxed">
        {detail}
      </span>
    </button>
  );
}

export const WORKFLOW_ICONS = {
  duplicates: <Copy className="h-4 w-4" />,
  research: <MessageSquareQuote className="h-4 w-4" />,
  activity: <Waves className="h-4 w-4" />,
  types: <Tags className="h-4 w-4" />,
};
