import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Search, Terminal } from "lucide-react";
import { AdminSetupNotice } from "@/components/admin/AdminSetupNotice";
import { AdminUnreachableNotice } from "@/components/admin/AdminUnreachableNotice";
import { EntityPicker } from "@/components/admin/entities/EntityPicker";
import { RegionViewSwitcher } from "@/components/admin/regions/RegionViewSwitcher";
import { loadRegions, findRegion } from "@/lib/knowledge/regions";
import { regionScope } from "@/lib/knowledge/regionScope";
import { buildEntityRows } from "@/lib/knowledge/entityRows";
import { loadRuns } from "@/lib/knowledge/runData";
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
 * **The Region workspace — where a curator manages a destination.**
 *
 * ## The one question
 *
 * *"What needs me in this destination, and how do I improve it?"*
 *
 * Not a summary of a region. The **workspace** for one: health at the top,
 * the entities themselves as the primary section, and the operations that
 * grow the region at the foot. Closer to a repository overview than to a
 * dashboard — you arrive here and you can do the work, rather than arrive
 * here and learn where to go to do the work.
 *
 * ## Why the separate entities page is gone
 *
 * There used to be a level between this page and an entity:
 * `/admin/regions/[id]/entities`, reached by a "Browse & prioritise"
 * button. It answered *"which entities in this destination need
 * attention?"* — which is this page's question with extra words. Two
 * screens, one responsibility, and a navigation step that bought nothing.
 *
 * The principle it produced (ADR 028): **a hierarchy level must have a
 * unique responsibility.** Region manages *many* entities; Entity manages
 * *one*. There is no third question in between, so there is no third page.
 *
 * The entity list did not change when it moved — same `EntityPicker`, same
 * `buildEntityRows`. Only the level it lived at was wrong.
 *
 * ## Everything here is scoped to members
 *
 * Counts, research and health describe *entities placed in this region*
 * and nothing else. That is why the Region primitive had to be real before
 * this page could exist — a scoped view over membership that does not
 * exist is a lie with a percentage on it.
 *
 * ## Ingestion belongs here, and says so honestly
 *
 * The operator's mental model is *"grow the Okanagan"*, not *"crawl entity
 * #1234"*, so growth lives here. But **no button starts work**, because
 * ingestion is CLI-only today and a button that pretends otherwise is
 * worse than no button. The page prints the real commands instead.
 */
