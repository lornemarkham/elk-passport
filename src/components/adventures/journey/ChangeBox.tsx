"use client";

import { useImperativeHandle, useRef, useState, type Ref } from "react";
import { ArrowRight, Loader2, MessageCircle, Undo2 } from "lucide-react";
import type { ChangePreview, DayChange } from "@/lib/adventures/propose";
import { weekdayLabel } from "@/lib/adventures/present";
import { cn } from "@/lib/utils";
import { pillClass } from "../kit";

/** What the page may ask of the change box. */
export interface ChangeHandle {
  ask(said: string): void;
}

type Applied =
  | { kind: "days"; changes: readonly DayChange[] }
  | { kind: "swap"; days: readonly [string, string] };

const EXAMPLES = [
  "Make it more adventurous",
  "We're bringing a five-year-old",
  "Find somewhere better for lunch",
  "Keep everything within 30 minutes",
  "Make it cheaper",
  "Give us a rainy-day alternative",
  "Less demanding",
];

/**
 * **Shape the adventure in words** (ADR 012 §3; doctrine §2.5, §3).
 *
 * Not a chatbot: no persona, no thread. One sentence, an answer that says
 * what it understood and exactly what would change, day by day — and only
 * then _Apply_. After applying, _Undo_ puts every changed day back the way
 * it was. Kept stops never move. A sentence the reader does not understand
 * changes nothing and says so.
 *
 * The owner applies; anyone else's _Apply_ is _Suggest these_ — the new
 * stops arrive as ideas for the owner (ADR 010 §5).
 */
