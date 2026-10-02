"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import type { Possibility } from "@/lib/labs/october/possibility";
import { byFit, mixSources, type Context } from "@/lib/labs/october/fit";
import { search } from "@/lib/labs/october/search";
import {
  applyFilters,
  FILTERS,
  GROUP_LABEL,
  type Days,
  type FilterGroup,
} from "@/lib/labs/october/filters";
import { LabKeep } from "./LabKeep";
import { Shot } from "./atoms";

const HERE = "/labs/october/discovery/d";
const PAGE = 24;

const WORDS = {
  idle: "Choose",
  done: "Chosen",
  signIn: "Sign in to choose",
} as const;

/**
 * **Experiment D — the boring one, and the only one shaped like a product.**
 *
 * A, B and C each answer *"I have no idea what to do"* with a mechanic. This
 * answers it with a page, and then answers seven other questions with the same
 * page: a search box, three rows of filters, one list. There is no intro, no
 * wizard, no takeover, and nothing to learn.
 *
 * ## Two concepts, not six
 *
 * **Discover** is everything Passport knows you could do. **Choices** is what
 * you picked out of it. October, Movies, Make and What's On are not separate
 * systems here — Movies is the *Watch* filter, Make is the *Make* filter, and
 * both sit in one result set with the events. That is the whole hypothesis,
 * and the thing to judge is whether a person can still find what they came
 * for once those walls are gone.
 *
 * ## Everything is one list
 *
 * No section per source. A film, a haunt and a thing to carve appear in the
 * same column, ordered by how well they suit this evening, and the only
 * grouping is the honest one at the bottom: things that could not answer the
 * question somebody asked. `mixSources` stops one catalogue owning a run.
 *
 * ## Search and filters do not fight
 *
 * A query narrows the pool; filters narrow it again. Choosing something
 * changes neither — the save is a `PUT` and the page does not navigate, so a
 * search four filters deep survives being acted on, which is the thing that
 * makes a discovery page usable for longer than one decision.
 */
