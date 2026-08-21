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
import {
  unplacedEntities,
  type MissionProgress,
} from "@/lib/knowledge/missions";
import {
  buildWorkQueue,
  groupsOwnedBy,
  unassignedGroups,
  type DomainWorkQueue,
  type WorkGroupKey,
} from "@/lib/knowledge/workQueue";
import { DomainComplete, WorkQueue } from "@/components/atlas/workQueue";
import {
  MissionTransition,
  RefreshStatus,
} from "@/components/atlas/missionTransition";
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
  BlockerList,
  DomainSection,
  DomainStatusBadge,
  PublisherLandscape,
  ReferenceItem,
  Runbook,
  SubjectList,
  TroubleshootingList,
  WorkflowFlow,
} from "@/components/atlas/domain";
import {
  BlockedMission,
  CompletedMission,
  MissionSequence,
  QueuedMission,
  type SequenceItem,
} from "@/components/atlas/missionSequence";
import { CurrentMission } from "@/components/atlas/currentMission";
import { LearningList } from "@/components/atlas/learning";

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

/**
 * **The one line under a current mission's title when it is closed.**
 *
 * Its own units, never a total across kinds: *12 needs placement · 5 needs
 * evidence before placement* is actionable, and adding them to "17" is a
 * number that looks precise and means nothing. Falls back to the conditions
 * left, which is what a mission with no countable work has.
 */
