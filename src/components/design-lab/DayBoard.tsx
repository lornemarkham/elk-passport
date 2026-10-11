"use client";

import { useState } from "react";
import type { Subject, Theme } from "@/lib/design-lab/sample";
import { Plate, Shelf } from "@/components/design-lab/white";
import { themesOf, useDiscovery } from "@/components/design-lab/useDiscovery";
import { ACCENT, Tagline, Wordmark } from "@/components/design-lab/brand";

/**
 * **ROUND FOUR, DIRECTION THREE — ONE HELL OF A DAY.**
 *
 * The product candidate: the Adventure Brand's confidence, the Everyday
 * Explorer's intelligence, Swipe & Discover's photography.
 *
 * ## The interaction
 *
 * Not pills and not a dashboard — **a sentence you edit**. The page says what
 * you are looking for in words, and each blank is a word you tap to change:
 *
 * ```
 * I'm looking for  anything   ·  going with  anyone
 * I've got  the whole day     ·  let's go  anywhere
 * ```
 *
 * It reads as a plan rather than a query, it is four taps at most, and it
 * stays one object instead of becoming a panel. The menu that opens is a plain
 * list of large words — no dropdown chrome, no checkboxes, no apply.
 *
 * ## It is a real prototype, not a mockup
 *
 * Every blank narrows real Atlas data, and the sentence prints what it could
 * not do underneath itself. *Going with* uses the two audience shapes Atlas
 * states without being asked an age; the real product sends `childAge` and
 * gets a per-subject verdict, and this says so rather than implying it has one.
 */
