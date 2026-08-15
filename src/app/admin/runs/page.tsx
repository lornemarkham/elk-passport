import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, AlertTriangle, Loader2 } from "lucide-react";
import {
  loadRunEvents,
  loadRuns,
  RunsNotConfiguredError,
  RunsUnreachableError,
  type IngestionRun,
} from "@/lib/knowledge/runData";
import {
  loadWorkspaceBundle,
  type WorkspaceBundle,
} from "@/lib/knowledge/workspaceData";
import { formatDate } from "@/lib/knowledge/formatDate";
import {
  computeVitals,
  isAlreadyCurrent,
  runDuration,
  runTitle,
  type RunVitals,
} from "@/lib/knowledge/heartbeat";
import {
  buildMissionControl,
  type RunWithEvents,
} from "@/lib/knowledge/missionControl";
import { computeRegionHealth } from "@/lib/knowledge/regionHealth";
import { AdminSetupNotice } from "@/components/admin/AdminSetupNotice";
import { MissionControl } from "@/components/admin/observatory/MissionControl";
import { ResearchMissionsPanel } from "@/components/admin/observatory/ResearchMissionsPanel";
import { loadResearchMissions } from "@/lib/knowledge/researchMissions";

export const metadata: Metadata = { title: "Mission Control — Atlas" };

/**
 * Mission Control.
 *
 * Answers "what is Atlas doing, and what should I do next" — not "what
 * happened historically". History still exists, at the bottom, as the
 * Mission Timeline.
 *
 * `revalidate = 10` is real polling, not animation: the page re-derives
 * from the store every ten seconds, so leaving it open during a run shows
 * genuine change and shows nothing when nothing is happening. That
 * distinction is the entire point of the page.
 */
export const revalidate = 10;

export default async function MissionControlPage() {
  let runs;
  try {
    runs = await loadRuns();
  } catch (error) {
    if (error instanceof RunsNotConfiguredError) return <AdminSetupNotice />;
    if (error instanceof RunsUnreachableError) {
      return (
        <div className="flex flex-col gap-6">
          <Header />
          <p className="text-muted-foreground border-border rounded-xl border border-dashed p-8 text-sm">
            {(error as Error).message}
          </p>
        </div>
      );
    }
    throw error;
  }

  const [withEvents, bundle] = await Promise.all([
    Promise.all(
      runs.map(async (run): Promise<RunWithEvents> => {
        try {
          return { run, events: await loadRunEvents(run.id) };
        } catch {
          // A run whose events can't be loaded is still a run. Showing it
          // without detail is more honest than hiding it.
          return { run, events: [] };
        }
      }),
    ),
    // The corpus and the queue. Without it Mission Control can still show
    // run history, but not what Atlas *knows* — so it degrades rather than
    // failing.
    loadWorkspaceBundle().catch((): WorkspaceBundle | null => null),
  ]);

  // Missions are an addition to this page, not a precondition for it —
  // `loadResearchMissions` returns [] rather than throwing.
  const missions = await loadResearchMissions();
  const entityNames = new Map(
    (bundle?.entities ?? []).map((e) => [
      String((e as { id: unknown }).id),
      String((e as { name: unknown }).name),
    ]),
  );

  const model = buildMissionControl(withEvents, bundle);
  const health = computeRegionHealth(bundle);

  return (
    <div className="flex flex-col gap-12">
      <Header />

      {runs.length === 0 ? (
        <div className="border-border rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">Atlas hasn&apos;t learned anything yet.</p>
          <p className="text-muted-foreground mx-auto mt-2 max-w-lg text-sm">
            Give it a source and this page comes alive. Start with{" "}
            <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
              npm run run-queue -- --dry-run
            </code>
            .
          </p>
        </div>
      ) : (
        <>
          <MissionControl model={model} health={health} />
          <ResearchMissionsPanel
            missions={missions}
            entityNames={entityNames}
          />
          <MissionTimeline runs={withEvents} />
        </>
      )}
    </div>
  );
}

/**
 * History, deliberately last and deliberately quiet.
 *
 * It answers "what has Atlas done before", which matters — but it is not
 * the question this page opens with, and putting it first is what made the
 * previous version read as a log viewer.
 */
function MissionTimeline({ runs }: { runs: readonly RunWithEvents[] }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h3 className="text-xl font-semibold tracking-tight">
          Mission timeline
        </h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Every learning run, newest first.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {runs.map(({ run, events }) => {
          const vitals = computeVitals(events);
          return (
            <RunRow
              key={run.id}
              run={run}
              vitals={vitals}
              alreadyCurrent={isAlreadyCurrent(run, vitals)}
            />
          );
        })}
      </div>
    </section>
  );
}

function RunRow({
  run,
  vitals,
  alreadyCurrent,
}: {
  run: IngestionRun;
  vitals: RunVitals;
  alreadyCurrent: boolean;
}) {
  const duration = runDuration(run);

  return (
    <Link
      href={`/admin/runs/${run.id}`}
      className="border-border hover:border-foreground/30 hover:bg-muted/30 group flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border px-5 py-4 transition"
    >
      <div className="min-w-[240px] flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{run.label}</p>
          {run.status === "running" && (
            <Loader2
              className="text-muted-foreground h-3.5 w-3.5 animate-spin"
              aria-label="running"
            />
          )}
          {run.status === "failed" && (
            <AlertTriangle
              className="h-3.5 w-3.5 text-red-600 dark:text-red-400"
              aria-label="failed"
            />
          )}
        </div>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {runTitle(run)} · {formatDate(run.startedAt)}
          {duration ? ` · ${duration}` : ""}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {alreadyCurrent ? (
          <span className="text-muted-foreground">Already current</span>
        ) : (
          <>
            <Stat label="read" value={vitals.pagesFetched} />
            <Stat label="created" value={vitals.entitiesCreated} growth />
            <Stat label="enriched" value={vitals.entitiesEnriched} growth />
            <Stat label="learned" value={vitals.thingsLearned} growth />
            <Stat
              label="connected"
              value={vitals.relationshipsCreated}
              growth
            />
            <Stat label="wants you" value={vitals.needsAttention} warn />
            <Stat label="failed" value={vitals.failed} warn />
          </>
        )}
      </div>

      <ArrowRight className="text-muted-foreground group-hover:text-foreground h-4 w-4 shrink-0 transition" />
    </Link>
  );
}

/** Renders nothing at zero. A run's story is what it did, not a grid of blanks. */
function Stat({
  label,
  value,
  growth,
  warn,
}: {
  label: string;
  value: number;
  growth?: boolean;
  warn?: boolean;
}) {
  if (value === 0) return null;
  return (
    <span
      className={
        warn
          ? "text-amber-700 dark:text-amber-500"
          : growth
            ? "text-emerald-700 dark:text-emerald-500"
            : "text-muted-foreground"
      }
    >
      <span className="font-medium tabular-nums">{value}</span> {label}
    </span>
  );
}

function Header() {
  return (
    <div>
      <Link
        href="/admin"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        Curator Workbench
      </Link>
      <h1 className="text-3xl font-bold tracking-tight">Mission Control</h1>
      <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
        What Atlas is doing, what it just learned, and what it needs from you.
        Every number here is counted from recorded events — nothing is
        simulated.
      </p>
    </div>
  );
}
