"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Progress,
  ProgressTrack,
  ProgressIndicator,
} from "@/components/ui/progress";
import type { CompletenessScoreResult } from "@/lib/data/admin-repo";
import {
  applyEnrichment,
  getGapImprovements,
  type GapImprovement,
  type GapImprovementsResult,
} from "@/lib/data/explorer-repo";
import {
  gapQuestionForField,
  gapQuestionsForDimension,
} from "./contentGapQuestions";
import { fieldLabel, formatFieldValue } from "./entityFieldFormat";
import { sourceTypeLabel } from "./enrichmentPresentation";
import {
  SCORE_TIER_LEGEND,
  scoreBarColor,
  scoreTextColor,
  scoreTierLabel,
} from "./knowledgeScorePresentation";

type GapState = "idle" | "loading" | "ready" | "error";

/**
 * Sprint 2 — the fix for Sprint 1's biggest UX gap: the Completeness
 * Score existed but a curator had no way to actually find it. Placed at
 * the top of the entity detail panel in Content Explorer, before the raw
 * Fields list, so "how good is this entity's knowledge" is the first
 * real answer a curator gets, not something inferred from scrolling a
 * field grid.
 *
 * Progressive disclosure, on purpose: the number and its tier are always
 * visible; the five-dimension breakdown and the specific gap questions
 * are one click away, collapsed by default, so the panel stays calm for
 * a curator who just wants the headline. `82% → why 82%? → what's
 * missing? → what should I do?` is the whole panel, read top to bottom
 * once expanded.
 *
 * Sprint 2 Refinement — the fix for the refinement's own named "primary
 * problem": seeing a gap was never the hard part; getting from "missing"
 * to "improved" was. The first time a curator expands the breakdown, this
 * fetches `GapImprovementService`'s real, source-backed answer for every
 * missing field (see `getGapImprovements` in explorer-repo.ts) and renders
 * an "Apply →" action beside any gap that already has real evidence behind
 * it — never a guess, and honest ("Source available. No structured
 * candidate extracted yet.") when Atlas genuinely doesn't have one yet.
 * Applying refetches both the gap data and (via `onApplied`) the parent's
 * fleet-wide scores, so the percentage on screen updates immediately —
 * no restart, no manual refresh.
 */
