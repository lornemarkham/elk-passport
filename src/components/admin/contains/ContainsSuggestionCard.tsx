"use client";

import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { evidenceKindLabel, type ScoredCandidate } from "./containmentEvidence";

/**
 * Purely presentational — evidence bullets plus three actions. Owns no
 * network call and no submit logic; `ContainsRelationshipForm` decides
 * what each action means (Confirm reveals the existing, unchanged submit
 * form pre-filled with the evidence explanation; Choose Different and
 * Reject just change which view `ContainsRelationshipForm` shows next).
 *
 * Deliberately says "Confirm," not "Accept" — the curator is confirming
 * Atlas's recommendation, not approving Atlas itself.
 */
export function ContainsSuggestionCard({
  childName,
  scored,
  onConfirm,
  onChooseDifferent,
  onReject,
}: {
  childName: string;
  scored: ScoredCandidate;
  onConfirm: () => void;
  onChooseDifferent: () => void;
  onReject: () => void;
}) {
  return (
    <div className="rounded-lg border p-3 text-sm">
      <div className="mb-1.5 flex items-center gap-1.5">
        <CheckCircle2 className="text-primary h-3.5 w-3.5" />
        <p className="font-medium">Suggested parent</p>
      </div>
      <p className="mb-2 text-base font-semibold">{scored.candidate.name}</p>

      <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
        Why?
      </p>
      <ul className="mb-3 flex flex-col gap-1">
        {scored.signals.map((signal) => (
          <li key={signal.kind} className="flex items-start gap-1.5 text-xs">
            <Badge variant="outline" className="mt-0.5 shrink-0 text-[10px]">
              {evidenceKindLabel(signal.kind)}
            </Badge>
            <span>{signal.label}</span>
          </li>
        ))}
      </ul>

      <p className="text-muted-foreground mb-3 text-xs">
        Atlas thinks &quot;{scored.candidate.name}&quot; contains &quot;
        {childName}&quot; based on the evidence above — not a guess, and not yet
        a fact until you confirm it.
      </p>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onReject}>
          Reject
        </Button>
        <Button variant="outline" size="sm" onClick={onChooseDifferent}>
          Choose Different
        </Button>
        <Button size="sm" onClick={onConfirm}>
          Confirm
        </Button>
      </div>
    </div>
  );
}
