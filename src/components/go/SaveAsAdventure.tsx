"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { ZONE } from "@/domain/experience/eventTime";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Today where the places are, as `YYYY-MM-DD`. */
const todayHere = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: ZONE });

/**
 * **Keep this day as an adventure** — for a day that did not come from one.
 *
 * The owner's brief (2026-11-08, P4): discover → save → open the Pocket →
 * Make a day → _a complete suggested adventure_ → adjust → save → start. The
 * Day Builder could already save a day **back** to an adventure it was opened
 * from (`SaveToAdventure`); a day made straight from the Pocket had nowhere
 * to go but a printout or this phone. This closes that with the two calls
 * that already exist and nothing new stored:
 *
 * 1. `POST /api/adventures` — a one-day adventure on the chosen date.
 * 2. `POST /api/adventures/:id/days` — this exact day (the same query the
 *    print button links to), its stops in this order, its sentence kept.
 *
 * Then the adventure, where it counts down, starts, and is remembered.
 * Signed out, the API says so and the person is sent to sign in and back.
 */
export function SaveAsAdventure({
  query,
  firstStop,
}: {
  /** The day, as `writeDayQuery` writes it. */
  readonly query: string;
  /** For a name nobody has to type. */
  readonly firstStop?: string;
}) {
  const router = useRouter();
  const carried = new URLSearchParams(query).get("on");
  const [on, setOn] = useState(
    carried && DAY.test(carried) ? carried : todayHere(),
  );
  const [title, setTitle] = useState(
    firstStop ? `A day at ${firstStop}`.slice(0, 120) : "Our day out",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !DAY.test(on) || !title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const made = await fetch("/api/adventures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "day",
          title: title.trim(),
          startsOn: on,
          endsOn: null,
        }),
      });
      if (made.status === 401) {
        window.location.assign(
          `/auth?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
        );
        return;
      }
      const adventure = await made.json().catch(() => ({}));
      if (!made.ok || typeof adventure.id !== "string") {
        setError(
          made.status === 503
            ? "Adventures can't be reached right now. The day is still here."
            : (adventure.error ?? "Couldn't save it. The day is still here."),
        );
        setBusy(false);
        return;
      }
      const day = new URLSearchParams(query);
      day.set("on", on);
      const kept = await fetch(`/api/adventures/${adventure.id}/days`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: day.toString() }),
      });
      if (!kept.ok) {
        const body = await kept.json().catch(() => ({}));
        // The adventure exists; say where, rather than leave an empty one
        // nobody knows about.
        setError(
          `${body.error ?? "The day didn't save."} The adventure is made — you can plan it there.`,
        );
        setBusy(false);
        router.push(`/adventures/${adventure.id}`);
        return;
      }
      router.push(`/adventures/${adventure.id}`);
    } catch {
      setError("Couldn't reach Passport. The day is still here.");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={save}
      aria-label="Save as an adventure"
      data-testid="go-save-as-adventure"
      className="mt-4 flex flex-col gap-3 rounded-2xl bg-black/[0.03] p-4 sm:flex-row sm:items-end"
    >
      <label className="flex-1 text-[13px] font-semibold text-black/60">
        Call it
        <input
          data-testid="go-adventure-title"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 block min-h-12 w-full rounded-full bg-white px-4 text-[15px] font-normal text-[#111] ring-1 ring-black/15 ring-inset focus:ring-2 focus:ring-black/50 focus:outline-none"
        />
      </label>
      <label className="text-[13px] font-semibold text-black/60">
        On
        <input
          type="date"
          data-testid="go-adventure-date"
          value={on}
          onChange={(e) => setOn(e.target.value)}
          className="mt-1 block min-h-12 rounded-full bg-white px-4 text-[15px] font-normal text-[#111] ring-1 ring-black/15 ring-inset focus:ring-2 focus:ring-black/50 focus:outline-none"
        />
      </label>
      <button
        type="submit"
        data-testid="go-save-new-adventure"
        disabled={busy}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--gh-forest,#1f4d3a)] px-6 text-[15px] font-semibold text-white disabled:opacity-60"
      >
        <CalendarPlus className="h-4 w-4" aria-hidden />
        {busy ? "Saving…" : "Save as an adventure"}
      </button>
      {error && (
        <p role="alert" className="w-full text-[14px] text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