export function KnowledgeScorePanel({
  score,
  entityId,
  onApplied,
}: {
  score: CompletenessScoreResult;
  entityId: string;
  /** Called after a successful apply so the caller (Content Explorer) can reload its own entity list and fleet-wide scores — the same contract `EnrichmentPanel.onApplied` already uses. */
  onApplied: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [gapState, setGapState] = useState<GapState>("idle");
  const [gapResult, setGapResult] = useState<GapImprovementsResult | null>(
    null,
  );
  const [gapError, setGapError] = useState<string | null>(null);
  const [applyingField, setApplyingField] = useState<string | null>(null);

  const gapQuestions = score.dimensions.flatMap((dimension) =>
    gapQuestionsForDimension(dimension),
  );
  const uniqueGapQuestions = [...new Set(gapQuestions)];

  // Field names covered by per-field dimensions (identity/visual/travelerInfo)
  // — the ones `GapImprovementService` can say something concrete about.
  // Sources/Relationships aren't field-based, so their fallback question
  // always stays plain text even once gap data has loaded.
  const fieldGapDimensions = new Set(
    score.dimensions
      .filter((d) => d.missingFields.length > 0)
      .map((d) => d.dimension),
  );
  const nonFieldFallbackQuestions = score.dimensions
    .filter(
      (d) =>
        d.percent !== null && d.percent !== 100 && d.missingFields.length === 0,
    )
    .flatMap((d) => gapQuestionsForDimension(d));

  async function loadGapImprovements() {
    setGapState("loading");
    setGapError(null);
    try {
      const result = await getGapImprovements(entityId);
      setGapResult(result);
      setGapState("ready");
    } catch (err) {
      console.error(`Failed to load gap improvements for ${entityId}:`, err);
      setGapError(
        err instanceof Error ? err.message : "Failed to load improvement data.",
      );
      setGapState("error");
    }
  }

  // Fetch lazily, only the first time a curator actually opens the
  // breakdown — same "don't pay for an AI-backed call nobody asked to see
  // yet" discipline as EnrichmentPanel's "Check other sources" button, just
  // triggered by expanding rather than a second click, since seeing what's
  // improvable is the whole point of opening this panel. The parent keys
  // this component by entity id (see ContentExplorerView), so switching
  // entities remounts it and resets this effect's own `idle` starting
  // point — no separate reset-on-prop-change effect needed.
  useEffect(() => {
    if (!expanded || gapState !== "idle") return;
    let cancelled = false;
    (async () => {
      setGapState("loading");
      setGapError(null);
      try {
        const result = await getGapImprovements(entityId);
        if (cancelled) return;
        setGapResult(result);
        setGapState("ready");
      } catch (err) {
        if (cancelled) return;
        console.error(`Failed to load gap improvements for ${entityId}:`, err);
        setGapError(
          err instanceof Error
            ? err.message
            : "Failed to load improvement data.",
        );
        setGapState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [expanded, gapState, entityId]);

  async function apply(improvement: GapImprovement) {
    if (
      improvement.status !== "candidate-available" ||
      !improvement.sourceRecordId
    )
      return;
    setApplyingField(improvement.field);
    try {
      await applyEnrichment(
        entityId,
        {
          [improvement.field]: {
            value: improvement.proposedValue,
            sourceRecordId: improvement.sourceRecordId,
          },
        },
        `Applied from Knowledge Score gap improvement (${improvement.dimension}).`,
      );
      const impact = improvement.scoreImpact;
      toast.success(
        impact
          ? `Applied ${fieldLabel(improvement.field)} — score ${impact.currentOverallPercent}% → ${impact.projectedOverallPercent}%.`
          : `Applied ${fieldLabel(improvement.field)}.`,
      );
      await loadGapImprovements();
      onApplied();
    } catch (err) {
      console.error(`Failed to apply gap improvement for ${entityId}:`, err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to apply this improvement.",
      );
    } finally {
      setApplyingField(null);
    }
  }

  // Actionable first, honest-but-not-yet-actionable after — the same
  // "obvious yes reviews first" ordering EnrichmentPanel already uses for
  // gap-fills vs replacements.
  const sortedImprovements = gapResult
    ? [...gapResult.improvements].sort((a, b) => {
        const rank = (i: GapImprovement) =>
          i.status === "candidate-available"
            ? 0
            : i.status === "source-no-candidate"
              ? 1
              : 2;
        return rank(a) - rank(b);
      })
    : [];

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2.5">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Knowledge Score
          </p>
          <p
            className={`text-2xl font-semibold ${scoreTextColor(score.overallPercent)}`}
          >
            {score.overallPercent}%
          </p>
          <span
            className={`text-xs font-medium ${scoreTextColor(score.overallPercent)}`}
            title={SCORE_TIER_LEGEND}
          >
            {scoreTierLabel(score.overallPercent)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          {expanded ? "Hide breakdown" : "Why this score?"}
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 flex flex-col gap-3 border-t pt-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {score.dimensions.map((dimension) => (
              <div key={dimension.dimension} className="flex flex-col gap-1">
                <p className="text-muted-foreground text-xs">
                  {dimension.label}
                </p>
                {dimension.percent === null ? (
                  <p className="text-muted-foreground text-xs italic">N/A</p>
                ) : (
                  <>
                    <Progress value={dimension.percent} className="gap-1">
                      <ProgressTrack>
                        <ProgressIndicator
                          className={scoreBarColor(dimension.percent)}
                        />
                      </ProgressTrack>
                    </Progress>
                    <p className="text-muted-foreground text-[11px]">
                      {dimension.present}/{dimension.total}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>

          {uniqueGapQuestions.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  What&apos;s missing
                </p>
                {gapState === "loading" && (
                  <p className="text-muted-foreground text-[11px]">
                    Checking sources…
                  </p>
                )}
                {gapState === "error" && (
                  <button
                    type="button"
                    onClick={() => void loadGapImprovements()}
                    className="text-primary text-[11px] hover:underline"
                  >
                    Retry
                  </button>
                )}
              </div>

              {gapState === "error" && gapError && (
                <p className="text-muted-foreground mb-2 text-xs">{gapError}</p>
              )}

              <ul className="flex flex-col gap-2">
                {/* Field-based gaps: rich, actionable cards once gap data has
                    loaded; the same plain question as a graceful fallback
                    before it has (or if it failed to load). */}
                {gapState === "ready"
                  ? sortedImprovements.map((improvement) => (
                      <GapImprovementRow
                        key={improvement.field}
                        improvement={improvement}
                        applying={applyingField === improvement.field}
                        onApply={() => void apply(improvement)}
                      />
                    ))
                  : score.dimensions
                      .filter((d) => fieldGapDimensions.has(d.dimension))
                      .flatMap((d) =>
                        d.missingFields.map((field) => ({
                          field,
                          dimension: d.dimension,
                        })),
                      )
                      .map(({ field, dimension }) => (
                        <li key={field} className="text-sm">
                          {gapQuestionForField(field, dimension)}
                        </li>
                      ))}

                {/* Sources/Relationships — never field-based, always plain text. */}
                {nonFieldFallbackQuestions.map((question) => (
                  <li key={question} className="text-sm">
                    {question}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GapImprovementRow({
  improvement,
  applying,
  onApply,
}: {
  improvement: GapImprovement;
  applying: boolean;
  onApply: () => void;
}) {
  return (
    <li className="rounded-md border p-2.5 text-sm">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="font-medium">{fieldLabel(improvement.field)}</p>
      </div>

      {improvement.status === "candidate-available" && (
        <div className="flex flex-col gap-1.5">
          <p className="text-muted-foreground text-xs">
            {sourceTypeLabel(improvement.sourceType ?? "")} source available:{" "}
            <span className="text-foreground font-medium">
              {formatFieldValue(improvement.field, improvement.proposedValue)}
            </span>
          </p>
          {improvement.sourceLabel && (
            <a
              href={improvement.sourceLabel}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-[11px]"
            >
              Review source
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
          {improvement.scoreImpact && (
            <p className="text-primary text-xs font-medium">
              +{improvement.scoreImpact.overallDeltaPercent}% overall
              {improvement.scoreImpact.currentDimensionPercent !==
              improvement.scoreImpact.projectedDimensionPercent
                ? ` (${improvement.scoreImpact.currentDimensionPercent ?? 0}% → ${improvement.scoreImpact.projectedDimensionPercent ?? 0}%)`
                : ""}
            </p>
          )}
          <Button
            size="sm"
            variant="outline"
            className="w-fit"
            disabled={applying}
            onClick={onApply}
          >
            {applying ? "Applying…" : "Apply"}
          </Button>
        </div>
      )}

      {improvement.status === "source-no-candidate" && (
        <p className="text-muted-foreground text-xs">
          Source available. No structured candidate extracted yet.
        </p>
      )}

      {improvement.status === "no-source" && (
        <p className="text-muted-foreground text-xs">
          No source available yet.
        </p>
      )}
    </li>
  );
}
