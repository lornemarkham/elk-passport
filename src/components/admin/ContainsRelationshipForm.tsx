"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AdminEntity } from "@/lib/data/admin-repo";
import {
  confirmRelationshipCandidate,
  createContainsRelationship,
  rejectRelationshipCandidate,
  type Relationship,
  type RelationshipCandidate,
  type SourceRecord,
} from "@/lib/data/explorer-repo";
import { ContainsSuggestionCard } from "./contains/ContainsSuggestionCard";
import {
  composeSuggestionReason,
  pickBestContainsSuggestion,
  type EvidenceKind,
  type ScoredCandidate,
} from "./contains/containmentEvidence";

type Mode = "suggestion" | "confirming" | "manual" | "rejected";

/** A persisted candidate (Phase 5.1) is display-equivalent to a live-computed one once its proposed parent is resolved to a real entity — this is the one place that mapping happens. */
function candidateToScored(
  candidate: RelationshipCandidate,
  candidateParents: AdminEntity[],
): ScoredCandidate | undefined {
  const parent = candidateParents.find(
    (p) => p.id === candidate.sourceEntityId,
  );
  if (!parent) return undefined; // stale — Atlas's own listRelationshipCandidates already filters this out server-side, this is defense in depth only
  return {
    candidate: parent,
    // Atlas's server-side containmentEvidence.ts and this file's own copy
    // are independently implemented but share the same evidence vocabulary
    // by design (Phase 5.1 architecture review: "port the design, not the
    // file") — the cast is safe because both sides agree on EvidenceKind's
    // values, not because the type system can see across the two modules.
    signals: candidate.evidence.map((s) => ({
      kind: s.kind as EvidenceKind,
      label: s.label,
    })),
    qualifies: true,
  };
}

/**
 * Curator-driven `contains` creation
 * (docs/content-model/relationships/contains.md). Two sources of
 * suggestion, persisted taking priority over live:
 *
 *   - Phase 5.1: a `RelationshipCandidate` a standalone discovery pass
 *     already found and persisted (`npm run discover-contains-candidates`).
 *     Confirming it goes through `RelationshipCandidateService.confirm`,
 *     which itself calls the same, unchanged `ContainmentService`.
 *   - Phase 4.2: if no persisted candidate exists for this entity, the
 *     original live, client-computed suggestion
 *     (`pickBestContainsSuggestion`) still runs exactly as before —
 *     nothing about that path changed.
 *
 * Both render through the same `ContainsSuggestionCard` and the same
 * confirm-with-editable-reason flow; only what happens on Confirm/Reject
 * differs (persisted candidates call the new candidate endpoints and
 * change real, visible state; a live suggestion's Reject is, as it always
 * was, a purely local dismissal — nothing to persist for a fact Atlas
 * never stored in the first place).
 *
 * Deliberately one direction only: "set this Place's immediate parent."
 * Adding a child from the parent's own screen would double the UI surface
 * for the same underlying action, and no real curator workflow has yet
 * shown a need for it — unchanged from Phase 4.2's original scoping.
 *
 * `existingParentName` disables everything below it — the immediate-parent
 * invariant is made visible, not discovered via a rejected submission.
 */