export function DayBoard({
  subjects,
  verbs,
  allThemes,
  base,
  now,
  total,
}: {
  readonly subjects: readonly Subject[];
  readonly verbs: readonly { label: string; ids: readonly string[] }[];
  readonly allThemes: readonly Theme[];
  /**
   * Where a subject's page lives, e.g. `/labs/design/v4/explorer`.
   *
   * A string rather than a function: a server component cannot hand a
   * function to a client one, and the id is the only thing that varies.
   */
  readonly base: string;
  /** The server's instant, so the client never reads its own clock. */
  readonly now: string;
  readonly total: number;
}) {
  const { picks, set, results, notes, at, ask } = useDiscovery(
    subjects,
    verbs,
    now,
  );
  const [open, setOpen] = useState<string>();
  const href = (subject: Subject) => `${base}/${subject.id}`;
  const allowed = new Set(results.map((r) => r.subject.id));
  const shelves = themesOf(allThemes, allowed);
  const lead = results[0];

  const blank = (
    key: string,
    value: string | undefined,
    fallback: string,
    options: readonly { value: string; label: string; blocked?: boolean }[],
    onPick: (next: string | undefined) => void,
  ) => (
    <span className="relative inline-block">
      <button
        type="button"
        data-testid="day-blank"
        data-blank={key}
        aria-expanded={open === key}
        onClick={() => setOpen(open === key ? undefined : key)}
        style={{ textDecorationColor: ACCENT }}
        className="underline decoration-[0.09em] underline-offset-[0.14em] hover:opacity-70"
      >
        {value ?? fallback}
      </button>
      {open === key && (
        <span className="absolute top-[calc(100%+0.3em)] left-0 z-30 flex w-max max-w-[86vw] flex-col gap-0.5 bg-white p-2 ring-1 ring-black/15">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              data-testid="day-option"
              disabled={option.blocked}
              onClick={() => {
                onPick(option.value === value ? undefined : option.value);
                setOpen(undefined);
              }}
              className={
                "px-2 py-1.5 text-left text-[17px] font-bold tracking-[-0.02em] whitespace-nowrap first-letter:uppercase sm:text-[20px] " +
                (option.blocked
                  ? "cursor-not-allowed text-black/25"
                  : option.value === value
                    ? "text-black"
                    : "text-black/55 hover:text-black")
              }
            >
              {option.label}
            </button>
          ))}
        </span>
      )}
    </span>
  );

  return (
    <>
      <section className="mx-auto max-w-[1800px] px-5 pt-7 sm:px-10 sm:pt-12">
        <Wordmark size="huge" href="/labs/design/v4/one-hell-of-a-day" />
        <Tagline className="mt-2 block" />

        {/* The sentence. One object, four blanks, no panel. */}
        <div className="mt-8 max-w-[26ch] text-[28px] leading-[1.18] font-extrabold tracking-[-0.035em] text-black/30 sm:mt-12 sm:max-w-[34ch] sm:text-[52px]">
          {/* **The page's heading.** The wordmark is a link and the sentence
              is a paragraph, which left the flagship prototype with no h1 at
              all — the one page here most likely to be screenshotted and the
              one with nothing for a screen reader to land on. */}
          <h1 className="text-black/80">What are we doing today?</h1>
          <p className="mt-3">
            <span className="text-black/30">I&apos;m looking for </span>
            <span className="text-black">
              {blank(
                "doing",
                picks.doing,
                "anything",
                verbs.map((verb) => ({ value: verb.label, label: verb.label })),
                set("doing"),
              )}
            </span>
            <span className="text-black/30">, going with </span>
            <span className="text-black">
              {blank(
                "who",
                picks.who,
                "anyone",
                [
                  { value: "just me", label: "just me" },
                  { value: "a young child", label: "a young child" },
                  { value: "friends", label: "friends" },
                ],
                set("who"),
              )}
            </span>
            <span className="text-black/30">. I&apos;ve got </span>
            <span className="text-black">
              {blank(
                "when",
                picks.when,
                "the whole day",
                [
                  { value: "today", label: "today" },
                  { value: "this week", label: "this week" },
                  { value: "sometime", label: "sometime" },
                ],
                set("when"),
              )}
            </span>
            <span className="text-black/30">, and we&apos;ll go </span>
            <span className="text-black">
              {blank(
                "far",
                picks.far,
                "anywhere",
                [
                  { value: "anywhere", label: "anywhere" },
                  {
                    value: "close to home",
                    label: "close to home",
                    ...(at ? {} : { blocked: true }),
                  },
                  {
                    value: "worth the drive",
                    label: "worth the drive",
                    ...(at ? {} : { blocked: true }),
                  },
                ],
                set("far"),
              )}
            </span>
            <span className="text-black/30">.</span>
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-1">
          <p className="text-[14px] font-semibold tabular-nums">
            {results.length} of {total.toLocaleString("en-CA")} real places
          </p>
          {!at && ask && (
            <button
              type="button"
              data-testid="day-locate"
              onClick={ask}
              style={{ color: ACCENT }}
              className="w-fit text-[14px] font-semibold underline underline-offset-4"
            >
              share where you are to use distance
            </button>
          )}
          {notes.map((note) => (
            <p
              key={note}
              data-testid="day-note"
              className="max-w-[72ch] text-[12.5px] leading-relaxed text-black/40"
            >
              {note}
            </p>
          ))}
        </div>
      </section>

      {/* The answer: one enormous photograph, then galleries. */}
      {lead && (
        <section className="mt-9 sm:mt-14">
          <div className="mx-auto max-w-[1800px] px-0 sm:px-10">
            <Plate
              subject={lead.subject}
              href={href(lead.subject)}
              ratio="21/9"
              size="hero"
            />
          </div>
        </section>
      )}

      <div className="mt-11 flex flex-col gap-12 pb-20 sm:mt-16 sm:gap-20">
        {shelves.map((theme, index) => (
          <section key={theme.key} data-testid="day-shelf">
            <div className="mx-auto max-w-[1800px] px-5 sm:px-10">
              <h2 className="text-[26px] leading-[0.95] font-extrabold tracking-[-0.04em] uppercase sm:text-[48px]">
                {theme.title}
              </h2>
              <p className="mt-1 text-[12.5px] text-black/40">
                {theme.basis} · {theme.subjects.length}
              </p>
            </div>
            <div className="mt-4 sm:mt-6">
              <Shelf
                subjects={theme.subjects}
                href={href}
                ratio={["3/2", "4/5", "1/1", "3/4"][index % 4]!}
                wide={index === 0}
              />
            </div>
          </section>
        ))}

        {/* **Narrowing must not empty the page.** Themes need three or four
            real subjects to be a shelf; once the sentence has cut the pool to
            eleven, none of them qualifies and the page went blank below the
            photograph. The results themselves become the one shelf. */}
        {shelves.length === 0 && results.length > 0 && (
          <section data-testid="day-shelf">
            <div className="mx-auto max-w-[1800px] px-5 sm:px-10">
              <h2 className="text-[26px] leading-[0.95] font-extrabold tracking-[-0.04em] uppercase sm:text-[48px]">
                What we found
              </h2>
              <p className="mt-1 text-[12.5px] text-black/40">
                Everything matching, nearest first where Atlas has placed it ·{" "}
                {results.length}
              </p>
            </div>
            <div className="mt-4 sm:mt-6">
              <Shelf
                subjects={results.map((r) => r.subject)}
                href={href}
                ratio="3/2"
                wide
              />
            </div>
          </section>
        )}

        {shelves.length === 0 && results.length === 0 && (
          <p className="mx-auto max-w-[1800px] px-5 text-[15px] text-black/50 sm:px-10">
            Nothing survives all of that. Put something back — we would rather
            show you nothing than pad it out.
          </p>
        )}
      </div>
    </>
  );
}
