"use client";

import Link from "next/link";
import { useState } from "react";
import type { Experience } from "@/domain/experience/types";
import type { Point } from "@/domain/discovery/situation";
import type { Answer } from "@/lib/ai/ask/answer";
import type { FollowUp } from "@/lib/ai/ask/conversation";
import { PossibilityCard } from "./PossibilityCard";

/**
 * **Say what kind of day it is, and the page answers.**
 *
 * The front door of Discovery: one sentence in ordinary words — *"something
 * fun with the kids, not too far away"* — read into what Passport can act on,
 * answered at once with real Atlas places, each with the reason it is there.
 *
 * Not a chatbot (doctrine §3): no persona, no bubbles, no typing indicator.
 * What it keeps is the **conversation** — every sentence somebody has said,
 * so "about three hours" after "something with my daughter" is three hours
 * *with her*, and "actually, indoors" changes the sky and nothing else. The
 * sentences are on screen, small, so a wrong reading is visible and the way
 * back is one tap.
 *
 * At most one question at a time, and only under an answer (§4): results
 * come first, and a question is a shortcut with tap replies, never a gate.
 *
 * **The only text box on Discovery.** A name — "Davison Orchards" — is
 * answered here too (`findByName`); there used to be a second box for that,
 * above the results, and nobody could tell which one to use.
 */
export interface Starter {
  /** On the chip. */
  readonly label: string;
  /** What it says, read exactly as if it were typed. */
  readonly say: string;
}

/**
 * **Doors, not categories.** Each is a sentence handed to the same reader a
 * typed one goes to — nothing here is a filter, and anything else a person
 * types is understood the same way.
 */
export const STARTERS: readonly Starter[] = [
  { label: "Surprise me", say: "Surprise me" },
  { label: "With the kids", say: "Something fun with the kids" },
  { label: "Something different", say: "Something different" },
  { label: "Get outside", say: "Get outside" },
  { label: "Tonight", say: "Something to do tonight" },
  { label: "A great date", say: "A great date" },
  { label: "Rainy day", say: "It's raining — something indoors" },
];

/**
 * The starters in the order this moment suggests: a wet sky puts *Rainy day*
 * first; late in the day *Tonight* leads; after nine at night it is gone.
 */
export function startersFor(options: {
  readonly wet?: boolean;
  /** The hour where the subjects are, 0–23, from the server's clock. */
  readonly hour?: number;
}): readonly Starter[] {
  const { wet, hour } = options;
  let list = [...STARTERS];
  if (hour !== undefined && hour >= 21)
    list = list.filter((s) => s.label !== "Tonight");
  const lead = (label: string) => {
    const at = list.findIndex((s) => s.label === label);
    if (at > 0) list = [list[at]!, ...list.slice(0, at), ...list.slice(at + 1)];
  };
  if (hour !== undefined && hour >= 15 && hour < 21) lead("Tonight");
  if (wet) lead("Rainy day");
  return list;
}

/** Kept for callers that still name the old examples. */
export const EXAMPLE_QUESTIONS = STARTERS.map((s) => s.say);

