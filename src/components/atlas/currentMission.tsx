import type React from "react";
import type {
  KnowledgeDomain,
  Operation,
} from "@/lib/knowledge/knowledgeDomains";
import type { MissionProgress } from "@/lib/knowledge/missions";
import type { DomainWork } from "@/lib/knowledge/domainWork";
import type { WorkGroup } from "@/lib/knowledge/workQueue";
import {
  AddedList,
  FailureList,
  MissionComplete,
  MissionHeader,
  RunHeader,
} from "./domain";
import { EvidenceGaps, ReviewQuestions } from "./review";

/**
 * **The current mission, and everything it takes to finish it.**
 *
 * The one panel the sequence leaves open, and the only place on the page that
 * carries controls. It answers, in order and without the operator having to
 * assemble it from elsewhere: what is the objective, what remains, what
 * operation do I run, what decisions do I make, what needs more evidence, and
 * how will I know it is complete.
 *
 * Three numbered phases, because the operator does the same three things every
 * time: **Execute · Review · Complete**. Refresh sits inside Execute, where it
 * belongs — running a command in a terminal is an accepted shape for an
 * Operation, and the part that used to be missing was not automation but the
 * page saying *come back and press this*.
 */
export function CurrentMission({
  domain,
  progress,
  operation,
  surface,
  work,
  ownedWork,
  nextTitle,
}: {
  domain: KnowledgeDomain;
  progress: MissionProgress;
  operation?: Operation;
  /** The on-page working surface, when this mission declares one. */
  surface?: React.ReactNode;
  work: DomainWork;
  /**
   * Outstanding work this mission owns that nothing above already renders.
   *
   * The placement surface *is* the presentation of placement work, and the
   * Review phase *is* the presentation of decisions — restating either as a
   * summary card directly above the controls that handle it would be the same
   * count twice. What lands here is work the mission is responsible for and
   * has no control for yet, which is exactly the work that needs its next
   * operation spelled out.
   */
  ownedWork: readonly WorkGroup[];
  nextTitle?: string;
}) {
  const { mission, outcome, state } = progress;

  return (
    <div className="flex flex-col gap-10">
      <MissionHeader
        mission={mission}
        operation={operation}
        state={state}
        surface={surface}
      />

      {ownedWork.length > 0 && (
        <div className="flex flex-col gap-4">
          <PhaseTitle index="·" title="What remains" />
          <ul className="divide-border divide-y">
            {ownedWork.map((group) => (
              <li key={group.key} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6">
                  <span className="text-[15px] font-medium">{group.label}</span>
                  <span className="font-heading text-[19px] font-medium tabular-nums">
                    {group.count}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 max-w-2xl text-[13px] leading-relaxed">
                  {group.because}
                </p>
                {group.missing && (
                  <p className="text-muted-foreground mt-0.5 max-w-2xl text-[12.5px] leading-relaxed">
                    <span className="text-foreground/70">Missing: </span>
                    {group.missing}
                  </p>
                )}
                <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed font-medium">
                  Next operation: {group.nextAction}
                </p>
                {group.examples.length > 0 && (
                  <p className="text-muted-foreground mt-1 max-w-2xl text-[12.5px] leading-relaxed">
                    {group.examples.join("  ·  ")}
                    {group.count > group.examples.length &&
                      ` and ${group.count - group.examples.length} more`}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* --- 2 · Review ---------------------------------------------- */}
      <div className="flex flex-col gap-6">
        <PhaseTitle
          index="2"
          title="Review"
          count={work.totals.decisions > 0 ? work.totals.decisions : undefined}
          hint="yes or no"
        />

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
                What else the last run produced — {work.added.length} added ·{" "}
                {work.totals.evidenceGaps} waiting on evidence ·{" "}
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
                      A further {work.untargetedCandidates} discovered page
                      {work.untargetedCandidates === 1 ? "" : "s"} name no
                      entity at all, so they belong to no domain — which is why
                      Atlas refuses to process them automatically.
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
                    One of the reads behind these did not answer, so treat every
                    count as a floor rather than a total.
                  </p>
                )}
              </div>
            </details>
          </div>
        )}
      </div>

      {/* --- 3 · Complete -------------------------------------------- */}
      <MissionComplete outcome={outcome} nextTitle={nextTitle} />
    </div>
  );
}

function PhaseTitle({
  index,
  title,
  count,
  hint,
}: {
  index: string;
  title: string;
  count?: number;
  hint?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
      <span
        aria-hidden
        className="text-muted-foreground font-mono text-[11px] tracking-widest tabular-nums"
      >
        {index}
      </span>
      <h3 className="font-heading text-[15px] font-medium tracking-tight">
        {title}
      </h3>
      {count !== undefined && (
        <span className="text-sm tabular-nums">{count}</span>
      )}
      {hint && (
        <span className="text-muted-foreground text-[12.5px]">{hint}</span>
      )}
    </div>
  );
}

/** A cap that says so. A silent cap reads as "that is all of it". */
export function Truncated({
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
