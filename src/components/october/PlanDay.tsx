"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { planFor } from "@/lib/october/october-repo";

/**
 * **The smallest thing that turns a wish into a plan.**
 *
 * *Carve pumpkins* and *carve pumpkins, Saturday* are different objects. The
 * first is a nice idea; the second is a thing that will either happen or be
 * missed, and once it has a day the whole rest of October applies to it —
 * Anticipate counts down to it, the weather knows what that evening will be
 * like, and it sorts among the things you are actually doing.
 *
 * So: a native date input and nothing else. **Not a calendar application** —
 * no repeats, no times, no reminders, no duration. One day, or none.
 */
export function PlanDay({
  entityId,
  day,
}: {
  readonly entityId: string;
  /** `YYYY-MM-DD`, where one is already set. */
  readonly day?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function set(next: string | null) {
    setBusy(true);
    try {
      await planFor(entityId, next);
      router.refresh();
    } catch {
      // Said, not swallowed: a date that silently failed to save is a plan
      // somebody thinks they made.
      toast.error("Couldn't set that day.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <label className="sr-only" htmlFor={`plan-${entityId}`}>
        Give this a day
      </label>
      <input
        id={`plan-${entityId}`}
        type="date"
        data-testid="plan-day"
        disabled={busy}
        value={day ?? ""}
        min="2026-10-01"
        max="2026-11-30"
        onChange={(event) => void set(event.target.value || null)}
        className="min-h-9 rounded-full border border-[#e9e6da]/15 bg-transparent px-3 text-xs text-[#e9e6da]/70 disabled:opacity-50"
      />
      {day ? (
        <button
          type="button"
          data-testid="plan-clear"
          disabled={busy}
          onClick={() => void set(null)}
          className="min-h-9 text-xs text-[#e9e6da]/35 underline-offset-4 hover:underline disabled:opacity-50"
        >
          no date
        </button>
      ) : null}
    </span>
  );
}
