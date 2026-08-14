"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AdminNotConfiguredError,
  AtlasUnreachableError,
  getContentHealth,
  type CompletenessDimension,
  type CompletenessScoreResult,
  type ContentHealthResult,
} from "@/lib/data/admin-repo";
import { AdminSetupNotice } from "./AdminSetupNotice";
import { gapQuestionsForDimension } from "./contentGapQuestions";
import {
  scoreBadgeClasses,
  scoreTextColor,
} from "./knowledgeScorePresentation";

type LoadState =
  "loading" | "ready" | "error" | "unreachable" | "not-configured";

/**
 * How many gap questions a queue row shows, and in what order — Sprint
 * 2's "surface the gaps that most affect the usefulness of the entity,"
 * made concrete. Visual and Traveler Information are what a traveler
 * directly notices (no photo, no idea if there's parking or wheelchair
 * access); Identity strengthens *which* real thing this is; Sources and
 * Relationships are the most internal/administrative of the five and
 * come last. This is a real, stated ordering — not hidden inside a
 * generic "worst dimension first" sort that would happen to produce a
 * different, less useful order.
 */
const GAP_PRIORITY: readonly CompletenessDimension[] = [
  "visual",
  "travelerInfo",
  "identity",
  "sources",
  "relationships",
];
const MAX_GAPS_SHOWN = 3;

/**
 * Sprint 2 Refinement (§9) — a real, zero-extra-cost triage signal per row:
 * whether *any* real source has ever described this entity at all. Drawn
 * straight from the same `sources` dimension `ContentHealthResult` already
 * computed for the whole fleet in one call — no new fetch, no per-row AI
 * extraction. Deliberately conservative: this can only ever say "no source
 * exists yet" (true zero-cost fact) or "a source exists" — it never claims
 * "can improve now," because that would require checking whether that
 * source's evidence actually covers *this entity's specific* missing
 * fields, which only `GapImprovementService` (via the Knowledge Score
 * panel, one click away through "Inspect") can honestly answer. Promising
 * more here than this data actually supports would be exactly the "fake
 * prioritization" the refinement explicitly warned against.
 */
function sourceAvailability(
  score: CompletenessScoreResult,
): "no-source" | "source-available" | null {
  const hasGaps = score.dimensions.some(
    (d) => d.percent !== null && d.percent !== 100,
  );
  if (!hasGaps) return null;
  const sources = score.dimensions.find((d) => d.dimension === "sources");
  if (!sources || sources.present === 0) return "no-source";
  return "source-available";
}

/** The strongest, most traveler-relevant gap questions for one entity — capped, not a dump of every missing field (Sprint 2, §3). */
function topGapQuestions(score: CompletenessScoreResult): string[] {
  const seen = new Set<string>();
  const questions: string[] = [];
  for (const dimensionKey of GAP_PRIORITY) {
    const dimension = score.dimensions.find(
      (d) => d.dimension === dimensionKey,
    );
    if (!dimension) continue;
    for (const question of gapQuestionsForDimension(dimension)) {
      if (seen.has(question)) continue;
      seen.add(question);
      questions.push(question);
      if (questions.length >= MAX_GAPS_SHOWN) return questions;
    }
  }
  return questions;
}

/**
 * The Curator Queue — every entity Atlas knows about, ranked worst
 * Completeness Score first, each with the two or three real questions
 * that most affect whether it's actually useful to a traveler yet.
 * Deliberately lean: the full five-dimension breakdown lives one click
 * away, in Content Explorer's Knowledge Score panel (reached via the
 * deep link on each row) — this view's job is triage, not a second copy
 * of that detail. Not a to-do list Atlas invented: every question traces
 * back to a real field on the real entity.
 *
 * Prioritization (Sprint 2, §3): worst score first, full stop — no
 * invented ROI/impact model. `topGapQuestions` orders *which* gaps
 * surface within a row (traveler-visible gaps before administrative
 * ones), but does not change row order. A real impact-weighted ranking
 * (e.g., a low-scoring entity that's also frequently viewed matters more
 * than an equally low-scoring one nobody looks at) is a real future idea
 * — deferred, not attempted here, since Atlas doesn't track view counts
 * or any other real usage signal yet to base it on honestly.
 *
 * Honest about scale: at today's corpus size (a handful of real
 * entities) this list will be short. That's not a bug in the view — it's
 * an accurate reflection of how much has actually been ingested so far.
 */
