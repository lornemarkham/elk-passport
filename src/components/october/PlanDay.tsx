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
 *
 * ## Why it asks before it appears
 *
 * An empty `<input type="date">` is not blank. Chrome paints `yyyy-mm-dd` into
 * it, so every undated film and Doing in My October carried a line of database
 * format where a plan should be — the page read as a form over a list of
 * things somebody is looking forward to.
 *
 * It is the same control, reached one tap later and opened on today, because
 * today is the answer most often wanted and the one a person can change
 * fastest. Nothing about the saving changes.
 */
export function PlanDay({
  entityId,
  day,
  today = localToday(),
}: {
  readonly entityId: string;
  /** `YYYY-MM-DD`, where one is already set. */
  readonly day?: string;
  /** Injectable so a test is not at the mercy of the day it runs on. */
  readonly today?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  /** Open for a thing that already has a day; asked for, otherwise. */
  const [picking, setPicking] = useState(false);

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

  if (!day && !picking) {
    return (
      <button
        type="button"
        data-testid="plan-ask"
        disabled={busy}
        onClick={() => setPicking(true)}
        className="min-h-9 rounded-full border border-[#e9e6da]/15 px-3 text-xs text-[#e9e6da]/55 hover:border-[#d09a4e]/50 hover:text-[#e9e6da] disabled:opacity-50"
      >
        Give it a day
      </button>
    );
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
        value={day ?? today}
        min="2026-10-01"
        max="2026-11-30"
        onChange={(event) => void set(event.target.value || null)}
        className="min-h-9 rounded-full border border-[#e9e6da]/15 bg-transparent px-3 text-xs text-[#e9e6da]/70 disabled:opacity-50"
      />
      <button
        type="button"
        data-testid="plan-clear"
        disabled={busy}
        onClick={() => {
          setPicking(false);
          if (day) void set(null);
        }}
        className="min-h-9 text-xs text-[#e9e6da]/35 underline-offset-4 hover:underline disabled:opacity-50"
      >
        no date
      </button>
    </span>
  );
}

/**
 * Today where the person is, as `YYYY-MM-DD`.
 *
 * `toISOString().slice(0, 10)` is tomorrow for most of a Pacific evening,
 * which is precisely when somebody plans something — so the one date this
 * component volunteers is read from the local calendar, not from UTC.
 */
function localToday(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const dayOfMonth = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${dayOfMonth}`;
}
