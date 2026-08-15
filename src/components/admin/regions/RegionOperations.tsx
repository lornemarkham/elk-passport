"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CircleDot,
  Loader2,
  Play,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";

/**
 * **The operation panel — where a curator asks Atlas to work and watches
 * it happen.**
 *
 * ## The problem it solves
 *
 * The workspace used to print a command and stop. A curator could read
 * what to type, run it in a terminal, and then had no way to know whether
 * anything happened except reloading the page and comparing numbers they
 * had not written down. Two questions went unanswered — *what do I do?*
 * and *did anything actually happen?* — and a page that leaves those open
 * is a page a person stops trusting.
 *
 * ## Why a button is allowed here when it was not before
 *
 * The standing rule is that Atlas does not start crawls from the browser,
 * because *a request that waited on a fetch, an LLM call and a merge would
 * time out.* That rule is about **waiting**, and this does not wait: the
 * API creates the run, returns its id in milliseconds, and does the work
 * in the background. The button starts something real and says so
 * immediately.
 *
 * ## Progress is the run's own events, not a second story
 *
 * Every line shown while growth is in flight is an `IngestionEvent` the
 * pipeline already writes for the Observatory. There is no parallel
 * progress channel that could describe the run differently from the run
 * page — if the workspace says a page was fetched, that exact event is in
 * Runs. **A progress bar that is not reading the real work is a
 * decoration, and eventually a lie.**
 *
 * Polling, not streaming. One request a second against localhost is
 * cheap, it survives a dropped connection with no reconnect logic, and it
 * is honest about being a poll — the alternative would be a socket added
 * for elegance rather than for a problem anyone has.
 *
 * ## Completion changes the page
 *
 * When the run finishes the panel summarises what changed and calls
 * `router.refresh()`, so health, coverage and the entity list re-render
 * from the server with the new state. **The evidence of an operation is
 * the page being different afterwards.** A summary without that would be
 * a claim the rest of the screen contradicts.
 */

/* -------------------------------------------------------------------------
 * Types — mirror what Atlas returns, nothing more.
 * ---------------------------------------------------------------------- */

interface RunEvent {
  id: string;
  sequence: number;
  stage: string;
  outcome: string;
  at: string;
  subject: string;
  message: string;
  entityId?: string;
}

interface RunSummary {
  id: string;
  status: "running" | "completed" | "failed";
  label: string;
  startedAt: string;
  finishedAt?: string;
}

export interface RecommendedAction {
  kind: "grow" | "review" | "nothing";
  title: string;
  why: string;
  willDo: readonly string[];
  queuedSources: number;
  estimatedSeconds: number | null;
}

export interface RegionOperationsProps {
  regionId: string;
  regionName: string;
  action: RecommendedAction;
  /** Coverage before the run, so completion can state the change truthfully. */
  coverageBefore: number | null;
  entitiesBefore: number;
  /** A run already in flight when the page loaded — Atlas may be working already. */
  activeRunId?: string | null;
  lastRun?: RunSummary | null;
}

type Phase = "idle" | "starting" | "running" | "done" | "error";

const POLL_MS = 1000;

