/**
 * Shared shape for the "What's in this source that we never extracted?"
 * AI analysis.
 *
 * Lives here rather than in the route handler because a client component
 * (`SourcePanel`) needs the type, and importing anything from a
 * `route.ts` into client code drags a server module into the client
 * graph. Types only — no logic, no server imports.
 */

export interface UnextractedFinding {
  /** Short label for the knowledge, in the source's own words. */
  label: string;
  /** What the source says. */
  value: string;
  /** Verbatim quote from the source proving it. Verified server-side before this ever reaches the client. */
  excerpt: string;
  /** The source's own section heading, if it sits under one. */
  category?: string;
  /** Why a traveler would plausibly care — the curator's triage signal. */
  travelerRelevance?: string;
}

export interface UnextractedAnalysis {
  sourceRecordId: string;
  /** Always `"ai"`. Present so no consumer can render this without knowing what it is. */
  authoredBy: "ai";
  model: string;
  analysedAt: string;
  rawContentLength: number;
  analysedChars: number;
  truncated: boolean;
  knownLabels: string[];
  findings: UnextractedFinding[];
  /** Findings whose quoted passage could not be located in the source, and were therefore discarded. Reported, not hidden. */
  rejectedFindingCount: number;
}