export function Discover({
  possibilities,
  ctx,
  days,
  signedIn,
  kept,
}: {
  readonly possibilities: readonly Possibility[];
  readonly ctx: Context;
  readonly days: Days;
  readonly signedIn: boolean;
  readonly kept: readonly string[];
}) {
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const [picked, setPicked] = useState("");
  const [shown, setShown] = useState(PAGE);
  const keptSet = useMemo(() => new Set(kept), [kept]);

  const typed = query.trim().length > 1;
  const withDay: Days = useMemo(
    () => (picked ? { ...days, picked } : days),
    [days, picked],
  );

  /** Search first, then filters, then the evening's ordering. */
  const { results, unanswered, active } = useMemo(() => {
    const pool = typed
      ? search(possibilities, query, possibilities.length).map(
          (h) => h.possibility,
        )
      : possibilities;
    const applied = applyFilters(pool, chosen, withDay);
    // A query already ranked the pool by relevance; re-sorting by fit would
    // throw that away. Without one, the evening decides.
    // **Asking for a day should put that day's things first.** "This weekend
    // with my kid" was answered with six films, because a film is available
    // every day and therefore matches every day filter honestly. It is not
    // wrong that Hocus Pocus is a thing you can do on Saturday; it is wrong
    // that the six things actually *happening* on Saturday were below it. So
    // a stated date outranks an open one whenever somebody named a day —
    // a reordering, never an exclusion.
    const askedForADay =
      picked !== "" ||
      ["tonight", "tomorrow", "weekend"].some((id) => chosen.has(id));
    // **How much is this thing *about* the day you asked for?** The first
    // version of this rule treated every dated thing alike, so "what is on
    // Saturday" led with a ten-month gallery exhibition that happens to be
    // open on Saturday. A one-night event is the answer to that question; a
    // run of a few nights is nearly it; a thing that has been open since March
    // is not, however true it is. The threshold follows the production
    // calendar's own `OCCASION_MAX_DAYS` — three weeks is where an occasion
    // stops being one.
    const dated = (p: Possibility) => {
      const n = p.availability.days.length;
      if (p.availability.shape === "fixed" && n <= 1) return 3;
      if (n > 1 && n <= 7) return 2;
      if (n > 7 && n <= 21) return 1;
      return 0;
    };
    const base = byFit(ctx);
    const ordered = typed
      ? applied.results
      : [...applied.results].sort((a, b) =>
          askedForADay && dated(a) !== dated(b)
            ? dated(b) - dated(a)
            : base(a, b),
        );
    const asked = chosen.size + (picked ? 1 : 0) + (typed ? 1 : 0);
    return {
      // **The default page gets stricter variety than a filtered one.** With
      // nothing asked for, the ordering is dominated by whichever catalogue
      // happens to suit the weather — measured on a wet evening, sixteen of
      // the first twenty-four were films. Alternating is right when somebody
      // has told you nothing; once they filter to *Watch*, a run of films is
      // the correct answer and the cap relaxes.
      results: mixSources(ordered, asked === 0 ? 1 : 2),
      unanswered: applied.unanswered,
      active: asked,
    };
  }, [typed, query, possibilities, chosen, withDay, ctx, picked]);

  const toggle = (id: string) => {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setShown(PAGE);
  };

  const clearAll = () => {
    setQuery("");
    setChosen(new Set());
    setPicked("");
    setShown(PAGE);
  };

  return (
    <>
      {/* ------------------------------------------------------- search */}
      <label className="flex items-center gap-3 rounded-lg border border-[#e9e6da]/15 px-4 py-3 transition-colors focus-within:border-[#d09a4e]/60">
        <Search className="h-4 w-4 shrink-0 text-[#e9e6da]/35" aria-hidden />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShown(PAGE);
          }}
          placeholder="Search everything — pumpkin, scary, costume, meteor"
          aria-label="Search everything"
          className="min-w-0 flex-1 bg-transparent text-[#e9e6da] placeholder:text-[#e9e6da]/30 focus:outline-none"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="shrink-0 text-[#e9e6da]/35 hover:text-[#e9e6da]"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </label>

      {/* ------------------------------------------------------ filters */}
      <div className="mt-4 flex flex-col gap-2">
        {(["when", "feel", "doing", "looking", "where"] as const).map(
          (group) => (
            <Row
              key={group}
              group={group}
              chosen={chosen}
              onToggle={toggle}
              extra={
                group === "when" ? (
                  <label className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[#e9e6da]/15 px-3 text-[13px] text-[#e9e6da]/55 focus-within:border-[#d09a4e]/60">
                    <span className="shrink-0">Pick a date</span>
                    <input
                      type="date"
                      value={picked}
                      min="2026-10-01"
                      max="2026-10-31"
                      onChange={(e) => {
                        setPicked(e.target.value);
                        setShown(PAGE);
                      }}
                      className="bg-transparent text-[#e9e6da] focus:outline-none"
                    />
                  </label>
                ) : null
              }
            />
          ),
        )}
      </div>

      {/* ------------------------------------------------------- summary */}
      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-t border-[#e9e6da]/10 pt-3">
        <p className="text-sm text-[#e9e6da]/55" data-testid="count">
          <span className="text-[#e9e6da] tabular-nums">{results.length}</span>{" "}
          {results.length === 1 ? "thing" : "things"}
          {active === 0 ? " Passport knows about" : ""}
        </p>
        {active > 0 ? (
          <button
            type="button"
            onClick={clearAll}
            className="text-sm text-[#d09a4e] underline-offset-4 hover:underline"
          >
            Clear everything
          </button>
        ) : null}
      </div>

      {/* ------------------------------------------------------- results */}
      {results.length === 0 ? (
        <p className="mt-10 max-w-md leading-relaxed text-[#e9e6da]/45">
          Nothing matches all of that. Take one of the filters off, or search
          for something else.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2" data-testid="results">
          {results.slice(0, shown).map((p) => (
            <li key={p.id}>
              <Result
                p={p}
                saved={keptSet.has(p.id)}
                signedIn={signedIn}
                locality={p.locality}
              />
            </li>
          ))}
        </ul>
      )}

      {results.length > shown ? (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="mt-5 inline-flex min-h-11 items-center rounded-full border border-[#e9e6da]/18 px-5 text-sm text-[#e9e6da]/70 hover:border-[#d09a4e]/50 hover:text-[#e9e6da]"
        >
          Show {Math.min(PAGE, results.length - shown)} more
        </button>
      ) : null}

      {/* ------------------------------- what could not answer the question */}
      <Unanswered
        items={unanswered.when}
        line="These are on in October, but nobody published which nights."
      />
      <Unanswered
        items={unanswered.where}
        line="Nobody has said whether these are indoors or outdoors."
      />
    </>
  );
}

// ------------------------------------------------------------------ pieces

/**
 * One row of chips with its group name leading it.
 *
 * The name is an inline lead-in rather than a fixed column — at phone width an
 * 80px gutter pushed thirteen chips onto seven rows and the first result off
 * the bottom of the screen, which on a page whose whole job is results is the
 * one layout mistake that actually matters.
 */