export function AskDiscovery({
  said,
  onAsk,
  onClear,
  answer,
  understood,
  question,
  starters = STARTERS,
  alternatives = [],
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
  explore,
}: {
  /** Every sentence of the conversation so far, oldest first. */
  readonly said?: readonly string[];
  readonly onAsk: (said: string) => void;
  readonly onClear: () => void;
  readonly answer?: Answer;
  /** What the whole conversation adds up to, said back. */
  readonly understood: readonly string[];
  /** The one question worth asking now, where there is one. */
  readonly question?: FollowUp;
  readonly starters?: readonly Starter[];
  /** Other things to do around here, as sentences to say. */
  readonly alternatives?: readonly Starter[];
  /** *Make a day of these* — the conversation and the first picks, into `/go`. */
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
  /** The way into every activity — after the starters, and after the alternatives. */
  readonly explore?: React.ReactNode;
}) {
  const talking = (said?.length ?? 0) > 0;
  // **Empty once something is said.** The sentence is now in the
  // conversation above the box; leaving it in the box invites retyping it.
  const [draft, setDraft] = useState("");
  const [lastCount, setLastCount] = useState(said?.length ?? 0);
  if ((said?.length ?? 0) !== lastCount) {
    setLastCount(said?.length ?? 0);
    setDraft("");
  }

  const send = (text: string) => {
    const trimmed = text.trim();
    if (trimmed) onAsk(trimmed);
  };

  return (
    <div data-testid="ask-discovery" className="mt-5 sm:mt-7">
      {talking && (
        <ol
          data-testid="ask-conversation"
          aria-label="What you've said"
          className="mb-3 flex flex-wrap items-center gap-1.5 text-[13px] text-black/55"
        >
          {said!.map((sentence, index) => (
            <li
              key={`${index}-${sentence}`}
              data-testid="ask-turn"
              className="rounded-full bg-black/[0.045] px-3 py-1 font-medium text-[#111]/75"
            >
              “{sentence}”
            </li>
          ))}
          <li>
            <button
              type="button"
              data-testid="ask-clear"
              onClick={onClear}
              className="px-1.5 py-1 text-[12.5px] font-semibold text-black/45 underline underline-offset-4 hover:text-black/80"
            >
              Start over
            </button>
          </li>
        </ol>
      )}

      <form
        role="search"
        aria-label="Ask Discovery"
        className="flex flex-row gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          send(draft);
        }}
      >
        <input
          data-testid="ask-input"
          value={draft}
          maxLength={300}
          enterKeyHint="send"
          onChange={(event) => setDraft(event.target.value)}
          placeholder={
            talking
              ? "Add to it, or change your mind — “actually, indoors”…"
              : "Something fun with the kids nearby — or a place by name…"
          }
          aria-label={
            talking
              ? "Tell Passport more, or change your mind"
              : "What kind of day are you looking for?"
          }
          className="min-h-14 min-w-0 flex-1 rounded-full bg-white px-6 text-[17px] text-[#111] shadow-[0_1px_0_rgba(0,0,0,0.04)] ring-1 ring-black/20 ring-inset placeholder:text-black/35 focus:ring-2 focus:ring-black/60 focus:outline-none sm:min-h-16 sm:text-[19px]"
        />
        <button
          type="submit"
          data-testid="ask-submit"
          disabled={!draft.trim()}
          className="inline-flex min-h-14 shrink-0 items-center justify-center rounded-full bg-[#111] px-5 text-[15px] font-semibold text-white transition-colors hover:bg-[#3a2a1c] disabled:opacity-40 sm:min-h-16 sm:px-7 sm:text-[16px]"
        >
          {talking ? "Update" : "Show me"}
        </button>
      </form>

      {!talking && (
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {starters.map((starter) => (
            <button
              key={starter.label}
              type="button"
              data-testid="ask-example"
              onClick={() => send(starter.say)}
              className="inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-[14px] font-semibold whitespace-nowrap text-[#111]/75 ring-1 ring-black/15 transition-colors ring-inset hover:text-[#111] hover:ring-black/45"
            >
              {starter.label}
            </button>
          ))}
          {explore}
        </div>
      )}

      {talking && answer && (
        <section
          data-testid="ask-answer"
          aria-live="polite"
          className="mt-5 rounded-2xl p-4 sm:p-6"
          style={{
            backgroundColor: "color-mix(in srgb, var(--ghad-accent) 6%, white)",
          }}
        >
          <h2
            data-testid="ask-heading"
            className="ghad-display text-[26px] leading-[0.98] font-extrabold tracking-[-0.04em] text-[#111] sm:text-[38px]"
          >
            {answer.heading}
          </h2>

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
            </p>
          )}

          {question && answer.picks.length > 0 && (
            <div
              data-testid="ask-question"
              data-about={question.about}
              className="mt-3 flex flex-wrap items-center gap-2"
            >
              <span className="text-[15px] font-semibold text-[#111]">
                {question.text}
              </span>
              {question.replies.map((reply) => (
                <button
                  key={reply.label}
                  type="button"
                  data-testid="ask-reply"
                  onClick={() => send(reply.say)}
                  className="inline-flex min-h-10 items-center rounded-full bg-white px-3.5 text-[13.5px] font-semibold text-[#111]/80 ring-1 ring-black/15 ring-inset hover:ring-black/45"
                >
                  {reply.label}
                </button>
              ))}
            </div>
          )}

          <p
            data-testid={answer.unread ? "ask-unread" : "ask-note"}
            className={`mt-2 max-w-[76ch] text-[13px] leading-relaxed ${
              answer.unread ? "font-medium text-[#111]/75" : "text-black/50"
            }`}
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
              Try a bigger distance, another day, or say it another way — the
              full page is still under here.
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

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {dayHref && answer.picks.length > 0 && (
              <Link
                href={dayHref}
                data-testid="ask-make-a-day"
                className="inline-flex min-h-12 items-center rounded-full px-5 text-[15px] font-semibold"
                style={{
                  backgroundColor: "var(--ghad-accent)",
                  color: "var(--ghad-accent-ink)",
                }}
              >
                Make a day of it →
              </Link>
            )}
            {answer.picks.length > 0 && (
              <button
                type="button"
                data-testid="ask-different"
                onClick={() => send("Show me something completely different")}
                className="inline-flex min-h-12 items-center rounded-full bg-white px-5 text-[15px] font-semibold text-[#111]/80 ring-1 ring-black/15 ring-inset hover:ring-black/45"
              >
                Something different
              </button>
            )}
          </div>

          {(alternatives.length > 0 || explore) && (
            <div
              data-testid="ask-alternatives"
              className="mt-4 flex flex-wrap items-center gap-1.5"
            >
              {alternatives.length > 0 && (
                <span className="mr-1 text-[12.5px] font-semibold text-black/45">
                  Or around here:
                </span>
              )}
              {alternatives.map((alternative) => (
                <button
                  key={alternative.label}
                  type="button"
                  data-testid="ask-alternative"
                  onClick={() => send(alternative.say)}
                  className="inline-flex min-h-9 items-center rounded-full px-3 text-[13px] font-medium text-black/60 ring-1 ring-black/10 ring-inset hover:text-black/85 hover:ring-black/35"
                >
                  {alternative.label}
                </button>
              ))}
              {explore}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
