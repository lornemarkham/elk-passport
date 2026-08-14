"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Sparkles, ExternalLink, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import type { AdminEntity } from "@/lib/data/admin-repo";
import {
  applyEnrichment,
  proposeEnrichment,
  type EnrichmentReview,
} from "@/lib/data/explorer-repo";
import {
  fieldLabel,
  formatFieldValue,
  isImageField,
} from "./entityFieldFormat";
import { useTrace } from "./learning-tracer/TraceContext";
import {
  confidenceLevel,
  describeChange,
  groupAndRank,
  imageRelevanceSentence,
  isGapFill,
  sourceContrastNote,
  sourceTypeLabel,
  summarizeAgreement,
  type ConfidenceLevel,
} from "./enrichmentPresentation";

type State = "idle" | "loading" | "ready" | "error";

function ConfidenceBadge({
  level,
  confidence,
}: {
  level: ConfidenceLevel;
  confidence?: number;
}) {
  if (level === "unscored")
    return <span className="text-muted-foreground text-xs">Not AI-scored</span>;
  const style: Record<Exclude<ConfidenceLevel, "unscored">, string> = {
    high: "border-green-600 text-green-700 dark:text-green-400",
    medium: "border-amber-500 text-amber-700 dark:text-amber-400",
    low: "border-muted-foreground/40 text-muted-foreground",
  };
  const text: Record<Exclude<ConfidenceLevel, "unscored">, string> = {
    high: "High confidence",
    medium: "Medium confidence",
    low: "Low confidence",
  };
  return (
    <Badge variant="outline" className={style[level]}>
      {text[level]}
      {confidence !== undefined ? ` · ${Math.round(confidence * 100)}%` : ""}
    </Badge>
  );
}

/**
 * Atlas learning from evidence it already trusts, not just detecting that
 * better evidence exists. Every proposed value traces to a real
 * `SourceRecord` — nothing is drafted or invented, this only re-surfaces
 * what sources Atlas already linked to this entity actually say.
 *
 * One card per *field*. Each card is built to answer, in order, without
 * the curator reconstructing any of it by hand: what's changing, why
 * Atlas is recommending it, whether independent sources agree or
 * disagree (a stronger signal than any single confidence score), where
 * both the current and proposed values actually came from (a visible
 * source badge on both boxes, not small print), and — when it's honestly
 * knowable — what this source contributed that another linked source
 * didn't (`sourceContrastNote`, e.g. "Only BC Parks reports this").
 *
 * Selection, not synthesis — the recommendation is always the
 * highest-scoring value a real source already produced, never a blend or
 * a rewrite. Atlas will not propose replacing a populated field with a
 * less informative one (filtered server-side, never reaches this screen).
 * Length is never used as a quality signal — a corroborating source is
 * usually a different write-up of the same facts, not a longer edit of
 * the current one.
 */