export default async function RegionPage({ params }: Props) {
  const { regionId } = await params;

  const [regionsResult, bundle, missions, runs] = await Promise.all([
    loadRegions(),
    loadWorkspaceBundle().catch((): WorkspaceBundle | null => null),
    loadResearchMissions(),
    loadRuns().catch(() => []),
  ]);

  const region = findRegion(regionsResult, regionId);

  // `notFound()` asserts this region does not exist. Only true if Atlas
  // answered and did not list it — a timeout establishes nothing.
  if (!region) {
    if (regionsResult.status === "no-token") return <AdminSetupNotice />;
    if (regionsResult.status === "unreachable")
      return <AdminUnreachableNotice what="This region" />;
    notFound();
  }

  // `null` means Atlas could not be read — **not** that the region is
  // empty. Keeping those apart is why this page once reported "1 placed
  // entity" beside "Nothing has been placed here yet".
  const rosterUnavailable = bundle === null;
  const scoresUnavailable =
    rosterUnavailable || (bundle?.unavailable.includes("scores") ?? false);

  // The region's whole scope: members, plus everything those members
  // contain. Both are asserted facts — a curator placed Big White, and
  // directory expansion recorded what Big White contains. Nothing is
  // inferred from geography.
  const scope = regionScope(region.memberIds, bundle);

  // Everything scoped to the region — a regional number counting the whole
  // corpus would be the exact confusion this hierarchy exists to end.
  const regionMissions = missions.filter((m) => scope.ids.has(m.entityId));
  const waiting = regionMissions.filter(awaitsReview);
  const running = regionMissions.filter(isOpen);

  const rows = bundle
    ? buildEntityRows(bundle, {
        only: scope.ids,
        membership: scope.membership,
        awaitingReview: new Set(waiting.map((m) => m.entityId)),
        researching: new Set(running.map((m) => m.entityId)),
      })
    : [];

  const scores = (bundle?.scores ?? []).filter((s) =>
    scope.ids.has(s.entityId),
  );
  const averageCompleteness =
    scores.length > 0
      ? Math.round(
          scores.reduce((sum, s) => sum + s.overallPercent, 0) / scores.length,
        )
      : null;

  // Ingestion status, from runs Atlas already records. Scoped by nothing —
  // runs are global today — so it is labelled as an Atlas-wide fact rather
  // than presented as a regional one.
  const lastRun = runs.length > 0 ? runs[0] : null;

  // Measured absences across the scope. Each is a real count of a thing
  // Atlas does not hold, never a grade.
  const withoutSources = rows.filter((r) => r.sourceCount === 0).length;

  return (
    <div className="flex flex-col gap-12">
      <header>
        <Link
          href="/admin/regions"
          className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-[13px] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Regions
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{region.name}</h1>
        <p className="text-muted-foreground mt-1.5 text-[13px]">
          Everything needed to manage this destination.
        </p>
      </header>

      {/* --- Health. Scoped to members, and honest about what it can't say. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] font-medium tracking-wide uppercase">
          Health
        </h2>
        <div className="border-border grid gap-6 rounded-lg border p-5 sm:grid-cols-3 lg:grid-cols-5">
          <Stat
            label="Entities"
            value={rosterUnavailable ? "—" : String(scope.ids.size)}
            hint={
              rosterUnavailable
                ? "Could not be loaded"
                : `${scope.directCount} placed · ${scope.indirectCount} inside them`
            }
          />
          <Stat
            label="Knowledge coverage"
            value={
              averageCompleteness === null ? "—" : `${averageCompleteness}%`
            }
            hint={
              // Three states. "Nothing scored yet" is a claim about the
              // corpus and must not appear when the scores merely failed
              // to load.
              scoresUnavailable
                ? "Could not be loaded"
                : averageCompleteness === null
                  ? "Nothing scored yet"
                  : "Of what Atlas holds, not the world"
            }
          />
          <Stat
            label="Without sources"
            value={rosterUnavailable ? "—" : String(withoutSources)}
            hint={
              rosterUnavailable
                ? "Could not be loaded"
                : withoutSources === 0
                  ? "Every entity has evidence"
                  : "Nothing backs these yet"
            }
          />
          <Stat
            label="Findings waiting"
            value={String(waiting.length)}
            hint={waiting.length > 0 ? "Needs a decision" : "Nothing to review"}
          />
          <Stat
            label="Research running"
            value={String(running.length)}
            hint={
              running.length > 0 ? "Requested, not yet back" : "Nothing running"
            }
          />
        </div>

        {/* Ingestion status. Runs are global today, and this says so
            rather than implying Atlas tracks them per region. */}
        <p className="text-muted-foreground text-[13px]">
          {lastRun ? (
            <>
              Last ingestion run:{" "}
              <Link
                href={`/admin/runs/${lastRun.id}`}
                className="text-foreground underline-offset-4 hover:underline"
              >
                {lastRun.label}
              </Link>{" "}
              · {lastRun.status} ·{" "}
              {new Date(lastRun.startedAt).toLocaleString()} — Atlas-wide, not
              scoped to {region.name}.
            </>
          ) : (
            <>No ingestion run has been recorded yet.</>
          )}
        </p>

        {waiting.length > 0 && (
          <Link
            href="/admin/review"
            className="border-border hover:bg-muted/40 flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors"
          >
            <Search className="text-muted-foreground h-4 w-4" />
            <span className="text-sm font-medium">
              {waiting.length} finding{waiting.length === 1 ? "" : "s"} in{" "}
              {region.name} waiting on a decision
            </span>
            <ArrowRight className="text-muted-foreground ml-auto h-4 w-4" />
          </Link>
        )}
      </section>

      {/* --- Entities. The primary section: this is what the page is for. */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[13px] font-medium tracking-wide uppercase">
              Entities
            </h2>
            <p className="text-muted-foreground mt-1 max-w-2xl text-[13px]">
              {scope.indirectCount > 0 ? (
                <>
                  {scope.directCount} placed by a curator ·{" "}
                  {scope.indirectCount} inside them. Both are asserted —
                  membership by a person, containment by what a source said.
                  Neither is inferred from coordinates.
                </>
              ) : (
                <>Entities a curator has placed in this destination.</>
              )}
            </p>
          </div>
          <RegionViewSwitcher />
        </div>

        {rosterUnavailable ? (
          <AdminUnreachableNotice what="This region's entities" />
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground border-border rounded-lg border border-dashed px-5 py-8 text-sm">
            Nothing has been placed in {region.name} yet. Membership is asserted
            by a curator — Atlas will not guess it from coordinates. Place one
            with{" "}
            <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
              npm run define-region -- &quot;{region.name}&quot; --assign
              &quot;&lt;entity&gt;&quot;
            </code>
          </p>
        ) : (
          <EntityPicker entities={rows} showMembership />
        )}
      </section>

      {/* --- Region operations. Verbs performed on this destination. ------ */}
      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] font-medium tracking-wide uppercase">
          Region actions
        </h2>
        <div className="border-border rounded-lg border p-5">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Terminal className="h-4 w-4" />
            Grow {region.name}
          </p>
          <p className="text-muted-foreground mt-2 max-w-2xl text-[13px] leading-relaxed">
            Growth is scoped to this region: it works the branch beneath{" "}
            {region.name}&apos;s members and places what it discovers here, so
            no membership has to be re-typed afterwards. Atlas does not start
            crawls from the browser — a request that waited on a fetch, an LLM
            call and a merge would time out, and a button that silently does
            nothing teaches the wrong model.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <Command
              command={`npm run grow-region -- "${region.name}" --dry-run`}
              does={`Plan a scoped run over ${region.name}. Costs nothing.`}
              primary
            />
            <Command
              command={`npm run grow-region -- "${region.name}"`}
              does="Fetch and learn, bounded to this region. Discoveries land here."
              primary
            />
            <Command
              command="npm run run-missions"
              does="Answer research a curator requested."
            />
            <Command
              command={`npm run define-region -- "${region.name}" --assign "<entity>"`}
              does="Place an entity by hand. Only needed for a new starting point."
            />
          </div>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
            <FootLink href="/admin/review" label="Review findings" />
            <FootLink href="/admin/runs" label="Watch what happens in Runs" />
          </div>
        </div>
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
      <p className="text-muted-foreground text-[13px]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
    </div>
  );
}

function Command({
  command,
  does,
  primary,
}: {
  command: string;
  does: string;
  /** The region-scoped verbs. Emphasis is the only hierarchy here — no buttons. */
  primary?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4">
      <code
        className={`w-fit rounded px-2 py-1 font-mono text-xs ${
          primary ? "bg-foreground/90 text-background" : "bg-muted"
        }`}
      >
        {command}
      </code>
      <span className="text-muted-foreground text-[13px]">{does}</span>
    </div>
  );
}

function FootLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-[13px] underline-offset-4 transition-colors hover:underline"
    >
      {label}
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}
