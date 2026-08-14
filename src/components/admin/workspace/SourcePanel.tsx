"use client";

import { useState } from "react";
import { Cpu, Loader2, ExternalLink, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SourceContribution } from "@/lib/knowledge/entityKnowledge";
import type { SourceCoverageResult } from "@/lib/data/explorer-repo";
import type { UnextractedAnalysis } from "@/lib/knowledge/unextractedTypes";
import { formatDate } from "@/lib/knowledge/formatDate";

/**
 * Entity-scoped source understanding: for each attached source, what it
 * contributed, how much of it Atlas appears to have used, and — via the
 * one AI action in this milestone — what it contains that was never
 * extracted at all.
 *
 * Deliberately entity-scoped. Fleet-wide source health (does a loader
 * exist, how often does it fail, which entities has it touched) is the
 * separate Source Monitor, explicitly out of scope; this view is shaped so
 * that view can grow from it rather than replace it.
 */
export function SourcePanel({
  sources,
  coverage,
}: {
  sources: readonly SourceContribution[];
  coverage: SourceCoverageResult | null;
}) {
  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          Where this knowledge came from
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          What each attached source actually contributed — and whether it looks
          like it said more than Atlas recorded.
        </p>
      </div>

      {coverage && (
        <div className="border-border rounded-xl border p-5">
          <p className="mb-3 text-sm font-medium">
            {coverage.present.length} of{" "}
            {coverage.present.length + coverage.missing.length} trusted source
            categories checked
          </p>
          <div className="flex flex-wrap gap-2">
            {coverage.present.map((c) => (
              <span
                key={c.category}
                className="border-foreground/25 bg-foreground/5 rounded-full border px-3 py-1 text-xs font-medium"
              >
                {c.label}
              </span>
            ))}
            {coverage.missing.map((c) => (
              <span
                key={c.category}
                className="border-border text-muted-foreground rounded-full border border-dashed px-3 py-1 text-xs"
                title="No source from this category has ever been attached to this entity."
              >
                {c.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {sources.length === 0 && (
        <p className="text-muted-foreground border-border rounded-xl border border-dashed p-8 text-center text-sm">
          No source describes this entity yet.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {sources.map((source) => (
          <SourceCard key={source.id} source={source} />
        ))}
      </div>
    </section>
  );
}

function SourceCard({ source }: { source: SourceContribution }) {
  const [analysis, setAnalysis] = useState<UnextractedAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A crude, honest richness signal — a prompt to look, not a measurement.
  const looksRicherThanExtracted =
    source.charsPerContribution !== null && source.charsPerContribution > 1500;

  async function analyse() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/sources/${encodeURIComponent(source.id)}/unextracted`,
        {
          method: "POST",
        },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Analysis failed.");
      setAnalysis(body as UnextractedAnalysis);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border-border rounded-xl border">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-muted rounded px-2 py-0.5 text-xs font-medium">
              {source.sourceType}
            </span>
            <a
              href={source.source}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs break-all"
            >
              {source.source}
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            Retrieved {formatDate(source.retrievedAt)} ·{" "}
            {source.rawContentLength.toLocaleString()} characters stored ·{" "}
            {source.contributedLabels.length} piece
            {source.contributedLabels.length === 1 ? "" : "s"} of knowledge
            traced to it
          </p>

          {source.sections.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {source.sections.slice(0, 12).map((s) => (
                <span
                  key={s}
                  className="border-border rounded border px-2 py-0.5 text-[11px]"
                >
                  {s}
                </span>
              ))}
              {source.sections.length > 12 && (
                <span className="text-muted-foreground text-[11px]">
                  +{source.sections.length - 12} more
                </span>
              )}
            </div>
          )}

          {looksRicherThanExtracted && (
            <p className="mt-3 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-500">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />~
              {source.charsPerContribution?.toLocaleString()} characters of
              source text per piece of extracted knowledge. That ratio suggests
              this source said considerably more than Atlas recorded — worth
              checking.
            </p>
          )}
        </div>

        <Button
          onClick={analyse}
          disabled={loading}
          variant="outline"
          className="shrink-0 gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Cpu className="h-4 w-4" />
          )}
          What did we miss?
        </Button>
      </div>

      {error && (
        <p className="border-t px-5 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {analysis && <AnalysisResult analysis={analysis} />}
    </div>
  );
}

/**
 * AI output, rendered so it can never be mistaken for Atlas knowledge:
 * its own dashed container, an explicit AI header, and a standing note
 * that nothing here has been saved.
 */
function AnalysisResult({ analysis }: { analysis: UnextractedAnalysis }) {
  return (
    <div className="border-t">
      <div className="m-4 rounded-xl border-2 border-dashed border-violet-500/40 bg-violet-500/[0.04]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-violet-500/30 px-5 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-violet-700 dark:text-violet-300">
            <Cpu className="h-4 w-4" />
            AI analysis — proposal only, nothing saved
          </p>
          <p className="text-muted-foreground text-xs">
            {analysis.model} · {analysis.analysedChars.toLocaleString()} of{" "}
            {analysis.rawContentLength.toLocaleString()} characters
            {analysis.truncated ? " (truncated)" : ""}
          </p>
        </div>

        <div className="px-5 py-4">
          {analysis.findings.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No unextracted knowledge found. Atlas appears to have captured
              what this source states.
            </p>
          ) : (
            <>
              <p className="mb-4 text-sm">
                <strong>{analysis.findings.length}</strong> item
                {analysis.findings.length === 1 ? "" : "s"} appear in this
                source but not in Atlas.
              </p>
              <div className="flex flex-col gap-3">
                {analysis.findings.map((f, i) => (
                  <div
                    key={`${f.label}-${i}`}
                    className="border-border bg-background rounded-lg border p-4"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-medium">{f.label}</span>
                      {f.category && (
                        <span className="text-muted-foreground text-[11px] tracking-wide uppercase">
                          {f.category}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm">{f.value}</p>
                    {f.travelerRelevance && (
                      <p className="text-muted-foreground mt-2 text-xs italic">
                        {f.travelerRelevance}
                      </p>
                    )}
                    <p className="text-muted-foreground mt-3 border-l-2 pl-3 text-xs leading-relaxed">
                      &ldquo;{f.excerpt}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}

          {analysis.rejectedFindingCount > 0 && (
            <p className="text-muted-foreground mt-4 text-xs">
              {analysis.rejectedFindingCount} further finding
              {analysis.rejectedFindingCount === 1 ? " was" : "s were"}{" "}
              discarded because the quoted passage could not be located in the
              source text.
            </p>
          )}

          <p className="text-muted-foreground mt-4 border-t border-dashed pt-3 text-xs">
            Nothing above has been written to Atlas. Use it to decide whether to
            re-extract this source, add knowledge by hand, or ignore it.
          </p>
        </div>
      </div>
    </div>
  );
}
