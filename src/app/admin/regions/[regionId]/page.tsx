import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Sparkles,
  Terminal,
  TriangleAlert,
} from "lucide-react";
import { AdminSetupNotice } from "@/components/admin/AdminSetupNotice";
import { AdminUnreachableNotice } from "@/components/admin/AdminUnreachableNotice";
import { EntityPicker } from "@/components/admin/entities/EntityPicker";
import { RegionViewSwitcher } from "@/components/admin/regions/RegionViewSwitcher";
import { RegionOperations } from "@/components/admin/regions/RegionOperations";
import {
  diagnoseRegion,
  type FindingAction,
} from "@/lib/knowledge/regionDiagnosis";
import { loadRegions, findRegion } from "@/lib/knowledge/regions";
import { regionScope } from "@/lib/knowledge/regionScope";
import { buildEntityRows } from "@/lib/knowledge/entityRows";
import { loadRuns } from "@/lib/knowledge/runData";
import { loadRecentChanges } from "@/lib/knowledge/recentChanges";
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

  // Ingestion status, from runs Atlas already records.
  const lastRunForChanges = runs.length > 0 ? runs[0] : null;
  const changed = await loadRecentChanges(lastRunForChanges);

  const rows = bundle
    ? buildEntityRows(bundle, {
        only: scope.ids,
        membership: scope.membership,
        awaitingReview: new Set(waiting.map((m) => m.entityId)),
        researching: new Set(running.map((m) => m.entityId)),
        changed,
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

  const lastRun = lastRunForChanges;
  // Atlas may already be working when the page loads — from this button,
  // from the CLI, or from another tab. The workspace picks it up either
  // way rather than claiming Atlas is idle because *this* tab did not
  // start anything.
  const activeRun = runs.find((r) => r.status === "running") ?? null;

  // Facts turned into findings: what Atlas knows, what it doesn't, and
  // what to do about it. Every one is measured; none is a grade.
  const { findings, action } = diagnoseRegion({
    regionName: region.name,
    rows,
    scopeIds: scope.ids,
    averageCompleteness,
    waitingCount: waiting.length,
    runningCount: running.length,
    bundle,
    runs,
  });

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

      {/* --- What Atlas knows and doesn't. Findings, each actionable. -- */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[13px] font-medium tracking-wide uppercase">
            What Atlas knows about {region.name}
          </h2>
          <span className="text-muted-foreground text-[13px] tabular-nums">
            {rosterUnavailable
              ? "—"
              : `${scope.ids.size} entities · ${scope.directCount} placed · ${scope.indirectCount} inside them`}
          </span>
        </div>

        {rosterUnavailable ? (
          <AdminUnreachableNotice what="This region's health" />
        ) : findings.length === 0 ? (
          <p className="text-muted-foreground border-border rounded-lg border border-dashed px-5 py-6 text-[13px]">
            Nothing to report yet — Atlas holds too little here to say anything
            useful about it.
          </p>
        ) : (
          <ul className="border-border divide-border divide-y overflow-hidden rounded-lg border">
            {findings.map((f) => (
              <li
                key={f.title}
                className="flex flex-wrap items-start gap-3 px-4 py-3.5"
              >
                {f.tone === "good" ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-500" />
                ) : (
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
                )}
                <span className="min-w-[240px] flex-1">
                  <span className="block text-sm font-medium">{f.title}</span>
                  {/* Plain English, where the concept is met. A curator
                      should never have to hold Atlas's vocabulary in their
                      head to read their own region. */}
                  <span className="text-muted-foreground mt-0.5 block max-w-3xl text-[13px] leading-relaxed">
                    {f.detail}
                  </span>
                </span>
                {(f.action || f.secondary) && (
                  <span className="flex shrink-0 flex-wrap items-center gap-2">
                    {f.action && (
                      <FindingButton
                        action={f.action}
                        regionId={region.id}
                        primary
                      />
                    )}
                    {f.secondary && (
                      <FindingButton
                        action={f.secondary}
                        regionId={region.id}
                      />
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* --- Teaching, in four lines. Where the words are met. ------- */}
        <details className="border-border group rounded-lg border px-4 py-3">
          <summary className="text-muted-foreground hover:text-foreground cursor-pointer list-none text-[13px] select-none">
            What these words mean
            <span className="ml-1.5 inline-block transition-transform group-open:rotate-90">
              ›
            </span>
          </summary>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <Term
              term="Knowledge coverage"
              means="How much of what Atlas looks for it actually has. Not how much exists in the world — Atlas has no way to know that."
            />
            <Term
              term="Type"
              means="What kind of place something is, in the source's own words. It will decide which layout, rules and research a page gets."
            />
            <Term
              term="Relationships"
              means="How things connect — what contains what, what is near what. They are how a traveller explores rather than searches."
            />
            <Term
              term="Research"
              means="Atlas reading a source to answer one specific question. It proposes; you decide whether it is written."
            />
          </dl>
        </details>
      </section>

      {/* --- The operation. What to do, what happens, and watching it. -- */}
      <div id="next-action" className="scroll-mt-8">
        <RegionOperations
          regionId={region.id}
          regionName={region.name}
          action={action}
          coverageBefore={averageCompleteness}
          entitiesBefore={scope.ids.size}
          activeRunId={activeRun?.id ?? null}
          lastRun={
            lastRun
              ? {
                  id: lastRun.id,
                  status: lastRun.status,
                  label: lastRun.label,
                  startedAt: lastRun.startedAt,
                  finishedAt: lastRun.finishedAt,
                }
              : null
          }
        />
      </div>

      {/* --- Entities. The primary section: this is what the page is for. */}
      <section id="entities" className="flex scroll-mt-8 flex-col gap-4">
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

/**
 * The thing to do about a finding.
 *
 * **Every finding gets one.** A finding without an action is a complaint:
 * it tells a curator something is wrong and leaves them to work out where
 * to go, which is exactly the *"what am I supposed to do?"* this page
 * exists to end.
 *
 * A `planned` action still renders, disabled, saying what it will do. A
 * button that pretended would be worse than none — but a gap with no
 * button at all hides the shape of the product, and a curator cannot tell
 * "Atlas will never do this" from "Atlas cannot do this yet".
 */
function FindingButton({
  action,
  regionId,
  primary,
}: {
  action: FindingAction;
  regionId: string;
  primary?: boolean;
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors";
  const tone = primary
    ? "bg-foreground text-background hover:opacity-90"
    : "border-border hover:bg-muted/50 border text-foreground";

  if (action.kind === "planned") {
    return (
      <span
        title={action.note}
        aria-disabled="true"
        className={`${base} border-border text-muted-foreground/60 cursor-not-allowed border border-dashed`}
      >
        {action.label}
        <span className="text-[11px] tracking-wide uppercase opacity-70">
          soon
        </span>
      </span>
    );
  }

  if (action.kind === "link") {
    return (
      <Link href={action.href} className={`${base} ${tone}`}>
        {action.label}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    );
  }

  if (action.kind === "filter") {
    // Scrolls to the table below with that filter applied. The weakest
    // action and the most universally honest one — "show me which ones"
    // runs on the same measurement the finding counted, so the list can
    // never disagree with the number above it.
    return (
      <Link
        href={`/admin/regions/${regionId}?gap=${action.gap}#entities`}
        scroll
        className={`${base} ${tone}`}
      >
        {action.label}
      </Link>
    );
  }

  // `run` — the operation lives in the panel below, which owns starting,
  // progress and completion. Sending the curator there keeps one place
  // responsible for an operation instead of two buttons that could
  // disagree about whether something is running.
  return (
    <Link href="#next-action" scroll className={`${base} ${tone}`}>
      <Sparkles className="h-3.5 w-3.5" />
      {action.label}
    </Link>
  );
}

/** One short definition. Teaching is four lines, not a manual. */
function Term({ term, means }: { term: string; means: string }) {
  return (
    <div>
      <dt className="text-[13px] font-medium">{term}</dt>
      <dd className="text-muted-foreground mt-0.5 text-[13px] leading-relaxed">
        {means}
      </dd>
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
