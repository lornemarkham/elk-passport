"use client";

import { useImperativeHandle, useRef, useState, type Ref } from "react";
import {
  ArrowRight,
  Check,
  MessageCircle,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import type { NightDay } from "@/domain/date-night/adventures";
import type { Evening } from "@/domain/date-night/adventures/evenings";
import {
  clock,
  homeAt,
  warningsFor,
  type PlanStop,
} from "@/domain/date-night/adventures/itinerary";
import {
  diffPlans,
  EXAMPLES,
  readRequest,
  UNDERSTANDS,
  type Reading,
} from "@/domain/date-night/adventures/say";
import { cn } from "@/lib/utils";

export interface MakeItOursHandle {
  ask(said: string): void;
}

/**
 * **Make it ours** — one sentence, read against the itinerary already on the
 * page (`say.ts`, in the browser, no model and no server until it's
 * applied), answered with what would change: each stop's time before → after,
 * what's new and what goes. The owner applies it to the same itinerary and
 * can undo; the other person sends it as a suggestion. Not a chatbot: no
 * thread, no persona (doctrine §3). And not dressed up as one: the box says
 * it reads by rules, what those rules understand, and that places only come
 * from what Atlas has checked. After a change, what changed stays in view
 * beside Undo until the next one.
 */
export function MakeItOurs({
  stops,
  evening,
  day,
  sunset,
  isOwner,
  ownerName,
  busy,
  canUndo,
  handle,
  onApply,
  onUndo,
  onSuggest,
}: {
  readonly stops: readonly PlanStop[];
  readonly evening: Evening | undefined;
  readonly day: NightDay;
  readonly sunset: number;
  readonly isOwner: boolean;
  readonly ownerName: string | null;
  readonly busy: boolean;
  readonly canUndo: boolean;
  readonly handle?: Ref<MakeItOursHandle>;
  readonly onApply: (
    stops: readonly PlanStop[],
    heard: readonly string[],
  ) => Promise<boolean>;
  readonly onUndo: () => void;
  readonly onSuggest: (said: string) => Promise<boolean>;
}) {
  const [said, setSaid] = useState("");
  const [reading, setReading] = useState<{ said: string; r: Reading } | null>(
    null,
  );
  const [applied, setApplied] = useState<readonly string[] | null>(null);
  const box = useRef<HTMLElement>(null);

  function ask(words: string) {
    const text = words.trim();
    if (!text) return;
    setSaid(text);
    setApplied(null);
    setReading({
      said: text,
      r: readRequest(text, stops, evening, day, sunset),
    });
  }

  useImperativeHandle(handle, () => ({
    ask: (words: string) => {
      box.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      ask(words);
    },
  }));

  const r = reading?.r;
  const rows = r?.kind === "change" ? diffPlans(stops, r.stops) : [];
  const warnings =
    r?.kind === "change" ? warningsFor(r.stops, sunset, evening, day) : [];

  return (
    <section
      ref={box}
      id="ours"
      aria-labelledby="ours-heading"
      data-testid="change-box"
      className="scroll-mt-16 rounded-[28px] bg-[var(--n-ink)] p-5 text-[var(--n-cream)] sm:p-7"
    >
      <p className="text-xs font-extrabold tracking-[0.22em] text-[var(--n-amber)] uppercase">
        Make it ours
      </p>
      <h2
        id="ours-heading"
        className="ghad-display mt-1 flex items-center gap-2 text-[28px] leading-none font-extrabold uppercase"
      >
        <MessageCircle className="h-6 w-6" aria-hidden /> Just say it
      </h2>
      <p className="mt-2 max-w-md text-[14px] leading-snug text-[var(--n-cream)]/70">
        Tell Passport what you want different. You&apos;ll see exactly what
        changes before anything does.
      </p>
      <form
        className="mt-4 flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(said);
        }}
      >
        <label className="block">
          <span className="sr-only">What should change?</span>
          <input
            data-testid="change-input"
            value={said}
            maxLength={200}
            onChange={(e) => setSaid(e.target.value)}
            placeholder="More time at the lake, home by eight…"
            className="block min-h-14 w-full rounded-full border-2 border-white/25 bg-white/10 px-5 text-base text-white placeholder:text-white/55 focus:border-white focus:outline-none"
          />
        </label>
        <button
          type="submit"
          data-testid="change-submit"
          disabled={!said.trim()}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--n-amber)] px-6 font-bold text-[var(--n-ink)] disabled:opacity-50"
        >
          <ArrowRight className="h-5 w-5" aria-hidden /> Show me what changes
        </button>
      </form>

      {!reading && (
        <div
          className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1 sm:flex-wrap"
          aria-label="Try saying"
        >
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => ask(example)}
              className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-white/25 px-4 text-sm font-semibold text-white/90 hover:bg-white/10"
            >
              {example}
            </button>
          ))}
        </div>
      )}

      {r && (
        <div
          role="status"
          data-testid="change-preview"
          className="mt-4 rounded-3xl bg-[var(--n-cream)] p-4 text-[var(--n-ink)]"
        >
          {r.kind === "none" ? (
            <p data-testid="change-reply">{r.reply}</p>
          ) : (
            <>
              <ul className="space-y-1 text-[15px] font-semibold">
                {r.heard.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
              <ol className="mt-3 divide-y divide-black/5 rounded-2xl bg-white px-3 text-[14px]">
                {rows.map((row, i) => (
                  <li
                    key={`${row.title}-${i}`}
                    data-change={row.change}
                    className={cn(
                      "flex items-baseline gap-2 py-1.5",
                      row.change === "gone" &&
                        "text-[var(--n-ink)]/45 line-through",
                      (row.change === "new" || row.change === "moved") &&
                        "font-bold",
                    )}
                  >
                    <span className="w-[112px] shrink-0 tabular-nums">
                      {row.change === "new"
                        ? `new · ${clock(row.after!)}`
                        : row.change === "gone"
                          ? clock(row.before!)
                          : row.change === "moved" && row.before !== row.after
                            ? `${clock(row.before!).replace(/ (am|pm)$/, "")} → ${clock(row.after!)}`
                            : clock(row.after!)}
                    </span>
                    <span className="min-w-0">{row.title}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-[13px] text-[var(--n-ink)]/60">
                Home about {clock(homeAt(r.stops)!)} instead of{" "}
                {clock(homeAt(stops)!)}.
              </p>
              {warnings.map((w) => (
                <p
                  key={w.line}
                  className="mt-1.5 flex items-start gap-1.5 text-[13px] font-semibold text-[#9a3b10]"
                >
                  <TriangleAlert
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                    aria-hidden
                  />
                  {w.line}
                </p>
              ))}
            </>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {r.kind === "change" && (
              <button
                type="button"
                data-testid="change-apply"
                disabled={busy}
                onClick={async () => {
                  const ok = isOwner
                    ? await onApply(r.stops, r.heard)
                    : await onSuggest(reading!.said);
                  if (ok) {
                    setReading(null);
                    setSaid("");
                    if (isOwner) setApplied(r.heard);
                  }
                }}
                className="min-h-12 rounded-full bg-[var(--n-forest)] px-6 font-bold text-white disabled:opacity-50"
              >
                {isOwner
                  ? "Make it so"
                  : `Suggest it to ${ownerName ?? "the planner"}`}
              </button>
            )}
            <button
              type="button"
              onClick={() => setReading(null)}
              className="min-h-12 rounded-full px-5 font-bold ring-1 ring-black/15"
            >
              {r.kind === "none" ? "OK" : "Leave it as it is"}
            </button>
          </div>
        </div>
      )}

      {canUndo && !reading && (
        <div
          className="mt-4 rounded-3xl bg-white/[0.07] p-4 ring-1 ring-white/10"
          data-testid="change-done"
        >
          {applied && (
            <>
              <p className="flex items-center gap-1.5 text-[12px] font-extrabold tracking-[0.16em] text-[var(--n-amber)] uppercase">
                <Check className="h-4 w-4" aria-hidden /> What changed
              </p>
              <ul className="mt-1.5 space-y-1 text-[14px] text-[var(--n-cream)]/85">
                {applied.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </>
          )}
          <button
            type="button"
            data-testid="change-undo"
            disabled={busy}
            onClick={() => {
              setApplied(null);
              onUndo();
            }}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-bold",
              applied && "mt-3",
            )}
          >
            <Undo2 className="h-4 w-4" aria-hidden /> Undo the last change
          </button>
        </div>
      )}

      <details className="group mt-4 text-[13px] text-[var(--n-cream)]/60">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 font-semibold underline decoration-white/25 underline-offset-4">
          How Passport reads this
        </summary>
        <p className="mt-1 max-w-lg leading-snug" data-testid="change-honesty">
          By rules, not AI: it understands {UNDERSTANDS.slice(0, -1).join(", ")}{" "}
          and {UNDERSTANDS[UNDERSTANDS.length - 1]}. Times come from the sunset
          and each stop&apos;s length. A new place only ever comes from the
          places Atlas has checked for this night; if none fits, it says so
          rather than making one up.
        </p>
      </details>
    </section>
  );
}