export function RegionOperations({
  regionId,
  regionName,
  action,
  coverageBefore,
  entitiesBefore,
  activeRunId = null,
  lastRun = null,
}: RegionOperationsProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(activeRunId ? "running" : "idle");
  const [runId, setRunId] = useState<string | null>(activeRunId);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Follow the run until it stops.
   *
   * One self-cancelling loop inside the effect rather than a recursive
   * callback: unmounting or starting a second run flips `cancelled`, and
   * there is no way for an in-flight tick to write state afterwards. The
   * recursive version could, which is how a finished run's summary gets
   * overwritten by a stale poll from the previous one.
   */
  useEffect(() => {
    if (!runId) return;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/admin/runs/${runId}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as {
          run: RunSummary | null;
          events?: RunEvent[];
          error?: string;
        };
        if (cancelled) return;
        if (data.error) throw new Error(data.error);

        setEvents(data.events ?? []);

        if (data.run && data.run.status !== "running") {
          setPhase(data.run.status === "failed" ? "error" : "done");
          if (data.run.status === "failed") {
            setError(
              "The run finished with failures. Open it in Runs to see which.",
            );
          }
          // The whole point: the page must be different afterwards.
          router.refresh();
          return;
        }
        timer.current = setTimeout(() => void tick(), POLL_MS);
      } catch (e) {
        if (cancelled) return;
        setPhase("error");
        setError(
          e instanceof Error
            ? e.message
            : "Lost contact with Atlas while it was working.",
        );
      }
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [runId, router]);

  const start = async () => {
    if (timer.current) clearTimeout(timer.current);
    setPhase("starting");
    setError(null);
    setEvents([]);
    try {
      const res = await fetch(`/api/admin/regions/${regionId}/grow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as {
        runId?: string;
        error?: string;
        remedy?: string;
      };
      if (!res.ok || !data.runId) {
        setPhase("error");
        setError([data.error, data.remedy].filter(Boolean).join(" "));
        return;
      }
      setRunId(data.runId);
      setPhase("running");
    } catch (e) {
      setPhase("error");
      setError(
        e instanceof Error
          ? e.message
          : "Could not reach Atlas to start the run.",
      );
    }
  };

  const changes = summarise(events);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] font-medium tracking-wide uppercase">
          {phase === "running" || phase === "starting"
            ? "Atlas is working"
            : phase === "done"
              ? "Atlas finished"
              : "Atlas suggests"}
        </h2>
        <StatusLine phase={phase} lastRun={lastRun} />
      </div>

      <div
        className={`rounded-lg border transition-colors ${
          phase === "running" || phase === "starting"
            ? "border-emerald-600/40 bg-emerald-500/[0.04]"
            : phase === "done"
              ? "border-emerald-600/40 bg-emerald-500/[0.04]"
              : action.kind === "nothing"
                ? "border-border"
                : "border-foreground/25 bg-muted/30"
        }`}
      >
        {phase === "idle" || phase === "error" ? (
          <Proposal
            regionName={regionName}
            action={action}
            onStart={start}
            error={error}
          />
        ) : phase === "starting" || phase === "running" ? (
          <InFlight regionName={regionName} events={events} changes={changes} />
        ) : (
          <Complete
            regionName={regionName}
            changes={changes}
            coverageBefore={coverageBefore}
            entitiesBefore={entitiesBefore}
            runId={runId}
            onAgain={start}
          />
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------
 * Idle — what to do, and what will happen if you do it
 * ---------------------------------------------------------------------- */

function Proposal({
  regionName,
  action,
  onStart,
  error,
}: {
  regionName: string;
  action: RecommendedAction;
  onStart: () => void;
  error: string | null;
}) {
  return (
    <div className="p-5">
      <p className="text-sm font-medium">{action.title}</p>
      <p className="text-muted-foreground mt-1.5 max-w-2xl text-[13px] leading-relaxed">
        {action.why}
      </p>

      {/* What will happen, stated *before* it happens. A curator who can
          predict the outcome can trust the result. */}
      <p className="text-muted-foreground mt-4 text-[13px] font-medium">
        {action.kind === "grow"
          ? "If you run this, Atlas will:"
          : "What happens next:"}
      </p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {action.willDo.map((step) => (
          <li
            key={step}
            className="text-muted-foreground flex gap-2 text-[13px] leading-relaxed"
          >
            <span className="text-muted-foreground/50 select-none">•</span>
            {step}
          </li>
        ))}
      </ul>

      {action.kind === "grow" && (
        <p className="text-muted-foreground mt-4 text-[13px]">
          <span className="text-foreground font-medium tabular-nums">
            {action.queuedSources}
          </span>{" "}
          {action.queuedSources === 1 ? "page" : "pages"} queued
          {action.estimatedSeconds !== null ? (
            <>
              {" · "}~{action.estimatedSeconds}s, based on previous growth runs
            </>
          ) : (
            // An estimate with no history behind it would be a number that
            // looks like evidence. Say there is none.
            <> · no previous run to estimate the time from</>
          )}
        </p>
      )}

      {error && (
        <p className="mt-4 flex items-start gap-2 text-[13px] text-amber-700 dark:text-amber-400">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {action.kind === "grow" ? (
          <button
            onClick={onStart}
            className="bg-foreground text-background inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-opacity hover:opacity-90"
          >
            <Play className="h-3.5 w-3.5" />
            Grow {regionName}
          </button>
        ) : action.kind === "review" ? (
          <Link
            href="/admin/review"
            className="bg-foreground text-background inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-opacity hover:opacity-90"
          >
            Review findings
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <button
            onClick={onStart}
            className="border-border hover:bg-muted/40 inline-flex items-center gap-2 rounded-md border px-3.5 py-2 text-sm font-medium transition-colors"
          >
            <Play className="h-3.5 w-3.5" />
            Grow anyway
          </button>
        )}
        <span className="text-muted-foreground text-[13px]">
          Runs in the background. You can stay on this page.
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Running — the run's own events, as they arrive
 * ---------------------------------------------------------------------- */

function InFlight({
  regionName,
  events,
  changes,
}: {
  regionName: string;
  events: RunEvent[];
  changes: Changes;
}) {
  const recent = events.slice(-6).reverse();
  const current = events[events.length - 1];

  return (
    <div className="p-5">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Loader2 className="h-4 w-4 animate-spin" />
        Atlas is learning about {regionName}…
      </p>

      {/* Indeterminate on purpose. Atlas cannot know how many pages a run
          will end up reading — a candidate may be skipped, refused at
          verification, or already current — and a bar that claims a
          percentage it cannot compute is a fabricated number with a
          progress animation on it. */}
      <div className="bg-muted mt-4 h-1 w-full overflow-hidden rounded-full">
        <div className="bg-foreground/60 h-full w-1/3 animate-[pulse_1.4s_ease-in-out_infinite] rounded-full" />
      </div>

      <p className="text-muted-foreground mt-3 text-[13px]">
        {current ? (
          <>
            <span className="text-foreground">{stageLabel(current.stage)}</span>{" "}
            — {current.subject}
          </>
        ) : (
          "Starting…"
        )}
      </p>

      {recent.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5">
          {recent.map((e) => (
            <li key={e.id} className="flex gap-2 text-[13px]">
              <CircleDot className="text-muted-foreground/40 mt-1 h-3 w-3 shrink-0" />
              <span className="min-w-0">
                <span className="text-muted-foreground">
                  {stageLabel(e.stage)}
                </span>{" "}
                <span className="text-foreground/80">{e.subject}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {(changes.created > 0 || changes.enriched > 0 || changes.facts > 0) && (
        <p className="text-muted-foreground mt-4 text-[13px]">
          Atlas has found so far:{" "}
          {[
            changes.created > 0 && `${changes.created} new`,
            changes.enriched > 0 && `${changes.enriched} enriched`,
            changes.facts > 0 && `${changes.facts} facts`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Complete — what changed, and the honest zero
 * ---------------------------------------------------------------------- */

function Complete({
  regionName,
  changes,
  coverageBefore,
  entitiesBefore,
  runId,
  onAgain,
}: {
  regionName: string;
  changes: Changes;
  coverageBefore: number | null;
  entitiesBefore: number;
  runId: string | null;
  onAgain: () => void;
}) {
  const nothingChanged =
    changes.created === 0 && changes.enriched === 0 && changes.facts === 0;

  return (
    <div className="p-5">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
        Atlas finished growing {regionName}
      </p>

      {nothingChanged ? (
        // The most misread outcome in the product. A run that changes
        // nothing is a *correct* run over a current corpus, and saying so
        // in plain English is the difference between "it worked" and "it
        // is broken".
        <p className="text-muted-foreground mt-2 max-w-2xl text-[13px] leading-relaxed">
          Nothing changed, and that is the expected result of a second run:
          every page Atlas knew about had already been read and nothing it found
          was new. Growth adds knowledge when there is new knowledge to add — an
          empty run is Atlas being current, not Atlas failing.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1">
          {changes.created > 0 && (
            <Result value={`+${changes.created}`} label="new entities" />
          )}
          {changes.enriched > 0 && (
            <Result value={`+${changes.enriched}`} label="entities enriched" />
          )}
          {changes.facts > 0 && (
            <Result value={`+${changes.facts}`} label="facts added" />
          )}
          {changes.queued > 0 && (
            <Result
              value={`+${changes.queued}`}
              label="pages queued for next time"
            />
          )}
        </ul>
      )}

      {changes.touched.length > 0 && (
        <div className="mt-4">
          <p className="text-muted-foreground text-[13px] font-medium">
            Atlas changed:
          </p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {changes.touched.map((name) => (
              <li
                key={name}
                className="bg-muted rounded px-2 py-0.5 text-[13px]"
              >
                {name}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-2 text-[13px]">
            These are marked{" "}
            <span className="rounded bg-emerald-600/15 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-emerald-700 uppercase dark:text-emerald-400">
              new
            </span>{" "}
            or{" "}
            <span className="rounded bg-sky-600/15 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-sky-700 uppercase dark:text-sky-400">
              updated
            </span>{" "}
            in the list below.
          </p>
        </div>
      )}

      {changes.queued > 0 && (
        <p className="text-muted-foreground mt-3 max-w-2xl text-[13px] leading-relaxed">
          Pages discovered during a run are never read by that same run. Each
          generation is a separate, deliberate step — which is what keeps growth
          legible while it happens instead of becoming a crawl.
        </p>
      )}

      <p className="text-muted-foreground mt-4 text-[13px]">
        Coverage before this run:{" "}
        {coverageBefore === null ? "—" : `${coverageBefore}%`} ·{" "}
        {entitiesBefore} entities. The page below has re-read Atlas — compare it
        to see the change.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href="/admin/review"
          className="bg-foreground text-background inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-opacity hover:opacity-90"
        >
          Review changes
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <button
          onClick={onAgain}
          className="border-border hover:bg-muted/40 inline-flex items-center gap-2 rounded-md border px-3.5 py-2 text-sm font-medium transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Grow again
        </button>
        {runId && (
          <Link
            href={`/admin/runs/${runId}`}
            className="text-muted-foreground hover:text-foreground text-[13px] underline-offset-4 hover:underline"
          >
            Technical detail in Runs
          </Link>
        )}
      </div>
    </div>
  );
}

function Result({ value, label }: { value: string; label: string }) {
  return (
    <li className="flex items-baseline gap-2 text-sm">
      <span className="font-medium tabular-nums">{value}</span>
      <span className="text-muted-foreground text-[13px]">{label}</span>
    </li>
  );
}

/* -------------------------------------------------------------------------
 * Status — never leave the curator wondering
 * ---------------------------------------------------------------------- */

function StatusLine({
  phase,
  lastRun,
}: {
  phase: Phase;
  lastRun: RunSummary | null;
}) {
  if (phase === "running" || phase === "starting") {
    return (
      <span className="flex items-center gap-1.5 text-[13px] text-emerald-700 dark:text-emerald-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Atlas is working
      </span>
    );
  }
  if (phase === "error") {
    return (
      <span className="flex items-center gap-1.5 text-[13px] text-amber-700 dark:text-amber-400">
        <TriangleAlert className="h-3.5 w-3.5" />
        Something went wrong
      </span>
    );
  }
  return (
    <span className="text-muted-foreground flex items-center gap-1.5 text-[13px]">
      <Check className="h-3.5 w-3.5" />
      Atlas is idle
      {lastRun?.finishedAt && <> · last run {lastRun.status}</>}
    </span>
  );
}

/* -------------------------------------------------------------------------
 * Reading the run
 * ---------------------------------------------------------------------- */

interface Changes {
  created: number;
  enriched: number;
  facts: number;
  queued: number;
  /** Which entities, by name. The claim and its evidence on one screen. */
  touched: string[];
}

/**
 * What the run did, counted from its own events.
 *
 * Deliberately derived rather than reported separately: the summary and
 * the Observatory then cannot disagree, because they are the same rows.
 */
function summarise(events: readonly RunEvent[]): Changes {
  let created = 0;
  let enriched = 0;
  let facts = 0;
  let queued = 0;
  const touched = new Set<string>();
  for (const e of events) {
    if (e.stage === "entity-created") {
      created += 1;
      if (e.subject) touched.add(e.subject);
    } else if (e.stage === "entity-enriched") {
      enriched += 1;
      if (e.subject) touched.add(e.subject);
      // "+3 facts" appears in the event's own message; counting the
      // leading number is reading what the pipeline wrote, not inventing.
      const m = /(\d+)/.exec(e.message);
      if (m) facts += Number(m[1]);
    } else if (e.stage === "source-discovered" || e.stage === "source-queued") {
      queued += 1;
    }
  }
  return { created, enriched, facts, queued, touched: [...touched] };
}

const STAGE_WORDS: Record<string, string> = {
  "run-started": "Started",
  "source-discovered": "Discovered",
  "source-queued": "Queued",
  "source-fetched": "Read",
  "source-verified": "Verified",
  "knowledge-extracted": "Understood",
  "entity-created": "Created",
  "entity-matched": "Matched",
  "entity-enriched": "Enriched",
  "run-failed": "Failed",
  "run-finished": "Finished",
};

function stageLabel(stage: string): string {
  return STAGE_WORDS[stage] ?? stage.replace(/-/g, " ");
}
