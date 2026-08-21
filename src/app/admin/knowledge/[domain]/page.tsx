import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ACQUISITION_STAGES,
  KNOWLEDGE_DOMAINS,
  TROUBLESHOOTING,
  findDomain,
} from "@/lib/knowledge/knowledgeDomains";
import {
  loadAtlasFacts,
  loadDomainState,
} from "@/lib/knowledge/missionContext";
import { unplacedEntities } from "@/lib/knowledge/missions";
import { buildWorkQueue } from "@/lib/knowledge/workQueue";
import { DomainComplete, WorkQueue } from "@/components/atlas/workQueue";
import { MissionTransition } from "@/components/atlas/missionTransition";
import { PlacementList, type PlacementRow } from "@/components/atlas/placement";
import { REQUIREMENT_LABEL } from "@/lib/knowledge/placementReadiness";
import { GRADE_LABEL } from "@/lib/knowledge/domainHealth";
import { PageHeader } from "@/components/atlas/ui";
import {
  EvidenceQuality,
  HealthPanel,
  KnowledgeTable,
  Opportunities,
  PassportPanel,
} from "@/components/atlas/instruments";
import {
  AddedList,
  BlockerList,
  DomainSection,
  DomainStatusBadge,
  FailureList,
  MissionComplete,
  MissionHeader,
  MissionRoster,
  PublisherLandscape,
  ReferenceItem,
  RunHeader,
  Runbook,
  SubjectList,
  TroubleshootingList,
  WorkflowFlow,
} from "@/components/atlas/domain";
import { EvidenceGaps, ReviewQuestions } from "@/components/atlas/review";

/**
 * **A Knowledge Domain, and the mission being run inside it.**
 *
 * A Knowledge Domain is permanent — Recreation will be Atlas's responsibility
 * for as long as Atlas exists, and it never finishes. What finishes is a
 * **Mission**: a job small enough that an operator can start it, complete it,
 * and move to the next one.
 *
 * ## Three phases, and they lead
 *
 * The operator does the same three things every day, so they are the first
 * thing on the page and they sit in one section rather than three:
 *
 * 1. **Execute** — the command, inline, with what it should produce
 * 2. **Review** — Atlas's irreversible questions, answered yes or no
 * 3. **Complete** — conditions evaluated against Atlas's own state
 *
 * Everything else — health, knowledge, Passport, opportunities, blockers,
 * publishers, the runbook — describes the domain rather than advancing the
 * mission, so it sits beneath, and the explanatory half of it sits behind a
 * disclosure. The page used to lead with why the work mattered. Accurate, and
 * read once.
 *
 * ## Completion is derived, never awarded
 *
 * Health is derived from facts, never from completed tasks — and the same rule
 * governs completion itself, or an operator could tick a box while nothing
 * changed. A mission finishes because the corpus changed, which is the same
 * reason health moved. Nothing is persisted and nothing is scored.
 *
 * ## Two figures, always
 *
 * Under a *Build the Okanagan* framing, counting entities that are in no region
 * would be false, and counting only placed ones would hide work already done.
 * Every count says both: *66 in Atlas · 17 in the region*. The gap between them
 * is itself a mission.
 */

type PageProps = { params: Promise<{ domain: string }> };

