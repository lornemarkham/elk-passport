import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Progress,
  ProgressTrack,
  ProgressIndicator,
} from "@/components/ui/progress";
import type { ContentHealthResult } from "@/lib/data/admin-repo";
import { scoreBarColor, scoreTextColor } from "./knowledgeScorePresentation";

/**
 * Sprint 2 Refinement (§10) — "every health metric should lead into
 * work," not stop at a percentage. The Curator Queue is the one real,
 * already-built destination for "go work on entities with gaps" — it
 * already ranks worst-score-first and already orders Visual gaps ahead of
 * administrative ones (see `CuratorQueueView`'s own `GAP_PRIORITY`), so
 * routing every "Review →" here rather than inventing a new
 * per-dimension filtered view is reuse, not a shortcut: that filtered
 * view doesn't exist yet, and this sprint's own discipline is not
 * building speculative surfaces a real workflow hasn't asked for.
 */
const QUEUE_HREF = "/admin/entities";

function ReviewLink() {
  return (
    <Link
      href={QUEUE_HREF}
      className="text-primary inline-flex shrink-0 items-center gap-0.5 text-xs whitespace-nowrap hover:underline"
    >
      Review
      <ArrowUpRight className="h-3 w-3" />
    </Link>
  );
}

/**
 * Sprint 2, §2 — "Atlas Knowledge Health": the fleet-wide counterpart to
 * one entity's `KnowledgeScorePanel`, same real dimensions
 * (`CompletenessScore.ts`'s actual five — Identity, Visual, Sources,
 * Relationships, Traveler Information), not a reinvented set. The
 * brief's own example list ("Visual, Location/Coordinates, Sources,
 * Relationships, Traveler Readiness") doesn't map one-to-one onto the
 * real scoring model — coordinates aren't a `CompletenessScore`
 * dimension at all (`geometry` is required at entity creation, so it's
 * never scored as missing; "no real coordinates yet" is `Place`'s own
 * placeholder-geometry convention, a `ContentHealthService`-level count,
 * not a percentage this rubric produces). Rather than force a fake
 * dimension into existence to match the brief's wording, Missing
 * Coordinates is shown here as what it honestly is: a real count, next
 * to the real dimension percentages, not blended into them.
 *
 * `applicableCount` is shown next to every dimension for the same reason
 * `KnowledgeHealthSummary`'s own doc comment gives: 91% from one entity
 * and 91% from ten entities are not the same claim, and this view never
 * lets the number alone pretend otherwise.
 */
export function KnowledgeHealthPanel({
  contentHealth,
}: {
  contentHealth: ContentHealthResult;
}) {
  const { knowledgeHealth } = contentHealth;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Atlas Knowledge Health</p>
          <p className="text-muted-foreground text-xs">
            {knowledgeHealth.totalEntities}{" "}
            {knowledgeHealth.totalEntities === 1 ? "entity" : "entities"} scored
          </p>
        </div>

        <div className="flex items-center gap-3">
          <p
            className={`text-3xl font-semibold ${scoreTextColor(knowledgeHealth.overallPercent)}`}
          >
            {knowledgeHealth.overallPercent === null
              ? "—"
              : `${knowledgeHealth.overallPercent}%`}
          </p>
          <p className="text-muted-foreground text-sm">Overall</p>
        </div>

        <div className="flex flex-col gap-2.5">
          {knowledgeHealth.dimensions.map((dimension) => (
            <div key={dimension.dimension} className="flex items-center gap-3">
              <p className="w-36 shrink-0 text-sm">{dimension.label}</p>
              {dimension.averagePercent === null ? (
                <p className="text-muted-foreground text-xs italic">
                  Not applicable yet
                </p>
              ) : (
                <>
                  <Progress
                    value={dimension.averagePercent}
                    className="flex-1 gap-0"
                  >
                    <ProgressTrack>
                      <ProgressIndicator
                        className={scoreBarColor(dimension.averagePercent)}
                      />
                    </ProgressTrack>
                  </Progress>
                  <p
                    className={`w-12 shrink-0 text-right text-sm font-medium ${scoreTextColor(dimension.averagePercent)}`}
                  >
                    {dimension.averagePercent}%
                  </p>
                  <p className="text-muted-foreground w-16 shrink-0 text-right text-[11px]">
                    of {dimension.applicableCount}
                  </p>
                  {/* Only a real gap gets a "go work on it" link — a
                      dimension already at 100% has nothing to review. */}
                  {dimension.averagePercent < 100 ? (
                    <ReviewLink />
                  ) : (
                    <div className="w-14 shrink-0" />
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        <div className="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t pt-3 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <span className="text-foreground font-medium">
              {contentHealth.missingImages.count}
            </span>{" "}
            missing images
            {contentHealth.missingImages.count > 0 && <ReviewLink />}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-foreground font-medium">
              {contentHealth.missingCoordinates.count}
            </span>{" "}
            missing coordinates
            {contentHealth.missingCoordinates.count > 0 && <ReviewLink />}
          </span>
          {/* No link — image duplicates are a real, detected condition
              (`ImageDuplicateFinder`), but there's no built review workflow
              for them yet (see docs/content-model/future.md); an honest
              count without a false "Review" destination is better than a
              link to nowhere. */}
          <span>
            <span className="text-foreground font-medium">
              {contentHealth.imageDuplicates.length}
            </span>{" "}
            shared images
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
