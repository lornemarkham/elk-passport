"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { mergeEntities } from "@/lib/data/admin-repo";
import {
  confirmRelationshipCandidate,
  rejectRelationshipCandidate,
} from "@/lib/data/explorer-repo";
import type { DecisionItem, EvidenceGapItem } from "@/lib/knowledge/domainWork";

/**
 * **The two buckets an operator can finish, finished here.**
 *
 * Everything else on a domain page describes. These two act — and they act on
 * this page, deliberately. A link to Mission Control was the honest thing to
 * build when the page could not scope a decision to a mission; now that it can
 * (`domainWork.ts` joins events and candidates to the domain's own entities),
 * sending the operator away is just an unfinished workflow. Mission Control
 * stays exactly as it is and remains the Atlas-wide view.
 *
 * ## Nothing is reimplemented
 *
 * Every button posts through a function that already existed and that another
 * screen already uses — `mergeEntities`, `confirmRelationshipCandidate`,
 * `rejectRelationshipCandidate`, and the candidate-source proxy. A second
 * implementation of a merge would be a second thing to keep correct, and the
 * first time the two disagreed a curator would have no way to tell which was
 * right.
 *
 * ## Why every answer states what it does before it is clicked
 *
 * The gate in Atlas is reversibility, never confidence
 * (`isAutomaticallyProcessable`). A question reaches this page precisely
 * because answering it cannot be undone, so each one carries what *yes* does,
 * what *no* does, and why Atlas refused to decide alone. An operator who
 * understands the asymmetry answers carefully; one shown two identical buttons
 * guesses.
 *
 * ## Failure is shown, never swallowed
 *
 * A failed decision leaves the row in place with the error attached. The
 * alternative — optimistically removing it — would report work as done that
 * Atlas never recorded, which is the fabricated zero in a different costume.
 */

type Busy = { readonly id: string; readonly answer: "yes" | "no" } | null;

/* -------------------------------------------------------------------------
 * Buttons
 * ---------------------------------------------------------------------- */

