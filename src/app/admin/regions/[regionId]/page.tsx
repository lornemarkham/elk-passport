import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Search, Terminal } from "lucide-react";
import { loadRegions, findRegion } from "@/lib/knowledge/regions";
import {
  loadWorkspaceBundle,
  type WorkspaceBundle,
} from "@/lib/knowledge/workspaceData";
import {
  loadResearchMissions,
  awaitsReview,
  isOpen,
} from "@/lib/knowledge/researchMissions";

type Props = { params: Promise<{ regionId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { regionId } = await params;
  const region = findRegion(await loadRegions(), regionId);
  return { title: region ? `${region.name} — Atlas` : "Region — Atlas" };
}

/**
 * **A Region — the operating scope for growing a destination.**
 *
 * ## The one question this page answers
 *
 * *"How healthy is Atlas's knowledge of this destination, and how do I grow
 * it?"*
 *
 * Not "how is Atlas doing" (that is the global home) and not "what does
 * Atlas know about this thing" (that is the entity workspace). A region
 * sits between them and owns something neither can: **the growth of
 * knowledge within a geographic scope.**
 *
 * ## Everything here is scoped to members
 *
 * Counts, research, and health describe *entities placed in this region*,
 * and nothing else. That is the whole reason the Region primitive had to be
 * real before this page could exist — a scoped view over membership that
 * does not exist is a lie with a percentage on it.
 *
 * ## Ingestion belongs here conceptually, and says so honestly
 *
 * The operator's mental model is *"grow the Okanagan"*, not *"crawl entity
 * #1234"* — so this is where growth lives. But **no button here starts
 * work**, because today ingestion is CLI-only and a button that pretends
 * otherwise is worse than no button.
 *
 * So the page prints the exact commands instead. An operator who reads
 * `npm run run-queue` understands the system correctly; one who clicks Run
 * and sees nothing happen does not. Wiring "UI enqueues, worker executes"
 * is recorded as the next capability rather than smuggled in here.
 */
export default async function RegionPage({ params }: Props) {
  const { regionId } = await params;

  const [regionsResult, bundle, missions] = await Promise.all([
    loadRegions(),
    loadWorkspaceBundle().catch((): WorkspaceBundle | null => null),
    loadResearchMissions(),
  ]);

  const region = findRegion(regionsResult, regionId);
  if (!region) notFound();

  const members = new Set(region.memberIds);
  const entities = (
    (bundle?.entities ?? []) as unknown as Record<string, unknown>[]
  ).filter((e) => members.has(String(e.id)));
  const scores = (bundle?.scores ?? []).filter((s) => members.has(s.entityId));

  const averageCompleteness =
    scores.length > 0
      ? Math.round(
          scores.reduce((sum, s) => sum + s.overallPercent, 0) / scores.length,
        )
      : null;

  // Scoped to this region's members — a regional number that counted the
  // whole corpus would be the exact confusion this hierarchy exists to end.
  const regionMissions = missions.filter((m) => members.has(m.entityId));
  const waiting = regionMissions.filter(awaitsReview);
  const running = regionMissions.filter(isOpen);

  const thinnest = [...scores]
    .sort((a, b) => a.overallPercent - b.overallPercent)
    .slice(0, 5);
  const names = new Map(entities.map((e) => [String(e.id), String(e.name)]));

  return (
    <div className="flex flex-col gap-10">
      <div>
        <Link
          href="/admin/regions"
          className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Regions
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">{region.name}</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          How healthy Atlas&apos;s knowledge of this destination is, and how to
          grow it.
        </p>
      </div>

      {/* --- Regional health, scoped ---------------------------------------- */}
      <section className="border-border grid gap-6 rounded-xl border p-6 sm:grid-cols-3">
        <Stat
          label="Entities placed here"
          value={String(region.memberIds.length)}
        />
        <Stat
          label="Average completeness"
          value={averageCompleteness === null ? "—" : `${averageCompleteness}%`}
          hint={
            averageCompleteness === null
              ? "Nothing scored yet"
              : "Of what Atlas holds, not of the world"
          }
        />
        <Stat
          label="Findings waiting on you"
          value={String(waiting.length)}
          hint={
            running.length > 0 ? `${running.length} more requested` : undefined
          }
        />
      </section>

      {waiting.length > 0 && (
        <Link
          href="/admin"
          className="border-border hover:bg-muted/30 flex items-center gap-3 rounded-xl border p-5 transition"
        >
          <Search className="h-4 w-4" />
          <span className="text-sm font-medium">
            {waiting.length} finding{waiting.length === 1 ? "" : "s"} in{" "}
            {region.name} waiting on a decision
          </span>
          <ArrowRight className="text-muted-foreground ml-auto h-4 w-4" />
        </Link>
      )}

      {/* --- Where this region is thinnest ---------------------------------- */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Thinnest here
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              The entities in {region.name} that Atlas knows least about.
            </p>
          </div>
          <Link
            href={`/admin/regions/${region.id}/entities`}
            className="border-border hover:bg-muted/40 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition"
          >
            All {region.memberIds.length} entities
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {thinnest.length === 0 ? (
          <p className="text-muted-foreground border-border rounded-xl border border-dashed p-6 text-sm">
            No entities have been placed in {region.name} yet. Place one with{" "}
            <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
              npm run define-region -- &quot;{region.name}&quot; --assign
              &quot;Big White Ski Resort&quot;
            </code>
          </p>
        ) : (
          <div className="border-border divide-border divide-y rounded-xl border">
            {thinnest.map((score) => (
              <Link
                key={score.entityId}
                href={`/admin/entities/${score.entityId}`}
                className="hover:bg-muted/30 flex items-center gap-4 px-5 py-3 transition"
              >
                <p className="flex-1 text-sm font-medium">
                  {names.get(score.entityId) ?? score.entityId.slice(0, 8)}
                </p>
                <p className="text-muted-foreground text-sm tabular-nums">
                  {score.overallPercent}%
                </p>
                <ArrowRight className="text-muted-foreground h-4 w-4" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* --- Growth. Conceptually regional; honestly CLI today. ------------- */}
      <section className="border-border rounded-xl border p-6">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Terminal className="h-4 w-4" />
          Grow {region.name}
        </p>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
          Growing a region is where ingestion belongs. Atlas does not start
          crawls from the browser — a request that waited on a fetch, an LLM
          call and a merge would time out, and a button that silently does
          nothing teaches the wrong model. These commands are the real interface
          today.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Command
            command="npm run queue-benchmark"
            does="Queue the sources Atlas already knows it should read."
          />
          <Command
            command="npm run run-queue"
            does="Fetch and learn from everything queued. Bounded and resumable."
          />
          <Command
            command="npm run run-missions"
            does="Answer research a curator requested."
          />
          <Command
            command={`npm run define-region -- "${region.name}" --assign "<entity>"`}
            does="Place an entity in this region. Curator-asserted, reversible."
          />
        </div>
        <Link
          href="/admin/runs"
          className="text-muted-foreground hover:text-foreground mt-4 inline-flex items-center gap-1.5 text-sm underline-offset-4 hover:underline"
        >
          Watch what happens in Runs
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">
        {value}
      </p>
      {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
    </div>
  );
}

function Command({ command, does }: { command: string; does: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4">
      <code className="bg-muted w-fit rounded px-2 py-1 text-xs">
        {command}
      </code>
      <span className="text-muted-foreground text-sm">{does}</span>
    </div>
  );
}