function currentStatus(
  queue: DomainWorkQueue,
  item: MissionProgress,
): string | undefined {
  const owned = groupsOwnedBy(queue, item.mission);
  if (owned.length > 0) {
    return owned
      .map(
        (group) =>
          `${group.count} ${group.count === 1 ? (group.unitOne ?? group.unit) : group.unit}`,
      )
      .join("  ·  ");
  }
  if (item.outcome.complete) return undefined;
  if (item.outcome.awaitingYou) return "Only your confirmation is left";
  return `${item.outcome.remaining} condition${item.outcome.remaining === 1 ? "" : "s"} left`;
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
    // Reading the discovered pages is done at the terminal, but the *work* is
    // shown here grouped by entity — one item per thing being taught, however
    // many pages name it.
    if (mission?.surface === "learn-from-sources") {
      return (
        <LearningList
          opportunities={work.learning}
          unattributed={work.unattributedSources}
        />
      );
    }
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

  /**
   * **The sequence, assembled once.**
   *
   * `evaluateDomain` decided which mission is current; this only chooses what
   * each panel shows. Completed missions get evidence and no controls, the
   * current mission gets the whole working surface, queued missions get their
   * objective and the conditions they will be graded on, and a blocked mission
   * says what stops it.
   *
   * Work that a mission owns is rendered inside that mission. The placement
   * surface and the Review phase already *are* the presentation of placement
   * work and of decisions, so those keys are filtered out before the summary
   * cards — otherwise the same count would appear twice, once as a card and
   * once as the control directly beneath it.
   */
  const coveredByControls = new Set<WorkGroupKey>([
    "decision",
    ...(mission?.surface === "place-in-region"
      ? (["placement", "placement-evidence"] as const)
      : []),
    ...(mission?.surface === "learn-from-sources"
      ? (["learning"] as const)
      : []),
  ]);

  const sequence: SequenceItem[] = progress.missions.map((item, index) => {
    if (item.state === "current") {
      const owned = groupsOwnedBy(queue, item.mission).filter(
        (group) => !coveredByControls.has(group.key),
      );
      return {
        progress: item,
        status: currentStatus(queue, item),
        body: (
          <CurrentMission
            domain={domain}
            progress={item}
            operation={missionOperation}
            surface={surface}
            work={work}
            ownedWork={owned}
            nextTitle={nextMission?.title}
            commandLeads={item.mission.surface === "learn-from-sources"}
          />
        ),
      };
    }
    if (item.state === "complete") {
      return { progress: item, body: <CompletedMission progress={item} /> };
    }
    if (item.state === "blocked") {
      return {
        progress: item,
        body: (
          <BlockedMission
            progress={item}
            operationBuilt={Boolean(
              item.mission.operationId &&
              domain.operations.some((o) => o.id === item.mission.operationId),
            )}
          />
        ),
      };
    }
    return {
      progress: item,
      body: (
        <QueuedMission
          progress={item}
          waitingOn={
            // The nearest unfinished mission above this one — what the
            // operator is actually waiting on, rather than "the current
            // mission" which may be several steps back.
            progress.missions
              .slice(0, index)
              .reverse()
              .find((m) => m.state === "current" || m.state === "queued")
              ?.mission.title
          }
        />
      ),
    };
  });

  // Groups no mission claims. Kept, and kept secondary.
  const domainWideWork = unassignedGroups(
    queue,
    progress.missions.map((m) => m.mission),
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
        {/* Orientation, not a dashboard. The instruments are in Reference and
            the operator does not need them before starting work. */}
        <p className="text-muted-foreground mt-4 max-w-2xl text-sm leading-relaxed">
          {health.scope.scopeable
            ? `${health.scope.held} in Atlas · ${health.scope.placed} placed in ${regionName}. ${progress.completed} of ${progress.total} missions complete.`
            : `${domain.name} is cross-cutting — its entities sit inside every other domain's categories, so it has no numbers of its own.`}
        </p>
        <div className="mt-4">
          <RefreshStatus />
        </div>
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

      {/* ===== Done, when there is nothing actionable left ============= */}

      {queue.complete && (
        <DomainComplete
          domainName={domain.name}
          regionName={regionName}
          placed={health.scope.placed}
          known={health.scope.held}
          missionsComplete={progress.completed}
          missionsTotal={progress.total}
          blocked={progress.missions
            .filter((m) => m.state === "blocked")
            .map((m) => ({
              title: m.mission.title,
              blockedBy: m.mission.blockedBy ?? "",
            }))}
        />
      )}

      {/* ===== The sequence — worked top to bottom ===================== */}

      <section
        id="mission"
        aria-labelledby="missions-heading"
        className="border-border scroll-mt-8 border-t pt-8"
      >
        <h2
          id="missions-heading"
          className="font-heading text-xl font-medium tracking-tight"
        >
          Missions
        </h2>
        <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm leading-relaxed">
          Worked in order, top to bottom. The open one is the current mission —
          chosen by Atlas as the first that is neither finished nor blocked, and
          re-chosen on every refresh. Nothing here is marked done by hand.
        </p>

        <div className="mt-6">
          <MissionSequence items={sequence} />
        </div>

        {!mission && progress.completed !== progress.total && (
          <p className="mt-6 max-w-2xl text-sm leading-relaxed">
            Every remaining mission in {domain.name} is blocked. Nothing here
            can be started until one of those blockers is cleared — which is a
            real answer, and better than promoting work that cannot begin.
          </p>
        )}
      </section>

      {/* ===== Work that belongs to no mission ========================= */}

      {domainWideWork.length > 0 && (
        <DomainSection
          id="needs-you"
          title="Not tied to a mission"
          lede="Real work Atlas can see, that no mission's finish depends on. A failed fetch belongs to a run and a queued page belongs to a source — inventing a mission to house them would assert a relationship Atlas cannot see."
        >
          <WorkQueue queue={{ ...queue, outstanding: domainWideWork }} />
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
          {health.scope.scopeable && health.scope.categories.length > 0 && (
            <ReferenceItem
              id="ref-knows"
              title={`What ${domain.name} knows`}
              summary={`${health.scope.categories.filter((c) => c.held > 0).length} of ${health.scope.categories.length} categories have something in them`}
            >
              <div className="flex flex-col gap-4">
                <p className="text-muted-foreground max-w-2xl text-[13px] leading-relaxed">
                  Counts, never percentages — Atlas has no denominator for how
                  many of these exist. An empty category names the publisher
                  that would fill it.
                </p>
                <div className="max-w-2xl">
                  <KnowledgeTable
                    categories={health.scope.categories}
                    alsoHolds={health.scope.alsoHolds}
                  />
                </div>
              </div>
            </ReferenceItem>
          )}

          {/* Passport readiness is a different question from whether a mission
              is finished, and mixing them would hold up a Region because a park
              has no photograph. It is a done-condition for exactly one mission
              — "Make every provincial park presentable" — and that mission
              reads it directly. Here it is reference. */}
          {health.passport && (
            <ReferenceItem
              id="ref-passport"
              title="Ready for Passport"
              summary={`${health.passport.needsEnrichment} need enrichment before a traveller could be shown them`}
            >
              <div className="flex flex-col gap-4">
                <p className="text-muted-foreground max-w-2xl text-[13px] leading-relaxed">
                  Whether a traveller could be shown these places today — a
                  different question from whether Atlas knows about them, and
                  deliberately not a gate on any earlier mission.
                </p>
                <PassportPanel readiness={health.passport} />
              </div>
            </ReferenceItem>
          )}

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