function Answer({
  children,
  onClick,
  primary,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        primary
          ? "bg-foreground text-background focus-visible:ring-ring rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
          : "border-border hover:bg-muted focus-visible:ring-ring rounded-md border px-3.5 py-1.5 text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
      }
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------
 * Decisions
 * ---------------------------------------------------------------------- */

export function ReviewQuestions({
  decisions,
}: {
  decisions: readonly DecisionItem[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Busy>(null);
  const [done, setDone] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (decisions.length === 0) {
    return (
      <p className="max-w-2xl text-sm leading-relaxed">
        Nothing in this mission is waiting on a judgement. Atlas has not found
        anything here it could narrow to a single irreversible question.
      </p>
    );
  }

  const answer = async (item: DecisionItem, yes: boolean) => {
    setBusy({ id: item.id, answer: yes ? "yes" : "no" });
    setErrors((e) => ({ ...e, [item.id]: "" }));
    try {
      if (item.action.type === "merge") {
        if (yes) {
          await mergeEntities({
            survivingId: item.action.survivingId,
            absorbedIds: [...item.action.absorbedIds],
            reason: "Confirmed by a curator from the domain page.",
          });
          setDone((d) => ({ ...d, [item.id]: "Merged." }));
        } else {
          // "These are different things" is now a fact Atlas keeps — one
          // `distinct-from` edge per pair — so the group does not return on
          // the next scan. Before this route existed the answer was forgotten
          // and the queue could never reach zero.
          const response = await fetch("/api/admin/duplicates/distinct", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              entityIds: item.subjects.map((s) => s.id),
            }),
          });
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          if (!response.ok)
            throw new Error(payload?.error ?? "The decision did not save.");
          setDone((d) => ({
            ...d,
            [item.id]:
              "Recorded as different things. Atlas will not propose this group again.",
          }));
        }
      } else {
        if (yes) {
          await confirmRelationshipCandidate(
            item.action.candidateId,
            item.action.reason,
          );
          setDone((d) => ({ ...d, [item.id]: "Relationship created." }));
        } else {
          await rejectRelationshipCandidate(item.action.candidateId);
          setDone((d) => ({
            ...d,
            [item.id]: "Rejected. Atlas will not ask again.",
          }));
        }
      }
      router.refresh();
    } catch (error) {
      setErrors((e) => ({
        ...e,
        [item.id]:
          error instanceof Error ? error.message : "The decision did not save.",
      }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <ul className="divide-border divide-y">
      {decisions.map((item) => {
        const resolved = done[item.id];
        const error = errors[item.id];
        const working = busy?.id === item.id;

        return (
          <li key={item.id} className="py-5 first:pt-0 last:pb-0">
            <p className="font-heading max-w-2xl text-[17px] leading-snug font-medium tracking-tight">
              {item.question}
            </p>

            <p className="text-muted-foreground mt-1.5 max-w-2xl text-[13px] leading-relaxed">
              {item.subjects.map((s) => s.name).join("  ·  ")}
            </p>

            <ul className="marker:text-muted-foreground mt-3 flex max-w-2xl list-disc flex-col gap-1 pl-4">
              {item.evidence.map((line, i) => (
                <li key={i} className="text-[13px] leading-relaxed">
                  {line}
                </li>
              ))}
            </ul>

            <p className="text-muted-foreground mt-3 max-w-2xl text-[12.5px] leading-relaxed">
              {item.irreversible}
            </p>

            {resolved ? (
              <p className="mt-4 max-w-2xl text-[13px] leading-relaxed font-medium">
                {resolved}
              </p>
            ) : (
              <div className="mt-4 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Answer
                    primary
                    disabled={working}
                    onClick={() => void answer(item, true)}
                  >
                    {working && busy?.answer === "yes" ? "Saving…" : "Yes"}
                  </Answer>
                  <Answer
                    disabled={working}
                    onClick={() => void answer(item, false)}
                  >
                    {working && busy?.answer === "no" ? "Saving…" : "No"}
                  </Answer>
                </div>
                <p className="text-muted-foreground max-w-2xl text-[12.5px] leading-relaxed">
                  <span className="text-foreground/80 font-medium">Yes: </span>
                  {item.yesDoes}{" "}
                  <span className="text-foreground/80 font-medium">No: </span>
                  {item.noDoes}
                </p>
              </div>
            )}

            {error && (
              <p className="text-destructive mt-2 max-w-2xl text-[12.5px] leading-relaxed">
                {error}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------------------------
 * Evidence gaps
 * ---------------------------------------------------------------------- */

/**
 * What Atlas cannot yet ask about.
 *
 * Each row names what is missing rather than grading how sure Atlas is —
 * there is no confidence number in Atlas to grade with. The operator has two
 * moves: acquire the evidence, or say they do not want the thing. **Abandon
 * exists so a queue can reach empty.** Without it "nothing left to do" is
 * unreachable and the list stops being a worklist.
 */
export function EvidenceGaps({ gaps }: { gaps: readonly EvidenceGapItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (gaps.length === 0) {
    return (
      <p className="max-w-2xl text-sm leading-relaxed">
        Nothing here is blocked on evidence Atlas has not gathered.
      </p>
    );
  }

  const abandon = async (item: EvidenceGapItem) => {
    if (!item.abandonId) return;
    setBusy(item.id);
    setErrors((e) => ({ ...e, [item.id]: "" }));
    try {
      const response = await fetch(
        `/api/admin/candidate-sources/${encodeURIComponent(item.abandonId)}/dismiss`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "Abandoned from the domain page — not wanted.",
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok)
        throw new Error(payload?.error ?? "Could not abandon it.");
      setDone((d) => ({
        ...d,
        [item.id]: "Abandoned. Atlas keeps the record and will not read it.",
      }));
      router.refresh();
    } catch (error) {
      setErrors((e) => ({
        ...e,
        [item.id]:
          error instanceof Error ? error.message : "Could not abandon it.",
      }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <ul className="divide-border divide-y">
      {gaps.map((item) => {
        const resolved = done[item.id];
        const error = errors[item.id];

        return (
          <li key={item.id} className="py-4 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <p className="max-w-2xl text-[15px] font-medium">
                {item.subject}
              </p>
              {item.attribution === "subject-name" && (
                <p className="text-muted-foreground shrink-0 text-[11.5px] tracking-wide uppercase">
                  Matched by name
                </p>
              )}
            </div>

            <p className="text-muted-foreground mt-1 max-w-2xl text-[13px] leading-relaxed">
              {item.missing}
            </p>
            <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed">
              {item.nextStep}
            </p>
            {item.url && (
              <p className="text-muted-foreground mt-1 max-w-2xl font-mono text-[11.5px] break-all">
                {item.url}
              </p>
            )}

            {resolved ? (
              <p className="mt-3 text-[13px] leading-relaxed font-medium">
                {resolved}
              </p>
            ) : (
              item.abandonId && (
                <div className="mt-3">
                  <Answer
                    disabled={busy === item.id}
                    onClick={() => void abandon(item)}
                  >
                    {busy === item.id ? "Saving…" : "I do not want this"}
                  </Answer>
                </div>
              )
            )}

            {error && (
              <p className="text-destructive mt-2 max-w-2xl text-[12.5px] leading-relaxed">
                {error}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
