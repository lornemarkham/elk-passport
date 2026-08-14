"use client";

import { useState } from "react";
import { ChevronRight, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SourceRecord } from "@/lib/data/explorer-repo";
import { sourceTypeLabel } from "./enrichmentPresentation";

/**
 * Curator Workbench v2 — a source card collapsed down to one scannable
 * row by default: source type, date, a link out, done. The full raw
 * content (what extraction actually saw) is one click away, never
 * truncated once opened — this is still a debugging tool, not a curator
 * polish surface, that discipline just no longer costs permanent vertical
 * space for every source on every entity.
 *
 * Owns its own expanded/collapsed state — deliberately not lifted to
 * `ContentExplorerView`, which has no reason to know or care which of an
 * entity's sources a curator happened to expand.
 */
export function SourceRecordRow({
  sourceRecord,
}: {
  sourceRecord: SourceRecord;
}) {
  const [expanded, setExpanded] = useState(false);
  const content =
    typeof sourceRecord.rawContent === "string"
      ? sourceRecord.rawContent
      : JSON.stringify(sourceRecord.rawContent, null, 2);
  // The extracted-facts preview a curator sees before expanding — the
  // content's own first non-empty line (every loader in this project
  // writes "Title: <name>" or similar first), falling back to a short
  // slice for the rare source without one. Never a fabricated summary.
  const previewLine =
    content
      .split("\n")
      .find((line) => line.trim().length > 0)
      ?.slice(0, 90) ?? "";

  return (
    <div className="rounded-md border">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="hover:bg-muted/40 flex w-full items-center gap-2 px-2.5 py-2 text-left text-sm transition-colors"
      >
        <ChevronRight
          className={`text-muted-foreground h-3.5 w-3.5 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
        />
        <Badge variant="secondary" className="shrink-0 text-[10px]">
          {sourceTypeLabel(sourceRecord.sourceType)}
        </Badge>
        <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
          {previewLine}
        </span>
        <span className="text-muted-foreground shrink-0 text-[10px]">
          {new Date(sourceRecord.retrievedAt).toLocaleDateString()}
        </span>
        <a
          href={sourceRecord.source}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      </button>
      {expanded && (
        // Full content, not a preview — see this component's own doc
        // comment. Scrolls instead of growing the page unboundedly for a
        // long Wikipedia article.
        <pre className="bg-muted/30 text-foreground/80 max-h-64 overflow-y-auto border-t p-2 font-mono text-xs whitespace-pre-wrap">
          {content}
        </pre>
      )}
    </div>
  );
}
