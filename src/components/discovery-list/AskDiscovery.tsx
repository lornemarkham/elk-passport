"use client";

import Link from "next/link";
import { useState } from "react";
import type { Experience } from "@/domain/experience/types";
import type { Point } from "@/domain/discovery/situation";
import type { Answer } from "@/lib/ai/ask/answer";
import { PossibilityCard } from "./PossibilityCard";

/**
 * **Say it, and the page answers.**
 *
 * One box under the page's own question, for somebody who already knows how
 * they would put it: *"what can we do with three hours?"*. Not a chatbot —
 * no persona, no thread, no typing indicator (doctrine §3). The sentence sets
 * the same rows a tap would, the rows below visibly change, and a short
 * answer appears here with the reason for every pick.
 *
 * The four examples are real questions, tappable, so nobody has to invent
 * the first sentence. They are doors, not a questionnaire (§4): nothing is
 * asked of anyone who would rather tap the rows.
 */
export const EXAMPLE_QUESTIONS = [
  "What can we do with three hours?",
  "What's something unusual nearby?",
  "Where can I take my kid this afternoon?",
  "What is worth driving an hour for?",
] as const;

export function AskDiscovery({
  said,
  onAsk,
  onClear,
  answer,
  understood,
  dayHref,
  dayHrefFor,
  today,
  home,
  origin,
  carry,
  savedIds,
  savingId,
  onSave,
  originPicker,
}: {
  /** The question on screen, where there is one. */
  readonly said?: string;
  readonly onAsk: (said: string) => void;
  readonly onClear: () => void;
  readonly answer?: Answer;
  /** What the sentence was read as, said back. */
  readonly understood: readonly string[];
  /** *Make a day of these* — the sentence and the first picks, into `/go`. */
  readonly dayHref?: string;
  readonly dayHrefFor: (experience: Experience) => string;
  readonly today?: string;
  readonly home?: string;
  readonly origin?: Point;
  readonly carry?: string;
  readonly savedIds: ReadonlySet<string>;
  readonly savingId: string | null;
  readonly onSave: (experience: Experience) => void;
  /** Offered under the "from where?" gap, so the question and its answer meet. */
  readonly originPicker?: React.ReactNode;
}) {
  // **Keyed to the question, not copied in an effect.** A new `said` (a
  // tapped example, a back button) replaces the draft during render.
  const [draft, setDraft] = useState(said ?? "");
  const [lastSaid, setLastSaid] = useState(said);
  if (said !== lastSaid) {
    setLastSaid(said);
    setDraft(said ?? "");
  }

  return (
    <div data-testid="ask-discovery" className="mt-5 sm:mt-7">
      <form
        role="search"
        aria-label="Ask Discovery"
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim()) onAsk(draft.trim());
        }}
      >
        <input
          data-testid="ask-input"
          value={draft}
          maxLength={300}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Or just say it — three hours, a kid, something weird…"
          aria-label="Say what kind of time you have"
          className="min-h-12 flex-1 rounded-full bg-white px-5 text-[16px] text-[#111] ring-1 ring-black/15 ring-inset placeholder:text-black/35 focus:ring-2 focus:ring-black/50 focus:outline-none"
        />
        <button
          type="submit"
          data-testid="ask-submit"
          disabled={!draft.trim()}
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#111] px-6 text-[15px] font-semibold text-white transition-colors hover:bg-[#3a2a1c] disabled:opacity-40"
        >
          Show me
        </button>
      </form>

      {!said && (
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {EXAMPLE_QUESTIONS.map((question) => (
            <button
              key={question}
              type="button"
              data-testid="ask-example"
              onClick={() => onAsk(question)}
              className="inline-flex min-h-10 shrink-0 items-center rounded-full px-3.5 text-[13.5px] font-medium whitespace-nowrap text-black/60 ring-1 ring-black/10 transition-colors ring-inset hover:text-black/85 hover:ring-black/35"
            >
              {question}
            </button>
          ))}
        </div>
      )}

      {said && answer && (
        <section
          data-testid="ask-answer"
          aria-live="polite"
          className="mt-5 rounded-2xl p-4 sm:p-6"
          style={{
            backgroundColor: "color-mix(in srgb, var(--ghad-accent) 6%, white)",
          }}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <h2
              data-testid="ask-heading"
              className="ghad-display text-[26px] leading-[0.98] font-extrabold tracking-[-0.04em] text-[#111] sm:text-[38px]"
            >
              {answer.heading}
            </h2>
            <button
              type="button"
              data-testid="ask-clear"
              onClick={onClear}
              className="text-[13px] font-semibold text-black/45 underline underline-offset-4 hover:text-black/80"
            >
              Clear the question
            </button>
          </div>

          {understood.length > 0 && (
            <p
              data-testid="ask-understood"
              className="mt-2 flex flex-wrap items-center gap-1.5 text-[12.5px] text-black/55"
            >
              <span>Heard:</span>
              {understood.map((part) => (
                <span
                  key={part}
                  className="rounded-full bg-white px-2.5 py-0.5 font-semibold text-[#111]/80 ring-1 ring-black/10 ring-inset"
                >
                  {part}
                </span>
              ))}
              <span className="text-black/40">— change any of it below.</span>
            </p>
          )}

          <p
            data-testid="ask-note"
            className="mt-2 max-w-[76ch] text-[13px] leading-relaxed text-black/50"
          >
            {answer.note}
          </p>

          {answer.gaps.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {answer.gaps.map((gap) => (
                <li
                  key={gap.about}
                  data-testid={`ask-gap-${gap.about}`}
                  className="text-[13px] font-semibold text-[#111]/75"
                >
                  {gap.text}
                  {gap.about === "origin" && originPicker}
                </li>
              ))}
            </ul>
          )}

          {answer.picks.length === 0 ? (
            <p
              data-testid="ask-empty"
              className="mt-4 rounded-xl border border-dashed border-black/25 bg-white px-4 py-8 text-center text-sm text-black/60"
            >
              Nothing Atlas holds fits that well enough to offer as an answer.
              Try a bigger distance, another day, or fewer of the choices below
              — the full page is still under here.
            </p>
          ) : (
            <ul className="-mx-4 mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-4 pb-2 sm:-mx-6 sm:gap-6 sm:px-6">
              {answer.picks.map((pick, index) => (
                <PossibilityCard
                  key={pick.experience.id}
                  className="w-[78vw] shrink-0 snap-start sm:w-[320px] lg:w-[340px]"
                  experience={pick.experience}
                  priority={index < 3}
                  because={pick.reasons}
                  {...(pick.caveat ? { caveat: pick.caveat } : {})}
                  dayHref={dayHrefFor(pick.experience)}
                  {...(today ? { today } : {})}
                  {...(home ? { home } : {})}
                  {...(origin ? { origin } : {})}
                  {...(carry ? { carry } : {})}
                  saved={savedIds.has(pick.experience.id)}
                  saving={savingId === pick.experience.id}
                  onSave={() => onSave(pick.experience)}
                />
              ))}
            </ul>
          )}

          {dayHref && answer.picks.length > 0 && (
            <Link
              href={dayHref}
              data-testid="ask-make-a-day"
              className="mt-4 inline-flex min-h-12 items-center rounded-full px-5 text-[15px] font-semibold"
              style={{
                backgroundColor: "var(--ghad-accent)",
                color: "var(--ghad-accent-ink)",
              }}
            >
              Make a day of it →
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
