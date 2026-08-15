import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Check, X } from "lucide-react";
import {
  loadResearchMissions,
  awaitsReview,
  isOpen,
} from "@/lib/knowledge/researchMissions";
import {
  loadWorkspaceBundle,
  type WorkspaceBundle,
} from "@/lib/knowledge/workspaceData";
import { loadRegions, regionForEntity } from "@/lib/knowledge/regions";
import { decideResearch } from "@/app/admin/entities/[id]/actions";

export const metadata: Metadata = { title: "Review — Atlas" };

/**
 * **Research findings waiting on a human.**
 *
 * ## The one question this page answers
 *
 * *"What decisions is Atlas waiting on from me?"*
 *
 * ## Why this is its own page rather than part of headquarters
 *
 * Findings cross regions. A curator working the Okanagan and a curator
 * working Vancouver are both blocked here, and neither region owns the
 * queue — so it is a global operation like Runs and Duplicates.
 *
 * It briefly lived on the admin home. That was wrong for a different
 * reason: headquarters has to make the **hierarchy** obvious first, and a
 * page whose top half is a review queue teaches an operator that Atlas is a
 * list of findings rather than a set of destinations.
 *
 * ## Decidable in place
 *
 * Accept or decline without navigating to the entity. That removes the
 * three-page round trip research used to require — request on the entity,
 * run in a terminal, watch in Runs, return to the entity to review.
 *
 * The entity stays one click away for anyone who wants full context before
 * deciding, which is the right default for a page whose job is triage.
 *
 * ## Findings are shown, never folded into what Atlas knows
 *
 * Every row here is explicitly *not yet applied*. A review step where a
 * proposal looks identical to an accepted fact is not a review step — the
 * reviewer would be approving something whose edges they cannot see.
 */
export default async function ReviewPage() {
  const [missions, bundle, regionsResult] = await Promise.all([
    loadResearchMissions(),
    loadWorkspaceBundle().catch((): WorkspaceBundle | null => null),
    loadRegions(),
  ]);

  const entities = (bundle?.entities ?? []) as unknown as Record<
    string,
    unknown
  >[];
  const names = new Map(entities.map((e) => [String(e.id), String(e.name)]));

  const waiting = missions.filter(awaitsReview);
  const running = missions.filter(isOpen);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/admin"
          className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Atlas
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Review</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          Atlas researched these and applied nothing. Decide here, or open the
          entity for full context.
        </p>
      </div>

      {waiting.length === 0 ? (
        <div className="border-border rounded-xl border border-dashed p-8">
          <p className="font-medium">Nothing is waiting on you.</p>
          <p className="text-muted-foreground mt-2 text-sm">
            {running.length > 0
              ? `${running.length} mission${running.length === 1 ? " has" : "s have"} been requested and not yet answered. Run `
              : "Research is requested from an entity's knowledge gaps. Answer requests with "}
            <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
              npm run run-missions
            </code>
            .
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {waiting.map((mission) => {
            const facts = mission.findings?.keyFacts ?? [];
            const media = mission.findings?.media ?? [];
            const region = regionForEntity(regionsResult, mission.entityId);

            return (
              <div
                key={mission.id}
                className="border-border rounded-xl border p-5"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="text-sm font-medium capitalize">
                    {mission.topic}
                  </p>
                  <Link
                    href={`/admin/entities/${mission.entityId}`}
                    className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
                  >
                    {names.get(mission.entityId) ??
                      mission.entityId.slice(0, 8)}
                  </Link>
                  {region && (
                    <Link
                      href={`/admin/regions/${region.id}`}
                      className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
                    >
                      · {region.name}
                    </Link>
                  )}
                  <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                    {facts.length} fact{facts.length === 1 ? "" : "s"} ·{" "}
                    {media.length} media
                  </span>
                </div>

                {mission.summary && (
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {mission.summary}
                  </p>
                )}

                {facts.length > 0 && (
                  <dl className="mt-3 flex flex-col gap-1.5">
                    {facts.slice(0, 4).map((fact) => (
                      <div
                        key={`${fact.label}-${fact.value}`}
                        className="flex gap-3 text-sm"
                      >
                        <dt className="text-muted-foreground min-w-[130px] shrink-0">
                          {fact.label}
                        </dt>
                        <dd className="leading-relaxed">{fact.value}</dd>
                      </div>
                    ))}
                    {facts.length > 4 && (
                      <Link
                        href={`/admin/entities/${mission.entityId}`}
                        className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
                      >
                        + {facts.length - 4} more on the entity page
                      </Link>
                    )}
                  </dl>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <form action={decideResearch}>
                    <input type="hidden" name="missionId" value={mission.id} />
                    <input
                      type="hidden"
                      name="entityId"
                      value={mission.entityId}
                    />
                    <input type="hidden" name="decision" value="accept" />
                    <button className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-emerald-700">
                      <Check className="h-3.5 w-3.5" />
                      Accept
                    </button>
                  </form>
                  <form action={decideResearch}>
                    <input type="hidden" name="missionId" value={mission.id} />
                    <input
                      type="hidden"
                      name="entityId"
                      value={mission.entityId}
                    />
                    <input type="hidden" name="decision" value="reject" />
                    <button className="border-border hover:bg-muted inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-medium transition">
                      <X className="h-3.5 w-3.5" />
                      Decline
                    </button>
                  </form>
                  <span className="text-muted-foreground text-[11px]">
                    Accepting merges into the entity. Anything Atlas already
                    holds is kept.
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
