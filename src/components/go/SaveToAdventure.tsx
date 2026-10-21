"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CalendarPlus } from "lucide-react";

/** The adventure a day was opened from (`/go?adventure=`), as its member sees it. */
export interface AdventureTarget {
  readonly id: string;
  readonly title: string;
  readonly role: "owner" | "participant";
}

/**
 * **Bring the day back to the adventure it came from.**
 *
 * Shown only when `/go` was opened from an adventure the person is in. The
 * owner saves the day — its stops take this date and this order, and the
 * sentence is kept so it can be refined later. Anybody else suggests it:
 * the stops arrive on the adventure as ideas for the owner to place.
 *
 * It sends the same day query the print button links to, so what is saved
 * is exactly what is on screen.
 */
export function SaveToAdventure({
  adventure,
  query,
}: {
  readonly adventure: AdventureTarget;
  readonly query: string;
}) {
  const [state, setState] = useState<
    | { at: "idle" }
    | { at: "busy" }
    | { at: "done"; query: string; text: string }
    | { at: "failed"; text: string }
  >({ at: "idle" });
  const owner = adventure.role === "owner";
  const done = state.at === "done" && state.query === query;

  async function save() {
    setState({ at: "busy" });
    try {
      const response = await fetch(`/api/adventures/${adventure.id}/days`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setState({
          at: "failed",
          text:
            response.status === 503
              ? "Adventures can't be reached right now. The day is still here."
              : (body.error ?? "Couldn't save it. The day is still here."),
        });
        return;
      }
      setState({
        at: "done",
        query,
        text: owner
          ? `Saved to ${adventure.title}.`
          : `Suggested to ${adventure.title}. Its owner puts it on a day.`,
      });
    } catch {
      setState({
        at: "failed",
        text: "Couldn't reach Passport. The day is still here.",
      });
    }
  }

  return (
    <div
      className="mt-3 flex flex-wrap items-center gap-3"
      data-testid="go-adventure"
    >
      <button
        type="button"
        data-testid="go-save-adventure"
        onClick={save}
        disabled={state.at === "busy"}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#111] px-6 text-[15px] font-semibold text-white disabled:opacity-60"
      >
        <CalendarPlus className="h-4 w-4" aria-hidden />
        {done
          ? owner
            ? "Saved ✓"
            : "Suggested ✓"
          : owner
            ? `Save to ${adventure.title}`
            : `Suggest to ${adventure.title}`}
      </button>
      <Link
        href={`/adventures/${adventure.id}`}
        className="inline-flex min-h-12 items-center gap-1 px-2 text-[15px] font-semibold text-black/60 hover:text-[#111]"
      >
        Back to {adventure.title}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
      {(state.at === "done" || state.at === "failed") && (
        <p
          role="status"
          data-testid="go-adventure-note"
          className="w-full text-[14px] text-black/70"
        >
          {state.text}
        </p>
      )}
    </div>
  );
}