function Row({
  group,
  chosen,
  onToggle,
  extra,
}: {
  readonly group: FilterGroup;
  readonly chosen: ReadonlySet<string>;
  readonly onToggle: (id: string) => void;
  readonly extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 shrink-0 text-[10px] tracking-[0.16em] text-[#e9e6da]/30 uppercase">
        {GROUP_LABEL[group]}
      </span>
      {FILTERS.filter((f) => f.group === group).map((f) => {
        const on = chosen.has(f.id);
        return (
          <button
            key={f.id}
            type="button"
            data-testid="filter"
            data-filter={f.id}
            aria-pressed={on}
            onClick={() => onToggle(f.id)}
            className={`inline-flex min-h-8 items-center rounded-full border px-3 text-[13px] transition-colors ${
              on
                ? "border-[#d09a4e] bg-[#d09a4e]/15 text-[#f0c88a]"
                : "border-[#e9e6da]/15 text-[#e9e6da]/60 hover:border-[#e9e6da]/35 hover:text-[#e9e6da]"
            }`}
          >
            {f.label}
          </button>
        );
      })}
      {extra}
    </div>
  );
}

/**
 * One result, sized by whether there is a photograph worth showing.
 *
 * With one, the picture is 200px of the row and does real work. Without one,
 * the row is **compact** rather than padded out with an empty frame — which
 * means a thing with no image is smaller, never broken, and never excluded.
 * Image availability changes the presentation and never the eligibility.
 */
function Result({
  p,
  saved,
  signedIn,
  locality,
}: {
  readonly p: Possibility;
  readonly saved: boolean;
  readonly signedIn: boolean;
  readonly locality?: string;
}) {
  const has = Boolean(p.image);
  return (
    <article
      data-testid="result"
      data-source={p.source}
      data-has-image={has ? "true" : "false"}
      className="flex gap-4 rounded-lg border border-[#e9e6da]/10 p-3 transition-colors hover:border-[#d09a4e]/35"
    >
      {has ? (
        <Link href={p.href} className="shrink-0">
          <Shot p={p} className="h-24 w-32 rounded-md sm:h-28 sm:w-48" />
        </Link>
      ) : (
        <span
          aria-hidden
          className="w-1 shrink-0 rounded-full bg-[#d09a4e]/25"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-[10px] tracking-[0.18em] text-[#d09a4e] uppercase tabular-nums">
          {p.availability.label}
          {locality ? (
            <span className="text-[#e9e6da]/30"> · {locality}</span>
          ) : null}
        </p>
        <h3 className="font-heading mt-1 text-lg leading-tight text-[#f3efe4]">
          <Link href={p.href} className="hover:text-white">
            {p.title}
          </Link>
        </h3>
        {p.line ? (
          <p className="mt-1 text-sm leading-snug text-[#e9e6da]/50">
            {clip(p.line, has ? 120 : 170)}
          </p>
        ) : null}
        <div className="mt-2.5">
          <LabKeep
            p={p}
            saved={saved}
            signedIn={signedIn}
            returnTo={HERE}
            words={WORDS}
          />
        </div>
      </div>
    </article>
  );
}

/**
 * The things that could not answer the question, offered rather than hidden.
 *
 * Two large gaps in the evidence produce these: 59% of Atlas subjects have no
 * indoor/outdoor classification, and a few publish no dates. Filtering them
 * into the results would be a claim nobody made; filtering them out silently
 * would be how somebody concludes the haunt they are looking for does not
 * exist. So they sit below the results, counted and reachable.
 */
function Unanswered({
  items,
  line,
}: {
  readonly items: readonly Possibility[];
  readonly line: string;
}) {
  if (items.length === 0) return null;
  return (
    <details className="group mt-6" data-testid="unanswered">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-sm text-[#e9e6da]/35 underline-offset-4 hover:text-[#e9e6da]/70 hover:underline">
        {items.length} more — {line}
        <span className="ml-2 text-[#d09a4e]/60 transition-transform group-open:rotate-90">
          ›
        </span>
      </summary>
      <ul className="mt-2 flex flex-col gap-1 pl-1 text-sm">
        {items.map((p) => (
          <li key={p.id}>
            <Link
              href={p.href}
              className="text-[#e9e6da]/55 hover:text-[#e9e6da]"
            >
              {p.title}
            </Link>
            <span className="text-[#e9e6da]/25"> · {p.availability.label}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(" "));
  return `${cut.slice(0, stop > max * 0.5 ? stop : max).trim()}…`;
}