export function ChangeBox({
  isOwner,
  call,
  act,
  busy,
  handle,
  hasDays,
}: {
  readonly isOwner: boolean;
  readonly call: <T = unknown>(
    path: string,
    method: string,
    body?: unknown,
  ) => Promise<T>;
  readonly act: (
    work: () => Promise<unknown>,
    done?: string,
  ) => Promise<boolean>;
  readonly busy: boolean;
  /** How the rest of the page asks for a change (Replace, Sketch this day). */
  readonly handle?: Ref<ChangeHandle>;
  readonly hasDays: boolean;
}) {
  const [said, setSaid] = useState("");
  const [asking, setAsking] = useState(false);
  const [preview, setPreview] = useState<ChangePreview | null>(null);
  const [applied, setApplied] = useState<Applied | null>(null);
  const box = useRef<HTMLDivElement>(null);

  async function ask(words: string) {
    const text = words.trim();
    if (!text) return;
    setSaid(text);
    setAsking(true);
    setPreview(null);
    try {
      setPreview(await call<ChangePreview>("/change", "POST", { said: text }));
    } catch (error) {
      setPreview({ kind: "none", reply: (error as Error).message });
    } finally {
      setAsking(false);
    }
  }

  useImperativeHandle(handle, () => ({
    ask: (words: string) => {
      box.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      void ask(words);
    },
  }));

  async function apply() {
    if (!preview || preview.kind === "none") return;
    const done =
      preview.kind === "swap"
        ? await act(
            () => call("/swap", "POST", { days: preview.days }),
            `Swapped ${weekdayLabel(preview.days[0])} and ${weekdayLabel(preview.days[1])}.`,
          )
        : await act(
            async () => {
              for (const change of preview.changes)
                await call("/days", "POST", {
                  query: change.query,
                  mode: "propose",
                });
            },
            isOwner
              ? `Changed ${preview.changes.map((c) => weekdayLabel(c.onDay)).join(" and ")}.`
              : "Suggested to the organiser.",
          );
    if (!done) return;
    if (isOwner)
      setApplied(
        preview.kind === "swap"
          ? { kind: "swap", days: preview.days }
          : { kind: "days", changes: preview.changes },
      );
    setPreview(null);
    setSaid("");
  }

  async function undo() {
    if (!applied) return;
    const ok = await act(async () => {
      if (applied.kind === "swap") {
        await call("/swap", "POST", { days: applied.days });
        return;
      }
      for (const change of applied.changes) {
        if (change.undo)
          await call("/days", "POST", { query: change.undo, mode: "propose" });
        else await call("/days", "POST", { clear: change.onDay });
      }
    }, "Put back the way it was.");
    if (ok) setApplied(null);
  }

  return (
    <section
      ref={box}
      aria-labelledby="change-heading"
      data-testid="change-box"
      className="rounded-[28px] bg-[var(--gh-ink)] p-5 text-white sm:p-7"
    >
      <h2
        id="change-heading"
        className="ghad-display flex items-center gap-2 text-2xl font-extrabold tracking-[-0.02em] sm:text-3xl"
      >
        <MessageCircle className="h-6 w-6" aria-hidden />
        Change anything. Just say it.
      </h2>
      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(said);
        }}
      >
        <label className="block flex-1">
          <span className="sr-only">What should change?</span>
          <input
            data-testid="change-input"
            value={said}
            maxLength={300}
            onChange={(e) => setSaid(e.target.value)}
            disabled={!hasDays}
            placeholder={
              hasDays
                ? "Make Saturday more adventurous…"
                : "Give the adventure dates first"
            }
            className="block min-h-14 w-full rounded-full border-2 border-white/25 bg-white/10 px-5 text-lg text-white placeholder:text-white/60 focus:border-white focus:outline-none"
          />
        </label>
        <button
          type="submit"
          data-testid="change-submit"
          disabled={asking || !said.trim() || !hasDays}
          className={pillClass("light", "min-h-14 px-6 text-lg")}
        >
          {asking ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : (
            <ArrowRight className="h-5 w-5" aria-hidden />
          )}
          {asking ? "Thinking…" : "Show me"}
        </button>
      </form>
      {hasDays && !preview && !applied && (
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Try saying">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => void ask(example)}
              className="inline-flex min-h-11 items-center rounded-full border border-white/25 px-4 text-sm font-semibold text-white/90 hover:bg-white/10"
            >
              {example}
            </button>
          ))}
        </div>
      )}

      {preview && (
        <div
          role="status"
          data-testid="change-preview"
          className="mt-5 rounded-3xl bg-white p-4 text-[var(--gh-ink)] sm:p-6"
        >
          {preview.kind === "none" ? (
            <p className="text-base" data-testid="change-reply">
              {preview.reply}
            </p>
          ) : preview.kind === "swap" ? (
            <p className="text-base font-semibold">{preview.heard.join(" ")}</p>
          ) : (
            <div className="space-y-5">
              {preview.changes.map((change) => (
                <div key={change.onDay} data-testid="change-day">
                  <p className="ghad-display text-xl font-extrabold">
                    {weekdayLabel(change.onDay)}
                  </p>
                  <p className="mt-1 text-sm text-[var(--gh-ink-soft)]">
                    {change.heard.join(" ")}
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <StopList
                      title="Now"
                      stops={change.before}
                      other={change.after}
                      gone
                    />
                    <StopList
                      title="After"
                      stops={change.after}
                      other={change.before}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            {preview.kind !== "none" && (
              <button
                type="button"
                data-testid="change-apply"
                disabled={busy}
                onClick={() => void apply()}
                className={pillClass("forest")}
              >
                {isOwner ? "Apply it" : "Suggest these"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setPreview(null)}
              className={pillClass("quiet")}
            >
              {preview.kind === "none" ? "OK" : "Leave it as it is"}
            </button>
          </div>
        </div>
      )}

      {applied && !preview && (
        <div
          data-testid="change-applied"
          className="mt-4 flex flex-wrap items-center gap-3 rounded-full bg-white/10 py-2 pr-2 pl-5"
        >
          <p className="mr-auto text-base font-semibold">
            Done.{" "}
            {applied.kind === "swap"
              ? "The days are swapped."
              : `${applied.changes.map((c) => weekdayLabel(c.onDay)).join(" and ")} changed.`}
          </p>
          <button
            type="button"
            data-testid="change-undo"
            disabled={busy}
            onClick={() => void undo()}
            className={pillClass("light")}
          >
            <Undo2 className="h-4 w-4" aria-hidden />
            Undo
          </button>
        </div>
      )}
    </section>
  );
}

function StopList({
  title,
  stops,
  other,
  gone = false,
}: {
  readonly title: string;
  readonly stops: DayChange["before"];
  readonly other: DayChange["before"];
  readonly gone?: boolean;
}) {
  const ids = new Set(other.map((s) => s.id));
  return (
    <div className="rounded-2xl bg-[var(--gh-cream)] p-3">
      <p className="text-xs font-bold tracking-[0.12em] text-[var(--gh-ink-soft)] uppercase">
        {title}
      </p>
      {stops.length === 0 ? (
        <p className="mt-1 text-sm text-[var(--gh-ink-soft)]">Nothing yet</p>
      ) : (
        <ol className="mt-1 space-y-1">
          {stops.map((stop, i) => {
            const changed = !ids.has(stop.id);
            return (
              <li
                key={stop.id}
                className={cn(
                  "text-sm",
                  changed && gone && "text-[var(--gh-ink-soft)] line-through",
                  changed && !gone && "font-bold text-[var(--gh-forest)]",
                )}
              >
                {i + 1}. {stop.title}
                {stop.kept ? " · kept" : ""}
                {changed && !gone ? " · new" : ""}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
