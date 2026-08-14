"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  getSourceCoverage,
  type SourceCoverageResult,
} from "@/lib/data/explorer-repo";
import { sourceTypeLabel } from "./enrichmentPresentation";

type CoverageState = "loading" | "ready" | "error";

/**
 * Sprint 3.1 — Source Coverage. Deliberately a different, smaller question
 * than `KnowledgeScorePanel` above it: not "how complete is this entity"
 * but "which *kinds* of trusted source has Atlas ever actually checked for
 * it." No score, no tier, no AI recommendation, no ingestion action — just
 * an honest inventory (`atlas/src/application/quality/SourceCoverage.ts`),
 * so a curator can see *why* Atlas knows what it knows and judge for
 * themselves what's worth going and finding next.
 *
 * Fetched eagerly on mount, unlike the Knowledge Score panel's lazy
 * gap-improvements fetch — this route does no AI call (it only reads
 * `describes` relationships already in the store), so there's no cost
 * reason to gate it behind an expand click.
 */
export function SourceCoveragePanel({ entityId }: { entityId: string }) {
  const [state, setState] = useState<CoverageState>("loading");
  const [result, setResult] = useState<SourceCoverageResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState("loading");
      setError(null);
      try {
        const data = await getSourceCoverage(entityId);
        if (cancelled) return;
        setResult(data);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        console.error(`Failed to load source coverage for ${entityId}:`, err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load source coverage.",
        );
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entityId]);

  // One shared header rendered unconditionally, varying only the body below
  // it by state — the same shape `KnowledgeScorePanel` uses, rather than
  // three separate early returns each re-declaring the "Source Coverage"
  // label.
  const total = result ? result.present.length + result.missing.length : 0;

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-baseline gap-2.5">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Source Coverage
        </p>
        {state === "ready" && result && (
          <p className="text-muted-foreground text-xs">
            {result.present.length} of {total} known source categories checked
          </p>
        )}
      </div>

      {state === "loading" && (
        <p className="text-muted-foreground mt-2 text-xs">Checking…</p>
      )}

      {state === "error" && (
        <p className="text-muted-foreground mt-2 text-xs">{error}</p>
      )}

      {state === "ready" && result && (
        <>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {result.present.map((entry) => (
              <Badge
                key={entry.category}
                variant="secondary"
                title={entry.sourceTypes.map(sourceTypeLabel).join(", ")}
              >
                <CheckCircle2 className="h-3 w-3" />
                {entry.label}
              </Badge>
            ))}
            {result.missing.map((entry) => (
              <Badge
                key={entry.category}
                variant="outline"
                className="text-muted-foreground"
              >
                <Circle className="h-3 w-3" />
                {entry.label}
              </Badge>
            ))}
          </div>

          {result.uncategorized.length > 0 && (
            <p className="text-muted-foreground mt-2 text-[11px]">
              Also attached, outside this taxonomy:{" "}
              {result.uncategorized
                .map((u) => sourceTypeLabel(u.sourceType))
                .join(", ")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
