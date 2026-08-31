"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * **Read the discovered pages, from the mission that owns them.**
 *
 * ADR 043 says a mission is finished on its own page. Reading a discovered
 * page was the one step that still required a terminal, so this mission could
 * be understood here and only finished somewhere else.
 *
 * ## It starts an operation; it does not become one
 *
 * The click posts once and gets a **run id** back. Everything after that is
 * the run's own events, polled the same way the Region workspace already polls
 * them, and the moment the run stops this calls `router.refresh()` and gets
 * out of the way. The server component re-reads Atlas, re-derives every
 * mission, and decides for itself whether this one is finished.
 *
 * Nothing here is optimistic. No count is decremented locally, no page is
 * marked read, and completion is never announced by this component — a button
 * that congratulated itself before Atlas agreed would be the asserted pointer
 * beside a derived truth that §10 exists to warn about.
 *
 * ## The count is the mission's own
 *
 * `unread` and `failed` are passed in from the same `work.learning` the
 * completion condition reads, so the button cannot promise work the mission
 * does not agree is outstanding. When both are zero this renders nothing: an
 * operation with nothing to do is not an action, and offering it would invite
 * a curator to spend a fetch to be told the queue was already current.
 */
export function ReadQueue({
  entityIds,
  unread,
  failed,
}: {
  /** The entities whose discovered pages this mission owns. Atlas refuses an empty list rather than widening to the whole queue. */
  entityIds: readonly string[];
  unread: number;
  failed: number;
}) {
  const router = useRouter();
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [latest, setLatest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/admin/runs/${runId}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as {
          run?: { status: string } | null;
          events?: { message: string }[];
          error?: string;
        };
        if (cancelled) return;
        if (data.error) throw new Error(data.error);
        const events = data.events ?? [];
        setLatest(events[events.length - 1]?.message ?? null);
        setStatus(data.run?.status ?? null);
        if (data.run?.status === "running") {
          timer.current = setTimeout(() => void tick(), 1000);
          return;
        }
        // The run has stopped. What that *means* for the mission is Atlas's
        // answer, not this component's — re-read and let the page decide.
        router.refresh();
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not read the run.");
      }
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [runId, router]);

  const outstanding = unread + failed;
  if (outstanding === 0) return null;

  // Says what will actually be attempted, in the units the page already uses.
  // A failed page and an unread page are different facts, so when both exist
  // the label names both rather than adding them into one number.
  const label =
    unread > 0 && failed > 0
      ? `Read ${unread} page${unread === 1 ? "" : "s"} and retry ${failed} failed`
      : failed > 0
        ? `Retry ${failed} failed page${failed === 1 ? "" : "s"}`
        : `Read ${unread} page${unread === 1 ? "" : "s"}`;

  async function start() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/candidate-sources/run-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityIds }),
      });
      const data = (await res.json()) as { runId?: string; error?: string };
      if (!res.ok || !data.runId) {
        setError(data.error ?? "Atlas could not start the run.");
        return;
      }
      setRunId(data.runId);
      setStatus("running");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Atlas is unreachable.");
    } finally {
      setStarting(false);
    }
  }

  const running = status === "running";

  return (
    <div className="mt-4 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => void start()}
          disabled={starting || running}
          className="bg-foreground text-background inline-flex items-center rounded-lg px-4 py-2.5 text-[14px] font-semibold tracking-[-0.01em] transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {running ? "Reading…" : starting ? "Starting…" : label}
        </button>
        {runId && (
          <span className="text-muted-foreground font-mono text-[11px] tracking-[0.08em] uppercase">
            run {runId.slice(0, 8)}
          </span>
        )}
      </div>

      {/* Atlas's own words, verbatim. This component summarises nothing. */}
      {latest && (
        <p className="text-muted-foreground max-w-2xl text-[13px] leading-snug">
          {latest}
        </p>
      )}

      {/* A run that stopped is not a run that succeeded, and this says which
          without claiming what the mission now is. */}
      {status && status !== "running" && (
        <p className="text-muted-foreground text-[13px]">
          {status === "failed"
            ? "The run stopped on a failure. What each page produced is recorded against the entity it names; a page that failed stays listed and can be retried."
            : "The run finished. The page has been re-read — whatever changed is above."}
        </p>
      )}

      {error && (
        <p className="max-w-2xl text-[13px] text-amber-700 dark:text-amber-400">
          {error}
        </p>
      )}
    </div>
  );
}
