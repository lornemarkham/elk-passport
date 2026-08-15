"use client";

import { FilePlus2, Link2, Plus, Tags } from "lucide-react";
import {
  ActivityWorkflow,
  DuplicatesWorkflow,
  ResearchWorkflow,
  WorkflowCard,
  WORKFLOW_ICONS,
  type WaitingFinding,
} from "./RegionWorkflows";

/**
 * **What *you* can do** — as distinct from what Atlas can do.
 *
 * ## Why the split matters
 *
 * The workspace has two kinds of verb and a curator needs to tell them
 * apart instantly. **Atlas's verbs are operations** — bounded, automatic,
 * reversible, watched. **The curator's verbs are decisions** — accepting a
 * finding, merging two entities, giving Atlas a source it could not have
 * guessed. Mixing them into one list of buttons hides the most important
 * fact about Atlas: it proposes, and a person decides.
 *
 * ## These open in place, they do not navigate
 *
 * Duplicate review, research review and activity all used to be links to
 * other admin pages. Each trip lost the context the curator was working
 * in, and made navigation the connective tissue of the job. They are now
 * drawers over the **same components and the same server action** those
 * pages use — see `RegionWorkflows.tsx`. The pages still exist and still
 * work; nothing was rebuilt.
 *
 * **Only the Entity page still earns a full navigation**, because working
 * on one entity genuinely is a change of subject (ADR 028).
 *
 * ## Unbuilt actions still appear
 *
 * Several are not built. They render disabled, each naming what exists
 * today and what is missing. A button that pretended would be a lie; no
 * button at all hides the shape of the product, and a curator cannot tell
 * *"Atlas will never do this"* from *"Atlas cannot do this yet."*
 * **Honesty about a gap is not the same as silence about it.**
 */
export function RegionActions({
  regionName,
  waitingCount,
  untypedCount,
  isolatedCount,
  duplicateGroups,
  waiting,
  decideResearch,
  activeRunId,
  lastRunId,
  lastRunLabel,
  runIsLive,
}: {
  regionName: string;
  waitingCount: number;
  untypedCount: number;
  isolatedCount: number;
  duplicateGroups: number | null;
  waiting: WaitingFinding[];
  decideResearch: (formData: FormData) => Promise<void>;
  activeRunId: string | null;
  lastRunId: string | null;
  lastRunLabel: string;
  runIsLive: boolean;
}) {
  const planned = [
    {
      label: "Fix types",
      detail: `${untypedCount} ${untypedCount === 1 ? "entity has" : "entities have"} no type. Atlas can research what a place is, one entity at a time, from that entity's page.`,
      icon: <Tags className="h-4 w-4" />,
      badge: untypedCount,
      soon: "Accepting a suggested type in bulk needs two things Atlas does not have: an edit surface for a single type, and bulk operations. Both are recorded in FUTURE-OPPORTUNITIES.",
    },
    {
      label: "Review relationships",
      detail: `Atlas proposes connections it finds while reading. ${isolatedCount > 0 ? `${isolatedCount} here connect to nothing.` : "Nothing here is unconnected."}`,
      icon: <Link2 className="h-4 w-4" />,
      badge: isolatedCount,
      soon: "`RelationshipCandidate` exists and Atlas writes proposals into it. A region-scoped surface for confirming them is not built.",
    },
    {
      label: "Add an entity",
      detail: `Place something in ${regionName} yourself, when Atlas has no way to discover it.`,
      icon: <Plus className="h-4 w-4" />,
      soon: `\`npm run define-region -- "${regionName}" --assign "<entity>"\` does this from a terminal today. Creating one from the browser needs an identity gate — an entity with only a name is a tag, not a thing.`,
    },
    {
      label: "Add a source",
      detail:
        "Give Atlas a page to read. It never guesses an organisation's website — a curator has to supply it.",
      icon: <FilePlus2 className="h-4 w-4" />,
      soon: "Atlas queues sources it discovers while reading. Seeding one by hand, then analysing it before committing, is a real workflow and is not built; `queue-benchmark` is the closest thing today.",
    },
  ];

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-[13px] font-semibold tracking-wide uppercase">
          What you can do
        </h2>
        <p className="text-muted-foreground mt-1 max-w-2xl text-[13px]">
          Decisions only a person can make. These open here — you stay in{" "}
          {regionName}.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <ResearchWorkflow
          waiting={waiting}
          decide={decideResearch}
          trigger={(open) => (
            <WorkflowCard
              onOpen={open}
              label="Review research"
              icon={WORKFLOW_ICONS.research}
              badge={waitingCount}
              detail={
                waitingCount > 0
                  ? "Atlas found things and stopped before writing them. Accept or reject each one."
                  : "Nothing is waiting on a decision right now."
              }
            />
          )}
        />

        <DuplicatesWorkflow
          trigger={(open) => (
            <WorkflowCard
              onOpen={open}
              label="Review duplicates"
              icon={WORKFLOW_ICONS.duplicates}
              badge={duplicateGroups ?? undefined}
              detail={
                duplicateGroups === null
                  ? "Entities that may be the same real thing. The scan could not be loaded."
                  : duplicateGroups > 0
                    ? "Entities Atlas thinks are the same real thing. Merging is not reversible — you decide."
                    : "Nothing looks duplicated right now."
              }
            />
          )}
        />

        <ActivityWorkflow
          runId={activeRunId ?? lastRunId}
          runLabel={lastRunLabel}
          live={runIsLive}
          trigger={(open) => (
            <WorkflowCard
              onOpen={open}
              label={runIsLive ? "Watch Atlas working" : "What Atlas did"}
              icon={WORKFLOW_ICONS.activity}
              detail="Every fetch, extraction and merge, in the order it happened."
            />
          )}
        />

        {planned.map((p) => (
          <div
            key={p.label}
            title={p.soon}
            aria-disabled="true"
            className="border-border flex flex-col rounded-lg border border-dashed px-4 py-3.5 opacity-70"
          >
            <span className="flex items-center gap-2">
              <span className="text-muted-foreground">{p.icon}</span>
              <span className="text-sm font-medium">{p.label}</span>
              {p.badge !== undefined && p.badge > 0 && (
                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 tabular-nums dark:text-amber-400">
                  {p.badge}
                </span>
              )}
              <span className="text-muted-foreground/70 ml-auto rounded border border-dashed px-1.5 py-0.5 text-[10px] tracking-wide uppercase">
                soon
              </span>
            </span>
            <span className="text-muted-foreground mt-1.5 block text-[13px] leading-relaxed">
              {p.detail}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
