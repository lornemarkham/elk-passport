import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  loadRunEvents,
  loadRuns,
  RunsNotConfiguredError,
  RunsUnreachableError,
} from "@/lib/knowledge/runData";
import { formatDate } from "@/lib/knowledge/formatDate";
import {
  computeVitals,
  isAlreadyCurrent,
  runDuration,
  runTitle,
} from "@/lib/knowledge/heartbeat";
import { AdminSetupNotice } from "@/components/admin/AdminSetupNotice";
import { RunPipeline } from "@/components/admin/observatory/RunPipeline";
import { RunTimeline } from "@/components/admin/observatory/RunTimeline";
import { RunStory } from "@/components/admin/observatory/RunStory";
import { AttentionPanel } from "@/components/admin/observatory/AttentionPanel";

type Props = { params: Promise<{ runId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { runId } = await params;
  return { title: `Run ${runId.slice(0, 8)} — Ingestion Observatory` };
}

/**
 * One run, end to end — the Heartbeat.
 *
 * Ordered the way a curator reads a result: **the story first** (what
 * Atlas did and to what), then what wants a human, then how it flowed,
 * then the raw sequence. Putting the event list first would make this a
 * log; putting the outcome first makes it a report.
 *
 * Every number on this page is counted from persisted events. Nothing is
 * simulated, and no element advances because time passed — this is the
 * screen a curator uses to decide whether to *trust* what Atlas did, so a
 * single invented indicator would poison all of it.
 */
export default async function RunDetailPage({ params }: Props) {
  const { runId } = await params;

  let runs, events;
  try {
    [runs, events] = await Promise.all([loadRuns(), loadRunEvents(runId)]);
  } catch (error) {
    if (error instanceof RunsNotConfiguredError) return <AdminSetupNotice />;
    if (error instanceof RunsUnreachableError) {
      return (
        <p className="text-muted-foreground border-border rounded-xl border border-dashed p-8 text-sm">
          {(error as Error).message}
        </p>
      );
    }
    throw error;
  }

  const run = runs.find((r) => r.id === runId);
  const vitals = computeVitals(events);
  const alreadyCurrent = isAlreadyCurrent(run, vitals);
  const duration = runDuration(run);

  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-col gap-4">
        <Link
          href="/admin/ingestion"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          All runs
        </Link>
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              {run?.label ?? runId}
            </h1>
            {run?.status === "running" && (
              <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                running
              </span>
            )}
          </div>
          {run && (
            <p className="text-muted-foreground mt-2 text-sm">
              {runTitle(run)} · {run.status}
              {duration ? ` · ${duration}` : ""} · {formatDate(run.startedAt)}
            </p>
          )}
          {run && (
            // Technical details, deliberately demoted: it answers "how do I
            // reproduce this", not "what happened".
            <details className="mt-3">
              <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs">
                Technical details
              </summary>
              <p className="text-muted-foreground mt-2 font-mono text-xs break-all">
                {run.trigger}
              </p>
              <p className="text-muted-foreground mt-1 font-mono text-xs break-all">
                run {run.id}
              </p>
            </details>
          )}
        </div>
      </header>

      <RunStory
        vitals={vitals}
        events={events}
        alreadyCurrent={alreadyCurrent}
      />

      <AttentionPanel events={events} />

      <RunPipeline events={events} />
      <RunTimeline events={events} />
    </div>
  );
}
