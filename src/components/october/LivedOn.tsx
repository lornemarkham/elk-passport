"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { livedOn } from "@/lib/october/october-repo";

/**
 * **The day you say it happened, after you have already said it.**
 *
 * "Did this" stamps today and moves the thing to Lived, which is what almost
 * everybody means. The exception is the person catching up on Sunday about
 * Friday — and until this existed their only repair was *that didn't happen*
 * followed by saying it again, which deletes the record and loses the fact
 * that they had wanted it.
 *
 * Quiet by design. A lived row is the beginning of a memory, not a form, so
 * the date is plain text until somebody presses it; an always-visible date
 * field would put `yyyy-mm-dd` down the whole page, which is the same mistake
 * `PlanDay` was corrected for.
 */
export function LivedOn({
  entityId,
  day,
  label,
}: {
  readonly entityId: string;
  /** `YYYY-MM-DD` — the day currently recorded. */
  readonly day: string;
  /** How that day reads, e.g. `Fri, Oct 9`. */
  readonly label: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!editing) {
    return (
      <button
        type="button"
        data-testid="lived-on"
        onClick={() => setEditing(true)}
        className="min-h-9 text-xs font-medium text-[#d09a4e] underline-offset-4 hover:underline"
      >
        {label}
        <span className="sr-only"> — change the day this happened</span>
      </button>
    );
  }

  async function move(next: string) {
    setBusy(true);
    try {
      await livedOn(entityId, next);
      setEditing(false);
      router.refresh();
    } catch {
      // Said, not swallowed: a date somebody thinks they corrected and did
      // not is worse than one they know is still wrong.
      toast.error("Couldn't move that day.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <label className="sr-only" htmlFor={`lived-${entityId}`}>
        The day this happened
      </label>
      <input
        id={`lived-${entityId}`}
        type="date"
        data-testid="lived-on-day"
        disabled={busy}
        defaultValue={day}
        max={new Date().toISOString().slice(0, 10)}
        onChange={(event) => {
          if (event.target.value) void move(event.target.value);
        }}
        className="min-h-9 rounded-full border border-[#e9e6da]/15 bg-transparent px-3 text-xs text-[#e9e6da]/70 disabled:opacity-50"
      />
      <button
        type="button"
        data-testid="lived-on-cancel"
        disabled={busy}
        onClick={() => setEditing(false)}
        className="min-h-9 text-xs text-[#e9e6da]/35 underline-offset-4 hover:underline disabled:opacity-50"
      >
        never mind
      </button>
    </span>
  );
}
