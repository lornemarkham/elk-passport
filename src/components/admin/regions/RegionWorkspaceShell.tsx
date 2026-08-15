"use client";

import { useRef } from "react";
import { FilePlus2, Link2, Plus } from "lucide-react";
import type {
  OperationSpec,
  OperationId,
} from "@/lib/knowledge/operationCatalogue";
import { RegionNextAction } from "./RegionNextAction";
import { FixTypesWorkflow, type UntypedEntity } from "./FixTypesWorkflow";
import {
  ActivityWorkflow,
  DuplicatesWorkflow,
  ResearchWorkflow,
  WorkflowCard,
  WORKFLOW_ICONS,
  type WaitingFinding,
} from "./RegionWorkflows";

/**
 * **One client shell that owns which workflow is open.**
 *
 * ## Why this exists
 *
 * The next-action panel recommends an operation; the workflow that
 * resolves it is a drawer. Those were previously separate components, so
 * the recommendation could only *point at* a card rather than open it —
 * a curator read "Fix missing types", then had to find the card and click
 * it a second time.
 *
 * Hoisting `open` here lets one recommendation launch the exact workflow
 * it named. **A recommendation that cannot start the thing it recommends
 * is a signpost, not an action.**
 *
 * ## Still one owner per operation
 *
 * Each drawer is opened through a single `openId` value, so two controls
 * can point at the same workflow without either of them owning its
 * lifecycle. The drawers themselves are unchanged and still host the
 * existing components — `AdminDuplicatesView` unmodified, `decideResearch`
 * as the same server action `/admin/review` posts to.
 */
export function RegionWorkspaceShell({
  regionName,
  ranked,
  catalogue,
  untyped,
  knownTypes,
  waiting,
  decideResearch,
  activeRunId,
  lastRunId,
  lastRunLabel,
  runIsLive,
  growAnchorId,
}: {
  regionName: string;
  ranked: readonly OperationSpec[];
  catalogue: Record<OperationId, OperationSpec>;
  untyped: UntypedEntity[];
  knownTypes: Record<string, string[]>;
  waiting: WaitingFinding[];
  decideResearch: (formData: FormData) => Promise<void>;
  activeRunId: string | null;
  lastRunId: string | null;
  lastRunLabel: string;
  runIsLive: boolean;
  /** Where to scroll for Grow, which lives in the operation panel below. */
  growAnchorId: string;
}) {
  // Each drawer owns its own open state; this only remembers *how* to open
  // it, so a recommendation can launch the workflow it names.
  const openers = useRef<Partial<Record<OperationId, () => void>>>({});

  const open = (id: OperationId) => {
    if (id === "grow") {
      document
        .getElementById(growAnchorId)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    openers.current[id]?.();
  };

  /** Captures each drawer's own opener so the recommendation can call it. */
  const register = (id: OperationId) => (fn: () => void) => {
    openers.current[id] = fn;
    return null;
  };

  const unavailable = (
    ["review-relationships", "add-entity", "add-source"] as const
  ).map((id) => catalogue[id]);

  return (
    <>
      <RegionNextAction ranked={ranked} regionName={regionName} onOpen={open} />

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-[13px] font-semibold tracking-wide uppercase">
            Everything you can do here
          </h2>
          <p className="text-muted-foreground mt-1 max-w-2xl text-[13px]">
            Each of these opens in place — you stay in {regionName}. Anything
            Atlas cannot do yet says exactly what is missing.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <ResearchWorkflow
            waiting={waiting}
            decide={decideResearch}
            trigger={(openFn) => (
              <>
                {register("review-research")(openFn)}
                <WorkflowCard
                  onOpen={openFn}
                  label={catalogue["review-research"].label}
                  icon={WORKFLOW_ICONS.research}
                  badge={catalogue["review-research"].affected}
                  detail={catalogue["review-research"].why}
                />
              </>
            )}
          />

          <DuplicatesWorkflow
            trigger={(openFn) => (
              <>
                {register("review-duplicates")(openFn)}
                <WorkflowCard
                  onOpen={openFn}
                  label={catalogue["review-duplicates"].label}
                  icon={WORKFLOW_ICONS.duplicates}
                  badge={catalogue["review-duplicates"].affected}
                  detail={catalogue["review-duplicates"].why}
                />
              </>
            )}
          />

          <FixTypesWorkflow
            untyped={untyped}
            knownTypes={knownTypes}
            trigger={(openFn) => (
              <>
                {register("fix-types")(openFn)}
                <WorkflowCard
                  onOpen={openFn}
                  label={catalogue["fix-types"].label}
                  icon={WORKFLOW_ICONS.types}
                  badge={catalogue["fix-types"].affected}
                  detail={
                    catalogue["fix-types"].affected > 0
                      ? catalogue["fix-types"].why
                      : "Everything here has a type."
                  }
                />
              </>
            )}
          />

          <ActivityWorkflow
            runId={activeRunId ?? lastRunId}
            runLabel={lastRunLabel}
            live={runIsLive}
            trigger={(openFn) => (
              <>
                {register("activity")(openFn)}
                <WorkflowCard
                  onOpen={openFn}
                  label={
                    runIsLive ? "Watch Atlas working" : catalogue.activity.label
                  }
                  icon={WORKFLOW_ICONS.activity}
                  detail={catalogue.activity.does}
                />
              </>
            )}
          />

          {unavailable.map((op) => (
            <BlockedCard key={op.id} op={op} />
          ))}
        </div>
      </section>
    </>
  );
}

/**
 * An operation Atlas cannot perform yet.
 *
 * **Names the real blocker, not "soon".** A curator must be able to tell
 * *"Atlas will never do this"* from *"Atlas cannot do this yet, and here
 * is what is missing"* — the second is an invitation, the first is a dead
 * end. It also states what to do instead today, so the card is never a
 * conversation that ends.
 */
function BlockedCard({ op }: { op: OperationSpec }) {
  const icon =
    op.id === "add-entity" ? (
      <Plus className="h-4 w-4" />
    ) : op.id === "add-source" ? (
      <FilePlus2 className="h-4 w-4" />
    ) : (
      <Link2 className="h-4 w-4" />
    );

  return (
    <details className="border-border group rounded-lg border border-dashed px-4 py-3.5">
      <summary className="cursor-pointer list-none">
        <span className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-sm font-medium">{op.label}</span>
          {op.affected > 0 && (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 tabular-nums dark:text-amber-400">
              {op.affected}
            </span>
          )}
          <span className="text-muted-foreground/70 ml-auto rounded border border-dashed px-1.5 py-0.5 text-[10px] tracking-wide uppercase">
            why not yet
          </span>
        </span>
        <span className="text-muted-foreground mt-1.5 block text-[13px] leading-relaxed">
          {op.does}
        </span>
      </summary>

      <div className="border-border mt-3 border-t pt-3">
        <p className="text-muted-foreground text-[13px] leading-relaxed">
          <span className="text-foreground font-medium">
            Why it is not available:
          </span>{" "}
          {op.availability.blockedBecause}
        </p>
        {op.availability.insteadToday && (
          <p className="text-muted-foreground mt-2 text-[13px] leading-relaxed">
            <span className="text-foreground font-medium">Instead, today:</span>{" "}
            {op.availability.insteadToday}
          </p>
        )}
      </div>
    </details>
  );
}
