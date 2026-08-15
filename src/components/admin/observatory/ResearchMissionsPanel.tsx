import Link from "next/link";
import { ArrowRight, Loader2, Search } from "lucide-react";
import {
  awaitsReview,
  isOpen,
  statusLabel,
  type ResearchMission,
} from "@/lib/knowledge/researchMissions";

/**
 * Research Missions in Mission Control — *what a human asked for, and what
 * is owed back to them.*
 *
 * ## Why this panel is separate from the run timeline
 *
 * A mission **drives** a run, and the run already appears below with all
 * its stages. But a run answers *"what did the machine do"* while a mission
 * answers *"what did someone ask, and has it come back"* — and the second
 * question outlives the first. A mission sits in `awaiting-review`
 * indefinitely after its run has finished and gone quiet.
 *
 * ## Ordered by who is waiting on whom
 *
 * Findings needing a decision come first, because a mission in that state
 * is blocked on *this person*. Then work in flight, then everything
 * settled. This is the same instinct as the rest of Mission Control: the
 * page opens with what to do next, not with history.
 *
 * Renders nothing when no mission exists — an empty panel would imply the
 * feature is broken rather than unused.
 */
export function ResearchMissionsPanel({
  missions,
  entityNames,
}: {
  missions: readonly ResearchMission[];
  /** entityId → name, so a row reads "Accessibility — The BullWheel" rather than a uuid. */
  entityNames: ReadonlyMap<string, string>;
}) {
  if (missions.length === 0) return null;

  const ordered = [...missions].sort((a, b) => rank(a) - rank(b));
  const waiting = missions.filter(awaitsReview).length;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Search className="h-5 w-5" />
            Research missions
          </h3>
          <p className="text-muted-foreground mt-1 text-sm">
            What Atlas was asked to find out. Nothing is applied without your
            say-so.
          </p>
        </div>
        {waiting > 0 && (
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-500">
            {waiting} waiting on you
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {ordered.map((mission) => (
          <Link
            key={mission.id}
            href={`/admin/entities/${mission.entityId}`}
            className="border-border hover:border-foreground/30 hover:bg-muted/30 group flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border px-5 py-4 transition"
          >
            <div className="min-w-[220px] flex-1">
              <p className="flex items-center gap-2 text-sm font-medium">
                {isOpen(mission) && (
                  <Loader2 className="text-muted-foreground h-3.5 w-3.5 animate-spin" />
                )}
                <span className="capitalize">{mission.topic}</span>
                <span className="text-muted-foreground font-normal">
                  —{" "}
                  {entityNames.get(mission.entityId) ??
                    mission.entityId.slice(0, 8)}
                </span>
              </p>
              {mission.summary && (
                <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                  {mission.summary}
                </p>
              )}
            </div>

            <span
              className={
                awaitsReview(mission)
                  ? "text-xs font-medium text-emerald-700 dark:text-emerald-500"
                  : "text-muted-foreground text-xs"
              }
            >
              {statusLabel(mission.status)}
            </span>

            <ArrowRight className="text-muted-foreground group-hover:text-foreground h-4 w-4 shrink-0 transition" />
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Blocked on a human first, then in flight, then done. */
function rank(mission: ResearchMission): number {
  if (awaitsReview(mission)) return 0;
  if (isOpen(mission)) return 1;
  return 2;
}