export function generateStaticParams() {
  return KNOWLEDGE_DOMAINS.map((domain) => ({ domain: domain.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { domain: slug } = await params;
  const domain = findDomain(slug);
  if (!domain) return { title: "Unknown knowledge domain · Atlas" };
  return {
    title: `${domain.name} · Knowledge Domains · Atlas`,
    description: domain.purpose,
  };
}

/** A cap that says so. A silent cap reads as "that is all of it". */
function Truncated({
  shown,
  total,
  noun,
}: {
  shown: number;
  total: number;
  noun: string;
}) {
  if (total <= shown) return null;
  return (
    <p className="text-muted-foreground max-w-2xl text-[12.5px] leading-relaxed">
      Showing {shown} of {total} {noun}s.
    </p>
  );
}

export default async function KnowledgeDomainPage({ params }: PageProps) {
  const { domain: slug } = await params;
  const domain = findDomain(slug);
  if (!domain) notFound();

  const now = new Date();
  const facts = await loadAtlasFacts(now);
  const { health, work, progress, context } = await loadDomainState(
    domain,
    facts,
    now,
  );
  const regionName = facts.regionName;

  // Derived, never authored. `progress.current` is the first mission that is
  // neither complete nor blocked — so running a command and refreshing moves
  // it, because the corpus moved.
  const currentProgress = progress.current;
  const mission = currentProgress?.mission;
  const outcome = currentProgress?.outcome;
  const nextMission = progress.next?.mission;
  const missionOperation = mission?.operationId
    ? domain.operations.find((o) => o.id === mission.operationId)
    : undefined;

  /**
   * **The working surface for this mission, when it has one.**
   *
   * The unplaced list comes from `unplacedEntities` — the same predicate
   * `allPlacedInRegion()` evaluates — so the rows on screen and the condition
   * that ends the mission cannot disagree. Display fields are joined on by id
   * from the scope, not recomputed.
   *
   * OpenStreetMap POIs are routinely called "Viewpoint" or "Boat Launch", so
   * every row carries its category and its coordinates. Two rows with the same
   * name are still two distinguishable places, and work is never hidden
   * because a source did not name something well.
   *
   * Each row also carries its **placement readiness** — read from
   * `context.placementReadiness`, the same verdict `allPlacedInRegion` grades
   * on. The list and the condition therefore cannot disagree about which
   * entities are a decision and which are an evidence gap.
   */
  const surface = (() => {
    if (mission?.surface !== "place-in-region") return undefined;
    const byId = new Map(health.scope.entities.map((e) => [e.id, e]));
    const rows: PlacementRow[] = unplacedEntities(context).map((entity) => {
      const full = byId.get(entity.id);
      const point =
        full?.geometry?.type === "Point" &&
        Array.isArray(full.geometry.coordinates)
          ? (full.geometry.coordinates as number[])
          : undefined;
      const readiness = context.placementReadiness.get(entity.id);
      return {
        id: entity.id,
        name: entity.name,
        kindLabel: full?.placeType ?? entity.kind,
        detail:
          point && point.length === 2
            ? `${point[1]!.toFixed(4)}, ${point[0]!.toFixed(4)}`
            : "No coordinates",
        // A missing verdict is rendered as not-ready rather than as ready.
        // The gate not having run is not evidence that it would have passed.
        readiness: {
          ready: readiness?.ready ?? false,
          because:
            readiness?.because ??
            "Atlas did not assess this one, so it cannot say whether asking is reasonable.",
          requirements: (readiness?.requirements ?? []).map((requirement) => ({
            label: REQUIREMENT_LABEL[requirement.requirement],
            met: requirement.met,
            detail: requirement.detail,
          })),
          publishers: readiness?.publishers ?? [],
          nextOperation: readiness?.nextOperation,
        },
      };
    });
    return (
      <PlacementList
        regionId={facts.region?.id}
        regionName={regionName}
        rows={rows}
      />
    );
  })();

  // Everything that needs a person, grouped once and read from the modules
  // that already own each count — the queue cannot disagree with the section
  // it points at.
  const queue = buildWorkQueue(health, work, context, progress);

  const worst = health.readings.reduce((a, b) =>
    ["weak", "watch", "unknown", "healthy"].indexOf(a.grade) <=
    ["weak", "watch", "unknown", "healthy"].indexOf(b.grade)
      ? a
      : b,
  );

  return (
    <div className="flex flex-col gap-12">
      {/* ===== The domain, in a header and one line ==================== */}

      <div>
        <PageHeader
          back={{ href: "/admin/knowledge", label: "Knowledge Domains" }}
          title={domain.name}
          description={domain.purpose}
          action={<DomainStatusBadge status={domain.status} />}
        />
        {/* Orientation, not a dashboard. The instruments are further down and
            the operator does not need them before starting work. */}
        <p className="text-muted-foreground mt-4 max-w-2xl text-sm leading-relaxed">
          {health.scope.scopeable
            ? `${health.scope.held} in Atlas · ${health.scope.placed} placed in ${regionName}. Weakest reading: ${worst.label.toLowerCase()} — ${GRADE_LABEL[worst.grade].toLowerCase()}.`
            : `${domain.name} is cross-cutting — its entities sit inside every other domain's categories, so it has no numbers of its own.`}
        </p>
      </div>

      {/* Announced once, from browser memory of the operator's last visit —
          never from stored mission state. Derived progression means the page
          otherwise says nothing when a mission finishes between visits. */}
      <MissionTransition
        domainSlug={domain.slug}
        currentMissionId={mission?.id ?? null}
        currentMissionTitle={mission?.title ?? null}
        completedMissionIds={progress.missions
          .filter((m) => m.state === "complete")
          .map((m) => m.mission.id)}
        missionTitles={Object.fromEntries(
          progress.missions.map((m) => [m.mission.id, m.mission.title]),
        )}
        domainComplete={queue.complete}
      />

      {/* ===== The mission — Execute · Review · Complete =============== */}

      <section
        id="mission"
        aria-labelledby="mission-heading"
        className="border-border scroll-mt-8 border-t pt-8"
      >
        <h2 id="mission-heading" className="sr-only">
          Current mission
        </h2>

        {!mission ? (
          <p className="max-w-2xl text-sm leading-relaxed">
            {progress.completed === progress.total
              ? `Every mission in ${domain.name} is complete — all ${progress.total} of them, judged against what Atlas currently holds. Adding the next one is the work.`
              : `Every remaining mission in ${domain.name} is blocked. Nothing here can be started until one of the blockers below is cleared — which is a real answer, and better than promoting work that cannot begin.`}
          </p>
        ) : (
          <div className="flex flex-col gap-10">
            <MissionHeader
              mission={mission}
              operation={missionOperation}
              state={currentProgress!.state}
              surface={surface}
            />

            {/* --- 2 · Review ------------------------------------------ */}
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span
                  aria-hidden
                  className="text-muted-foreground font-mono text-[11px] tracking-widest tabular-nums"
                >
                  2
                </span>
                <h3 className="font-heading text-[15px] font-medium tracking-tight">
                  Review
                </h3>
                {work.totals.decisions > 0 && (
                  <span className="text-sm tabular-nums">
                    {work.totals.decisions}
                  </span>
                )}
                <span className="text-muted-foreground text-[12.5px]">
                  yes or no
                </span>
              </div>

              {work.state !== "scoped" ? (
                <p className="max-w-2xl text-sm leading-relaxed">
                  {work.state === "not-scopeable"
                    ? `${domain.name}'s work cannot be attributed to it — its entities sit inside every other domain's categories. These states are unanswerable here rather than empty.`
                    : `Atlas holds nothing in ${domain.name}'s categories yet, so there is nothing to review. Run the command above.`}
                </p>
              ) : (
                <div className="flex flex-col gap-8">
                  <div className="flex flex-col gap-3">
                    <ReviewQuestions decisions={work.decisions} />
                    <Truncated
                      shown={work.decisions.length}
                      total={work.totals.decisions}
                      noun="question"
                    />
                  </div>

                  <details className="group">
                    <summary className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex w-fit cursor-pointer list-none items-baseline gap-1.5 rounded text-[12px] transition-colors focus-visible:ring-2 focus-visible:outline-none">
                      <span
                        aria-hidden
                        className="transition-transform group-open:rotate-90"
                      >
                        ▸
                      </span>
                      What else the last run produced — {work.added.length}{" "}
                      added · {work.totals.evidenceGaps} waiting on evidence ·{" "}
                      {work.totals.failures} failed
                    </summary>

                    <div className="mt-4 flex flex-col gap-8">
                      <RunHeader
                        run={work.run}
                        unattributed={work.unattributedEvents}
                      />

                      <div className="flex flex-col gap-2">
                        <h4 className="text-muted-foreground text-[11.5px] font-medium tracking-widest uppercase">
                          Added automatically
                        </h4>
                        <AddedList added={work.added} />
                      </div>

                      <div className="flex flex-col gap-2">
                        <h4 className="text-muted-foreground text-[11.5px] font-medium tracking-widest uppercase">
                          Needs more evidence
                        </h4>
                        <EvidenceGaps gaps={work.evidenceGaps} />
                        {work.untargetedCandidates > 0 && (
                          <p className="text-muted-foreground max-w-2xl text-[12.5px] leading-relaxed">
                            A further {work.untargetedCandidates} discovered
                            page
                            {work.untargetedCandidates === 1 ? "" : "s"} name no
                            entity at all, so they belong to no domain — which
                            is why Atlas refuses to process them automatically.
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        <h4 className="text-muted-foreground text-[11.5px] font-medium tracking-widest uppercase">
                          Failed or refused
                        </h4>
                        <FailureList failures={work.failures} />
                      </div>

                      {work.partial && (
                        <p className="text-muted-foreground max-w-2xl text-[12.5px] leading-relaxed">
                          One of the reads behind these did not answer, so treat
                          every count as a floor rather than a total.
                        </p>
                      )}
                    </div>
                  </details>
                </div>
              )}
            </div>

            {/* --- 3 · Complete ---------------------------------------- */}
            {outcome && (
              <MissionComplete outcome={outcome} next={nextMission} />
            )}
          </div>
        )}
      </section>

      {/* ===== Complete, or what needs you ============================ */}

      {queue.complete ? (
        <DomainComplete
          domainName={domain.name}
          regionName={regionName}
          queue={queue}
          placed={health.scope.placed}
          known={health.scope.held}
          missionsComplete={progress.completed}
          missionsTotal={progress.total}
        />
      ) : (
        <DomainSection
          id="needs-you"
          title="What needs you"
          lede="Every kind of work Atlas currently knows about, grouped once. Each says why it is here, what is missing, and what to do about it."
        >
          <WorkQueue queue={queue} />
        </DomainSection>
      )}

      {/* ===== Every mission in this domain =========================== */}

      <DomainSection
        id="missions"
        title="Missions"
        lede={`${progress.completed} of ${progress.total} complete. Finite jobs inside a permanent responsibility — each finishes on conditions read from Atlas, never on a box somebody ticked, and the next one becomes current the moment it does.`}
      >
        <MissionRoster missions={progress.missions} />
      </DomainSection>

      {/* ===== What the domain knows ================================== */}

      {health.scope.scopeable && health.scope.categories.length > 0 && (
        <DomainSection
          id="knows"
          title={`What ${domain.name} knows`}
          lede="Counts, never percentages — Atlas has no denominator for how many of these exist. An empty category names the publisher that would fill it."
        >
          <div className="max-w-2xl">
            <KnowledgeTable
              categories={health.scope.categories}
              alsoHolds={health.scope.alsoHolds}
            />
          </div>
        </DomainSection>
      )}

      {health.passport && (
        <DomainSection
          id="passport"
          title="Ready for Passport"
          lede="Whether a traveller could be shown these places today — a different question from whether Atlas knows about them."
        >
          <PassportPanel readiness={health.passport} />
        </DomainSection>
      )}

      {/* ===== Reference ============================================= */}

      <section
        id="reference"
        aria-labelledby="reference-heading"
        className="border-border scroll-mt-8 border-t pt-6"
      >
        <h2
          id="reference-heading"
          className="font-heading text-xl font-medium tracking-tight"
        >
          Reference
        </h2>
        <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm leading-relaxed">
          Everything else that is true about this domain. Open what you need.
        </p>

        <div className="border-border mt-5 border-t">
          {/* Health describes how trustworthy this domain's knowledge is. That
              is a different question from whether today's work is finished,
              and it does not help finish it — so it sits here rather than
              above the work. Nothing was deleted. */}
          <ReferenceItem
            id="ref-health"
            title="Domain health"
            summary={`Weakest reading: ${worst.label.toLowerCase()} — ${GRADE_LABEL[worst.grade].toLowerCase()}`}
          >
            <div className="flex flex-col gap-4">
              <p className="text-muted-foreground max-w-2xl text-[13px] leading-relaxed">
                Three readings, all counted over {domain.name}&apos;s own
                entities. Open any one to see its rule.
              </p>
              <HealthPanel readings={health.readings} />
            </div>
          </ReferenceItem>

          {health.opportunity && (
            <ReferenceItem
              id="ref-opportunities"
              title="Biggest opportunities"
              summary={`${health.opportunity.count} entities rest on ${health.opportunity.sourceType} alone`}
            >
              <Opportunities opportunity={health.opportunity} />
            </ReferenceItem>
          )}

          <ReferenceItem
            id="ref-blockers"
            title="What is holding it back"
            summary={
              domain.blockers.length === 0
                ? "Nothing"
                : `${domain.blockers.length}, each with the work that clears it`
            }
          >
            <BlockerList blockers={domain.blockers} />
          </ReferenceItem>

          <ReferenceItem
            id="ref-operations"
            title="All operations"
            summary="Every command this domain can run"
          >
            <Runbook
              operations={domain.operations.filter(
                (o) => o.id !== mission?.operationId,
              )}
            />
          </ReferenceItem>

          <ReferenceItem
            id="ref-learning"
            title="What this domain is trying to learn"
            summary={`${domain.subjects.filter((s) => s.reachable).length} of ${domain.subjects.length} subjects reachable`}
          >
            <SubjectList subjects={domain.subjects} />
          </ReferenceItem>

          <ReferenceItem
            id="ref-publishers"
            title="Publishers"
            summary={
              domain.publishers.length === 0
                ? "None identified"
                : "What each one asks, and how each one fails"
            }
          >
            <PublisherLandscape domain={domain} />
          </ReferenceItem>

          <ReferenceItem
            id="ref-workflow"
            title="Pipeline"
            summary="The ten stages Atlas records against a run"
          >
            <WorkflowFlow stages={ACQUISITION_STAGES} />
          </ReferenceItem>

          <ReferenceItem
            id="ref-troubleshooting"
            title="Troubleshooting"
            summary="Five problems that have actually happened, and the wrong reading of each"
          >
            <TroubleshootingList entries={TROUBLESHOOTING} />
          </ReferenceItem>

          {/* Atlas-wide, and in Reference precisely so it cannot be misread as
              this domain's number. */}
          {health.backlog && health.backlog.total > 0 && (
            <ReferenceItem
              id="ref-backlog"
              title="Review backlog across all of Atlas"
              summary={`${health.backlog.total} waiting — not this domain's number`}
            >
              <div className="flex flex-col gap-5">
                <p className="max-w-2xl text-sm leading-relaxed">
                  Counted across every domain. Runs carry no domain tag, so this
                  cannot be scoped to {domain.name} — which is why it sits here
                  rather than in the mission. What <em>can</em> be scoped is in{" "}
                  <Link
                    href="#mission"
                    className="focus-visible:ring-ring rounded font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
                  >
                    Review
                  </Link>
                  .
                </p>
                <EvidenceQuality backlog={health.backlog} />
                <Link
                  href="/admin/runs"
                  className="focus-visible:ring-ring w-fit rounded text-sm font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
                >
                  Open Mission Control
                </Link>
              </div>
            </ReferenceItem>
          )}

          <ReferenceItem
            id="ref-questions"
            title="Open questions"
            summary={`${domain.openQuestions.length} unresolved`}
          >
            <ul className="marker:text-muted-foreground flex max-w-2xl list-disc flex-col gap-2 pl-4">
              {domain.openQuestions.map((question) => (
                <li key={question} className="text-sm leading-relaxed">
                  {question}
                </li>
              ))}
            </ul>
          </ReferenceItem>

          <ReferenceItem
            id="ref-history"
            title="History and what is not built"
            summary="Per-domain run history, coverage, browser execution"
          >
            <div className="flex flex-col gap-4">
              <p className="max-w-2xl text-sm leading-relaxed">
                Runs carry no domain tag, and{" "}
                <span className="font-mono text-[12.5px]">batch-ingest</span>{" "}
                bypasses{" "}
                <span className="font-mono text-[12.5px]">RunRecorder</span>{" "}
                entirely, so a batch leaves no entry. Until that changes, work
                is attributed to a domain by entity rather than by run, and a
                mission whose finish depends on a run says{" "}
                <em>cannot be verified</em> rather than pretending.
              </p>
              <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
                Coverage needs a denominator Atlas does not have. Running a
                command from this page needs decisions about who may start a
                run, what happens when two run at once, and how to stop one.
              </p>
              {domain.batchFiles.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {domain.batchFiles.map((file) => (
                    <li
                      key={file}
                      className="text-muted-foreground font-mono text-[12.5px] break-all"
                    >
                      {file}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </ReferenceItem>
        </div>
      </section>
    </div>
  );
}