export function ContainsRelationshipForm({
  entity,
  candidateParents,
  relationships,
  sourceRecords,
  persistedCandidate,
  existingParentName,
  onCreated,
}: {
  entity: AdminEntity;
  /** Every other active Place entity — filtering (kind, self-exclusion, archived) happens in the caller, this component doesn't second-guess it. */
  candidateParents: AdminEntity[];
  /** Needed only for the live (Phase 4.2) evidence scoring fallback — not written to. */
  relationships: readonly Relationship[];
  sourceRecords: readonly SourceRecord[];
  /** A pending Phase 5.1 discovery candidate targeting this entity, if one exists — takes priority over the live suggestion below. */
  persistedCandidate?: RelationshipCandidate;
  existingParentName?: string;
  onCreated: () => void;
}) {
  const liveSuggestion = useMemo(
    () =>
      pickBestContainsSuggestion(entity, candidateParents, {
        relationships,
        sourceRecords,
      }),
    [entity, candidateParents, relationships, sourceRecords],
  );

  // Persisted candidate wins when one exists — see this component's own
  // doc comment for why.
  const activeSuggestion = useMemo(() => {
    if (persistedCandidate) {
      const scored = candidateToScored(persistedCandidate, candidateParents);
      if (scored)
        return {
          source: "persisted" as const,
          candidateId: persistedCandidate.id,
          scored,
        };
    }
    if (liveSuggestion)
      return {
        source: "live" as const,
        candidateId: undefined,
        scored: liveSuggestion,
      };
    return undefined;
  }, [persistedCandidate, liveSuggestion, candidateParents]);

  const [mode, setMode] = useState<Mode>(() =>
    activeSuggestion ? "suggestion" : "manual",
  );
  const [parentId, setParentId] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submitManual(targetParentId: string) {
    if (!targetParentId || !reason.trim()) return;
    setSubmitting(true);
    try {
      await createContainsRelationship({
        parentId: targetParentId,
        childId: entity.id,
        reason,
      });
      const parentName =
        candidateParents.find((p) => p.id === targetParentId)?.name ??
        targetParentId;
      toast.success(`"${parentName}" now contains "${entity.name}".`);
      setParentId("");
      setReason("");
      onCreated();
    } catch (err) {
      console.error(
        `Failed to create contains relationship for ${entity.id}:`,
        err,
      );
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to create the relationship.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function submitConfirm() {
    if (!activeSuggestion || !reason.trim()) return;
    setSubmitting(true);
    try {
      if (activeSuggestion.source === "persisted") {
        await confirmRelationshipCandidate(
          activeSuggestion.candidateId,
          reason,
        );
      } else {
        await createContainsRelationship({
          parentId: activeSuggestion.scored.candidate.id,
          childId: entity.id,
          reason,
        });
      }
      toast.success(
        `"${activeSuggestion.scored.candidate.name}" now contains "${entity.name}".`,
      );
      setReason("");
      onCreated();
    } catch (err) {
      console.error(
        `Failed to confirm contains relationship for ${entity.id}:`,
        err,
      );
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to create the relationship.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject() {
    // A persisted candidate is real, stored state — rejecting it has to
    // change that state, or discovery would keep re-surfacing it every
    // run. A live suggestion was never stored anywhere; dismissing it is
    // purely local, exactly as it was in Phase 4.2.
    if (activeSuggestion?.source === "persisted") {
      try {
        await rejectRelationshipCandidate(activeSuggestion.candidateId);
      } catch (err) {
        console.error(
          `Failed to reject candidate ${activeSuggestion.candidateId}:`,
          err,
        );
        toast.error(
          err instanceof Error
            ? err.message
            : "Failed to reject the candidate.",
        );
        return;
      }
    }
    setMode("rejected");
  }

  if (existingParentName) {
    return (
      <p className="text-muted-foreground text-xs">
        {entity.name} is already contained by{" "}
        <span className="font-medium">{existingParentName}</span>. Per the
        immediate-parent invariant
        (docs/content-model/relationships/contains.md), a second parent
        isn&apos;t supported yet.
      </p>
    );
  }

  // Suggestion step — shown first whenever evidence clears the bar, from
  // either source.
  if (mode === "suggestion" && activeSuggestion) {
    return (
      <div className="flex flex-col gap-2">
        {activeSuggestion.source === "persisted" && (
          <Badge variant="outline" className="w-fit text-[10px]">
            Discovered automatically
          </Badge>
        )}
        <ContainsSuggestionCard
          childName={entity.name}
          scored={activeSuggestion.scored}
          onConfirm={() => {
            setReason(composeSuggestionReason(activeSuggestion.scored));
            setMode("confirming");
          }}
          onChooseDifferent={() => setMode("manual")}
          onReject={handleReject}
        />
      </div>
    );
  }

  // Curator clicked Confirm — the pre-filled reason is editable.
  if (mode === "confirming" && activeSuggestion) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs">
          Setting{" "}
          <span className="font-medium">
            {activeSuggestion.scored.candidate.name}
          </span>{" "}
          as the immediate parent of{" "}
          <span className="font-medium">{entity.name}</span>. Review or edit the
          reason before saving.
        </p>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMode("suggestion")}
            disabled={submitting}
          >
            Back
          </Button>
          <Button
            size="sm"
            disabled={!reason.trim() || submitting}
            onClick={submitConfirm}
          >
            {submitting ? "Saving…" : "Confirm and save"}
          </Button>
        </div>
      </div>
    );
  }

  // Curator rejected the suggestion — dismissed, not forced into the full
  // list unless they ask for it.
  if (mode === "rejected") {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-muted-foreground text-xs">Suggestion dismissed.</p>
        <div>
          <Button variant="outline" size="sm" onClick={() => setMode("manual")}>
            Search manually
          </Button>
        </div>
      </div>
    );
  }

  // Manual fallback — reached via Choose Different, Reject → Search
  // manually, or directly when no candidate clears the evidence bar at all.
  return (
    <div className="flex flex-col gap-2">
      {!activeSuggestion && (
        <p className="text-muted-foreground text-xs">
          No strong parent candidate found. Search for the right Place below.
        </p>
      )}
      {candidateParents.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          No other Place entities available to select as a parent.
        </p>
      ) : (
        <>
          <select
            className="border-input bg-background rounded-md border px-2 py-1.5 text-sm"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
          >
            <option value="">Select a Place…</option>
            {candidateParents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Textarea
            placeholder={`Why does this Place contain "${entity.name}"? (required — e.g. a quote or summary of the source)`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!parentId || !reason.trim() || submitting}
              onClick={() => submitManual(parentId)}
            >
              {submitting ? "Saving…" : "Set as immediate parent"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