export function EnrichmentPanel({
  entity,
  onApplied,
}: {
  entity: AdminEntity;
  /** Called after a successful apply so the caller can reload its own entity list. The Learning Tracer records itself, directly, via useTrace() — this callback is purely about refreshing ContentExplorerView's data. */
  onApplied: () => void;
}) {
  const [state, setState] = useState<State>("idle");
  const [review, setReview] = useState<EnrichmentReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [reason, setReason] = useState("");
  const [applying, setApplying] = useState(false);
  const { record } = useTrace();

  const recommendations = useMemo(
    () => (review ? groupAndRank(review.fieldProposals) : []),
    [review],
  );

  // Gap-fills first — those are the fast, obvious-yes reviews; replacements
  // (the ones that actually need judgment) come after.
  const sortedRecommendations = useMemo(
    () =>
      [...recommendations].sort((a, b) => {
        const aGap = isGapFill(a.recommended.currentValue) ? 0 : 1;
        const bGap = isGapFill(b.recommended.currentValue) ? 0 : 1;
        return aGap - bGap;
      }),
    [recommendations],
  );

  async function check() {
    setState("loading");
    setError(null);
    try {
      const result = await proposeEnrichment(entity.id);
      setReview(result);
      const defaults: Record<string, boolean> = {};
      for (const rec of groupAndRank(result.fieldProposals)) {
        defaults[rec.field] = isGapFill(rec.recommended.currentValue);
      }
      setSelected(defaults);
      setState("ready");
      // Recorded only now, after a real response came back — this is a
      // read-only action (nothing was written), which the trace itself says.
      record({
        actionId: "check-other-sources",
        headline: entity.name,
        detail:
          result.fieldProposals.length === 0
            ? "no differences found"
            : `${result.fieldProposals.length} proposal${result.fieldProposals.length === 1 ? "" : "s"} found`,
      });
    } catch (err) {
      console.error(`Failed to check enrichment for ${entity.id}:`, err);
      setError(
        err instanceof Error ? err.message : "Failed to check for enrichment.",
      );
      setState("error");
    }
  }

  const chosen = sortedRecommendations.filter((rec) => selected[rec.field]);

  async function apply() {
    if (chosen.length === 0) return;
    const payload: Record<string, { value: unknown; sourceRecordId: string }> =
      {};
    for (const rec of chosen) {
      payload[rec.field] = {
        value: rec.recommended.proposedValue,
        sourceRecordId: rec.recommended.sourceRecordId,
      };
    }

    setApplying(true);
    try {
      await applyEnrichment(entity.id, payload, reason || undefined);
      toast.success(`Applied ${chosen.length} field(s) to "${entity.name}".`);
      const appliedFieldLabels = chosen.map((rec) => fieldLabel(rec.field));
      record({
        actionId: "apply-enrichment",
        headline: entity.name,
        detail:
          appliedFieldLabels.length > 0
            ? appliedFieldLabels.join(", ")
            : undefined,
      });
      setReview(null);
      setState("idle");
      setReason("");
      onApplied();
    } catch (err) {
      console.error(`Failed to apply enrichment to ${entity.id}:`, err);
      toast.error(
        err instanceof Error ? err.message : "Failed to apply enrichment.",
      );
    } finally {
      setApplying(false);
    }
  }

  return (
    // Curator Workbench v2 — enrichment is one of the most consequential
    // things a curator does on this page (it's the one workflow that
    // actually changes what Atlas knows), so it gets its own visually
    // distinct treatment — a soft accent border and tint — instead of
    // blending into the same undifferentiated stack as read-only sections
    // like Fields or Sources.
    <div className="border-primary/20 bg-primary/[0.025] flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="text-primary h-3.5 w-3.5" />
          <p className="text-sm font-semibold">Enrichment</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={check}
          disabled={state === "loading"}
        >
          {state === "loading" ? "Checking…" : "Check other sources"}
        </Button>
      </div>

      {state === "error" && (
        <p className="text-muted-foreground text-sm">{error}</p>
      )}

      {state === "ready" && review && sortedRecommendations.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Every source already linked to this entity agrees with what&apos;s
          stored.
        </p>
      )}

      {state === "ready" && review && sortedRecommendations.length > 0 && (
        <div className="flex flex-col gap-3">
          {sortedRecommendations.map((rec) => {
            const proposal = rec.recommended;
            const isImage = isImageField(proposal.field);
            const gapFill = isGapFill(proposal.currentValue);
            const agreement = summarizeAgreement(rec);
            const level = confidenceLevel(proposal.confidence);
            const currentOrigin = review.currentValueOrigins[proposal.field];
            const whySentence = isImage
              ? imageRelevanceSentence(currentOrigin, proposal.sourceType)
              : describeChange(
                  proposal.field,
                  proposal.currentValue,
                  proposal.proposedValue,
                );
            // The concrete "what did this source contribute that another
            // didn't" answer — empty when nothing honest can be said (see
            // the function's own doc comment).
            const contrastNote = isImage
              ? ""
              : sourceContrastNote(rec, currentOrigin);

            return (
              <div key={rec.field} className="rounded-lg border p-3 text-sm">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={!!selected[rec.field]}
                    onChange={(e) =>
                      setSelected((prev) => ({
                        ...prev,
                        [rec.field]: e.target.checked,
                      }))
                    }
                  />
                  <div className="flex-1">
                    {/* Status line: lead with agreement when there's more than one source to agree or disagree — that's the stronger signal — otherwise fall back to confidence alone. */}
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      <p className="font-medium">
                        {fieldLabel(proposal.field)}
                      </p>
                      <Badge variant="secondary">
                        {gapFill ? "Fills a gap" : "Replaces existing value"}
                      </Badge>
                      {agreement.totalSources > 1 ? (
                        agreement.allAgree ? (
                          <Badge
                            variant="outline"
                            className="border-green-600 text-green-700 dark:text-green-400"
                          >
                            <Check className="h-3 w-3" />
                            Confirmed by {agreement.agreeingSources} of{" "}
                            {agreement.totalSources} sources
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-amber-500 text-amber-700 dark:text-amber-400"
                          >
                            <AlertTriangle className="h-3 w-3" />
                            Sources disagree
                          </Badge>
                        )
                      ) : (
                        <ConfidenceBadge
                          level={level}
                          confidence={proposal.confidence}
                        />
                      )}
                    </div>

                    {/* The one sentence explaining why, in place of a scattered badge + category line. */}
                    <p className="text-muted-foreground mb-1 text-xs">
                      {whySentence}
                    </p>
                    {/* The concrete source-contribution answer — a curator's first, most direct question: what did this source know that another didn't. */}
                    {contrastNote && (
                      <p className="text-primary mb-2 text-xs font-medium">
                        {contrastNote}
                      </p>
                    )}
                    {!contrastNote && <div className="mb-2" />}

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="bg-muted/30 rounded-md border p-2">
                        <div className="mb-1 flex items-center justify-between gap-1">
                          <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
                            Currently stored
                          </p>
                          <Badge variant="secondary" className="text-[10px]">
                            {currentOrigin
                              ? sourceTypeLabel(currentOrigin.sourceType)
                              : "Original source"}
                          </Badge>
                        </div>
                        {isImage &&
                        typeof proposal.currentValue === "string" &&
                        proposal.currentValue ? (
                          // eslint-disable-next-line @next/next/no-img-element -- internal explorer
                          <img
                            src={proposal.currentValue}
                            alt=""
                            className="h-24 w-24 rounded object-cover"
                          />
                        ) : (
                          <p>
                            {formatFieldValue(
                              proposal.field,
                              proposal.currentValue,
                            )}
                          </p>
                        )}
                      </div>
                      <div className="border-primary/30 bg-primary/5 rounded-md border p-2">
                        <div className="mb-1 flex items-center justify-between gap-1">
                          <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
                            Recommended
                          </p>
                          <Badge className="text-[10px]">
                            {sourceTypeLabel(proposal.sourceType)}
                          </Badge>
                        </div>
                        {isImage &&
                        typeof proposal.proposedValue === "string" ? (
                          // eslint-disable-next-line @next/next/no-img-element -- internal explorer
                          <img
                            src={proposal.proposedValue}
                            alt=""
                            className="h-24 w-24 rounded object-cover"
                          />
                        ) : (
                          <p>
                            {formatFieldValue(
                              proposal.field,
                              proposal.proposedValue,
                            )}
                          </p>
                        )}
                        <a
                          href={proposal.sourceLabel}
                          target="_blank"
                          rel="noreferrer"
                          className="text-muted-foreground hover:text-foreground mt-1 inline-flex items-center gap-1 text-[10px]"
                        >
                          view source
                          {agreement.totalSources === 1
                            ? ""
                            : ` · ${Math.round((proposal.confidence ?? 0) * 100)}%`}
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </div>
                    </div>

                    {agreement.hasDisagreement && (
                      <p className="text-muted-foreground mt-2 text-[11px]">
                        Other sources say:{" "}
                        {agreement.disagreeingValues
                          .map(
                            (d) =>
                              `${formatFieldValue(proposal.field, d.value)} (${sourceTypeLabel(d.sourceType)})`,
                          )
                          .join("; ")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <Textarea
            placeholder="Optional note on why these are being adopted."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />

          <div className="flex items-center justify-end gap-2">
            <p className="text-muted-foreground mr-auto text-xs">
              {chosen.length === 0
                ? "Select at least one field to apply."
                : `Will update: ${chosen.map((rec) => fieldLabel(rec.field)).join(", ")}`}
            </p>
            <Button
              size="sm"
              disabled={chosen.length === 0 || applying}
              onClick={apply}
            >
              {applying ? "Applying…" : `Apply ${chosen.length || ""} field(s)`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