export function CuratorQueueView() {
  const [health, setHealth] = useState<ContentHealthResult | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  // Sprint 2 Refinement — bumping this re-runs the fetch effect below,
  // both for the real observed cold-start case (an automatic single retry
  // after a couple of seconds) and for a curator-triggered "Try again."
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState((prev) => (prev === "ready" ? prev : "loading"));
      try {
        const result = await getContentHealth();
        if (cancelled) return;
        setHealth(result);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        if (err instanceof AdminNotConfiguredError) {
          setState("not-configured");
          return;
        }
        if (err instanceof AtlasUnreachableError) {
          console.warn(
            "Atlas not reachable yet (likely still starting up):",
            err.message,
          );
          setState("unreachable");
          return;
        }
        console.error("Failed to load the Curator Queue:", err);
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [retryNonce]);

  // A real, observed failure mode (Sprint 2 Refinement testing): on a cold
  // start, Atlas's own server can still be coming up when this app's first
  // request lands. One automatic retry a couple of seconds later resolves
  // that case without a curator needing to know to reload the page —
  // `AtlasUnreachableError` is specifically the case this is safe for,
  // since it's a real, distinct "not ready yet" signal, not a guess.
  useEffect(() => {
    if (state !== "unreachable") return;
    const timeout = window.setTimeout(() => setRetryNonce((n) => n + 1), 2500);
    return () => window.clearTimeout(timeout);
  }, [state]);

  if (state === "not-configured") {
    return <AdminSetupNotice />;
  }

  if (state === "loading") {
    return (
      <p className="text-muted-foreground text-sm">Scoring every entity…</p>
    );
  }

  if (state === "unreachable") {
    return (
      <div className="rounded-xl border border-dashed py-12 text-center">
        <p className="font-medium">Atlas isn&apos;t responding yet</p>
        <p className="text-muted-foreground mt-1 text-sm">
          This usually means Atlas&apos;s own server is still starting up.
          Retrying automatically…
        </p>
        <button
          type="button"
          onClick={() => setRetryNonce((n) => n + 1)}
          className="text-primary mt-3 text-sm underline underline-offset-2"
        >
          Try again now
        </button>
      </div>
    );
  }

  if (state === "error" || !health) {
    return (
      <div className="rounded-xl border border-dashed py-12 text-center">
        <p className="font-medium">Couldn&apos;t load the Curator Queue</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Something went wrong reaching Atlas.
        </p>
        <button
          type="button"
          onClick={() => setRetryNonce((n) => n + 1)}
          className="text-primary mt-3 text-sm underline underline-offset-2"
        >
          Try again
        </button>
      </div>
    );
  }

  const ranked = [...health.scores].sort(
    (a, b) => a.overallPercent - b.overallPercent,
  );

  if (ranked.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-12 text-center">
        <p className="font-medium">Nothing to score yet</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Atlas has no entities yet — the queue will fill in as ingestion runs.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        {ranked.length} {ranked.length === 1 ? "entity" : "entities"}, worst
        score first.
      </p>
      {ranked.map((score) => {
        const questions = topGapQuestions(score);
        const availability = sourceAvailability(score);
        return (
          <Card key={score.entityId}>
            <CardContent className="flex items-start justify-between gap-4 py-3.5">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{score.name}</p>
                  <Badge variant="secondary" className="text-[10px]">
                    {score.kind}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${scoreBadgeClasses(score.overallPercent)}`}
                  >
                    <span className={scoreTextColor(score.overallPercent)}>
                      Knowledge {score.overallPercent}%
                    </span>
                  </Badge>
                  {availability === "source-available" && (
                    <Badge
                      variant="outline"
                      className="border-primary/40 text-primary text-[10px]"
                    >
                      Source available
                    </Badge>
                  )}
                  {availability === "no-source" && (
                    <Badge
                      variant="outline"
                      className="text-muted-foreground text-[10px]"
                    >
                      No source available
                    </Badge>
                  )}
                </div>
                {questions.length > 0 ? (
                  <ul className="text-muted-foreground mt-1.5 flex flex-col gap-0.5 text-sm">
                    {questions.map((question) => (
                      <li key={question}>{question}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground mt-1.5 text-sm italic">
                    No significant gaps.
                  </p>
                )}
              </div>
              <Link
                href={`/admin/content/explorer?entityId=${score.entityId}`}
                className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 text-xs whitespace-nowrap"
              >
                {availability === "source-available"
                  ? "Review & improve"
                  : "Inspect"}
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
